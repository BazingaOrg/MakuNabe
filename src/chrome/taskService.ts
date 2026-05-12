import {TASK_EXPIRE_TIME} from '../consts/const'
import {handleChatCompleteTask, repairSummaryJson} from './openaiService'
import {finalizeVideoSummary, parseSummaryContentStrict, updateVideoSummaryStage} from './summarySessionService'
import {ensureSummaryEmailSent} from './summaryEmailService'
import {ensureLegacyApiSecretReady, getApiSecret} from './secretService'

export const tasksMap = new Map<string, Task>()
const inflightTaskIds = new Set<string>()
const TASK_STORAGE_PREFIX = 'makunabe_task:'
const TASK_HEARTBEAT_INTERVAL_MS = 10 * 1000

const getTaskStorageKey = (taskId: string) => {
  return `${TASK_STORAGE_PREFIX}${taskId}`
}

const isValidStoredTask = (value: unknown): value is Task => {
  if (value == null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) return false
  if (typeof record.status !== 'string') return false
  if (typeof record.startTime !== 'number') return false
  const def = record.def as Record<string, unknown> | undefined
  if (def == null || typeof def !== 'object') return false
  if (typeof def.type !== 'string' || def.type.length === 0) return false
  return true
}

const toStoredTask = (task: Task): Task => {
  return {
    ...task,
    def: {
      ...task.def,
      extra: task.def.extra == null
        ? undefined
        : Object.fromEntries(Object.entries(task.def.extra).filter(([key]) => key !== 'apiKey')),
    },
    resp: undefined,
  }
}

const saveTask = async (task: Task) => {
  task.updatedAt = Date.now()
  await chrome.storage.local.set({
    [getTaskStorageKey(task.id)]: JSON.stringify(toStoredTask(task)),
  })
}

const removeTask = async (taskId: string) => {
  await chrome.storage.local.remove(getTaskStorageKey(taskId))
}

const loadTask = async (taskId: string): Promise<Task | undefined> => {
  const result = await chrome.storage.local.get(getTaskStorageKey(taskId))
  const rawValue = result?.[getTaskStorageKey(taskId)]

  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    return undefined
  }

  try {
    const parsed: unknown = JSON.parse(rawValue)
    if (!isValidStoredTask(parsed)) {
      console.error('Stored task has invalid shape, removing', taskId)
      await removeTask(taskId)
      return undefined
    }
    return parsed
  } catch (error) {
    console.error('Failed to parse stored task', taskId, error)
    await removeTask(taskId)
    return undefined
  }
}

const loadStoredTasks = async (): Promise<Task[]> => {
  const result = await chrome.storage.local.get(null)
  const tasks: Task[] = []

  for (const [storageKey, rawValue] of Object.entries(result)) {
    if (!storageKey.startsWith(TASK_STORAGE_PREFIX) || typeof rawValue !== 'string' || rawValue.length === 0) {
      continue
    }

    try {
      const parsed: unknown = JSON.parse(rawValue)
      if (!isValidStoredTask(parsed)) {
        console.error('Stored task has invalid shape, removing', storageKey)
        await chrome.storage.local.remove(storageKey)
        continue
      }
      tasks.push(parsed)
    } catch (error) {
      console.error('Failed to parse stored task', storageKey, error)
      await chrome.storage.local.remove(storageKey)
    }
  }

  return tasks
}

const finalizeInterruptedTask = async (task: Task, message: string) => {
  task.status = 'done'
  task.error = message
  task.endTime = Date.now()
  await saveTask(task)

  const summarySessionKey = task.def.extra?.summarySessionKey as string | undefined
  if (typeof summarySessionKey === 'string' && summarySessionKey.length > 0) {
    await finalizeVideoSummary({
      sessionKey: summarySessionKey,
      taskError: message,
    })
  }
}

export const enqueueTask = async (task: Task) => {
  tasksMap.set(task.id, task)
  await saveTask(task)
}

export const getTaskSnapshot = async (taskId: string) => {
  return tasksMap.get(taskId) ?? await loadTask(taskId)
}

export const consumeTask = async (taskId: string) => {
  tasksMap.delete(taskId)
  await removeTask(taskId)
}

const getApiSecretOrThrow = async () => {
  await ensureLegacyApiSecretReady()
  const apiKey = await getApiSecret()
  if (apiKey == null) {
    throw new Error('API key is not configured')
  }
  return apiKey
}

const tryRepairSummaryTaskContent = async (task: Task, apiKey: string) => {
  if (task.def.extra?.summaryAutoRepair !== true) {
    return
  }

  const content = task.resp?.choices?.[0]?.message?.content?.trim()
  if (typeof content !== 'string' || content.length === 0) {
    return
  }

  const strictParseResult = parseSummaryContentStrict(content)
  if (strictParseResult.error == null) {
    return
  }

  const summarySessionKey = task.def.extra?.summarySessionKey as string | undefined
  if (typeof summarySessionKey === 'string' && summarySessionKey.length > 0) {
    await updateVideoSummaryStage({
      sessionKey: summarySessionKey,
      recoveryStage: 'repairing',
      clearStreamingContent: false,
    })
  }

  const repairedContent = await repairSummaryJson({
    serverUrl: task.def.serverUrl,
    apiKey,
    model: task.def.data?.model,
    content,
  })

  task.resp = {
    choices: [
      {
        message: {
          content: repairedContent,
        },
      },
    ],
  }
}

const rerunChatCompleteTask = async (task: Task, apiKey: string) => {
  if (task.def.extra?.summaryAutoRetry !== true) {
    throw new Error(task.error ?? 'Summary auto retry disabled')
  }

  const summarySessionKey = task.def.extra?.summarySessionKey as string | undefined
  if (typeof summarySessionKey === 'string' && summarySessionKey.length > 0) {
    await updateVideoSummaryStage({
      sessionKey: summarySessionKey,
      recoveryStage: 'retrying',
      clearStreamingContent: true,
    })
  }

  const modelName = String(task.def.data?.model ?? '').toLowerCase()
  const nextTemperature = Number(task.def.data?.temperature)
  if (Number.isFinite(nextTemperature) && nextTemperature > 0) {
    task.def.data = {
      ...task.def.data,
      temperature: modelName.startsWith('kimi')
        ? 1
        : Math.max(0, Math.min(nextTemperature, 0.2)),
    }
  }

  task.error = undefined
  task.resp = undefined
  await handleChatCompleteTask(task, apiKey)
}

export const handleTask = async (task: Task) => {
  if (inflightTaskIds.has(task.id)) {
    console.debug(`任务已在执行中，跳过重入: ${task.id}`)
    return
  }
  inflightTaskIds.add(task.id)
  try {
    await handleTaskInner(task)
  } finally {
    inflightTaskIds.delete(task.id)
  }
}

const handleTaskInner = async (task: Task) => {
  console.debug(`处理任务: ${task.id} (type: ${task.def.type})`)
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined
  try {
    task.status = 'running'
    task.heartbeatAt = Date.now()
    await saveTask(task)
    heartbeatTimer = setInterval(() => {
      task.heartbeatAt = Date.now()
      saveTask(task).catch(console.error)
    }, TASK_HEARTBEAT_INTERVAL_MS)

    switch (task.def.type) {
      case 'chatComplete': {
        const apiKey = await getApiSecretOrThrow()
        await handleChatCompleteTask(task, apiKey)
        break
      }
      default:
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`任务类型不支持: ${task.def.type}`)
    }

    console.debug(`处理任务成功: ${task.id} (type: ${task.def.type})`)
  } catch (e: any) {
    console.debug(`处理任务失败，准备重试: ${task.id} (type: ${task.def.type})`, e.message)

    try {
      switch (task.def.type) {
        case 'chatComplete': {
          const apiKey = await getApiSecretOrThrow()
          await rerunChatCompleteTask(task, apiKey)
          console.debug(`处理任务重试成功: ${task.id} (type: ${task.def.type})`)
          break
        }
        default:
          throw e
      }
    } catch (retryError: any) {
      task.error = retryError?.message ?? e.message
      console.debug(`处理任务失败: ${task.id} (type: ${task.def.type})`, task.error)
    }
  }

  if (heartbeatTimer != null) {
    clearInterval(heartbeatTimer)
  }

  if (task.error == null && task.def.type === 'chatComplete') {
    try {
      const apiKey = await getApiSecretOrThrow()
      await tryRepairSummaryTaskContent(task, apiKey)
    } catch (repairError: any) {
      console.debug(`总结修复失败，保留原始结果: ${task.id} (type: ${task.def.type})`, repairError?.message ?? repairError)
    }
  }

  task.status = 'done'
  task.endTime = Date.now()
  task.heartbeatAt = Date.now()
  await saveTask(task)

  const summarySessionKey = task.def.extra?.summarySessionKey as string | undefined
  if (typeof summarySessionKey === 'string' && summarySessionKey.length > 0) {
    const content = task.resp?.choices?.[0]?.message?.content?.trim()
    finalizeVideoSummary({
      sessionKey: summarySessionKey,
      content,
      taskError: task.error,
    }).then(async () => {
      await ensureSummaryEmailSent(summarySessionKey)
    }).catch(console.error)
  }
}

let initTaskServicePromise: Promise<void> | undefined

export const initTaskService = () => {
  if (initTaskServicePromise != null) {
    return initTaskServicePromise
  }

  initTaskServicePromise = (async () => {
    const storedTasks = await loadStoredTasks()
    const now = Date.now()

    for (const task of storedTasks) {
      if (task.startTime < now - TASK_EXPIRE_TIME) {
        await removeTask(task.id)
        continue
      }

      if (task.status === 'pending') {
        tasksMap.set(task.id, task)
        handleTask(task).catch(console.error)
        continue
      }

      if (task.status === 'running') {
        await finalizeInterruptedTask(task, '总结任务因扩展后台重启而中断，请重新生成。')
        continue
      }

      tasksMap.set(task.id, task)
    }
  })()

  initTaskServicePromise.catch(console.error)

  // 处理任务: tasksMap
  setInterval(async () => {
    await initTaskServicePromise
    for (const task of tasksMap.values()) {
      if (task.status === 'pending' && !inflightTaskIds.has(task.id)) {
        handleTask(task).catch(console.error)
        break
      } else if (task.status === 'running') {
        break
      }
    }
  }, 1000)
  // 检测清理tasksMap
  setInterval(async () => {
    await initTaskServicePromise
    const now = Date.now()

    for (const [taskId, task] of tasksMap) {
      if (task.startTime < now - TASK_EXPIRE_TIME) {
        tasksMap.delete(taskId)
        removeTask(taskId).catch(console.error)
        console.debug(`清理任务: ${task.id} (type: ${task.def.type})`)
      }
    }
  }, 10000)

  return initTaskServicePromise
}
