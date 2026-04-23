import {v4} from 'uuid'
import {handleTask, initTaskService, tasksMap} from './taskService'
import { DEFAULT_USE_PORT, STORAGE_ENV} from '@/consts/const'
import { AllExtensionMessages } from '@/message-typings'
import { ExtensionMessaging, TAG_TARGET_INJECT } from '../message'
import {discoverModels} from './openaiService'
import {cleanupSummarySessions, getSummarySession, markVideoSummaryPending, upsertSummarySession} from './summarySessionService'
import {retrySummaryEmailFromAlarm} from './summaryEmailService'

const setBadgeOk = async (tabId: number, ok: boolean) => {
  await chrome.action.setBadgeText({
    text: ok ? '✓' : '',
    tabId,
  })
  await chrome.action.setBadgeBackgroundColor({
    color: '#3245e8',
    tabId,
  })
  await chrome.action.setBadgeTextColor({
    color: '#ffffff',
    tabId,
  })
}

const closeSidePanel = async () => {
  chrome.sidePanel.setOptions({
    enabled: false,
  })
  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: false,
  })
}

const sendSummaryEmail = async (webhookUrl: string, payload: Record<string, unknown>) => {
  const timeout = 15000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeout)

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    let data: { ok?: boolean, requestId?: string, error?: string } | undefined
    try {
      data = await response.json()
    } catch (e) {
      data = undefined
    }
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error ?? `Webhook request failed: ${response.status}`)
    }

    return {
      ok: true,
      requestId: data?.requestId,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

const methods: {
  [K in AllExtensionMessages['method']]: (params: Extract<AllExtensionMessages, { method: K }>['params'], context: MethodContext) => Promise<any>
} = {
  CLOSE_SIDE_PANEL: async (params, context) => {
    closeSidePanel()
  },
  GET_TAB_ID: async (params, context) => {
    return context.tabId
  },
  ADD_TASK: async (params, context) => {
    const summarySessionKey = params.taskDef.extra?.summarySessionKey as string | undefined
    const summaryRunStartedAt = params.taskDef.extra?.summaryRunStartedAt as number | undefined
    if (typeof summarySessionKey === 'string' && summarySessionKey.length > 0 && typeof summaryRunStartedAt === 'number') {
      await markVideoSummaryPending({
        sessionKey: summarySessionKey,
        runStartedAt: summaryRunStartedAt,
      })
    }

    // 新建任务
    const task: Task = {
      id: v4(),
      startTime: Date.now(),
      status: 'pending',
      def: params.taskDef,
    }
    tasksMap.set(task.id, task)

    // 立即触发任务
    handleTask(task).catch(console.error)

    return task
  },
  GET_TASK: async (params, context) => {
    // 返回任务信息
    const taskId = params.taskId
    const task = tasksMap.get(taskId)
    if (task == null) {
      return {
        code: 'not_found',
      }
    }

    // 检测删除缓存
    if (task.status === 'done') {
      tasksMap.delete(taskId)
    }

    // 返回任务
    return {
      code: 'ok',
      task,
    }
  },
  SHOW_FLAG: async (params, context) => {
    if (context.tabId == null) {
      return
    }
    await setBadgeOk(context.tabId, params.show)
  },
  SEND_SUMMARY_EMAIL: async (params, context) => {
    try {
      return await sendSummaryEmail(params.webhookUrl, params.payload)
    } catch (error: any) {
      return {
        ok: false,
        error: error?.name === 'AbortError' ? 'Webhook request timeout' : (error?.message ?? 'Unknown webhook error'),
      }
    }
  },
  UPSERT_SUMMARY_SESSION: async (params, context) => {
    return await upsertSummarySession(params.input)
  },
  GET_SUMMARY_SESSION: async (params, context) => {
    return await getSummarySession(params.sessionKey)
  },
  DISCOVER_MODELS: async (params, context) => {
    return await discoverModels({
      serverUrl: params.serverUrl,
      apiKey: params.apiKey,
    })
  },
}
// 初始化backgroundMessage
const extensionMessaging = new ExtensionMessaging(DEFAULT_USE_PORT)
extensionMessaging.init(methods)

chrome.runtime.onMessage.addListener((event: any, sender: chrome.runtime.MessageSender, sendResponse: (result: any) => void) => {
  // debug((sender.tab != null) ? `tab ${sender.tab.url ?? ''} => ` : 'extension => ', event)

  // legacy
  if (event.type === 'syncGet') { // sync.get
    chrome.storage.sync.get(event.keys, data => {
      sendResponse(data)
    })
    return true
  } else if (event.type === 'syncSet') { // sync.set
    chrome.storage.sync.set(event.items).catch(console.error)
  } else if (event.type === 'syncRemove') { // sync.remove
    chrome.storage.sync.remove(event.keys).catch(console.error)
  }
})

// 点击扩展图标
chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id
  if (tabId == null) {
    return
  }

  chrome.storage.sync.get(STORAGE_ENV, (envDatas) => {
    const envDataStr = envDatas[STORAGE_ENV]
    let envData: Record<string, any> = {}
    if (typeof envDataStr === 'string' && envDataStr.length > 0) {
      try {
        envData = JSON.parse(envDataStr)
      } catch (error) {
        console.error('Failed to parse env data:', error)
      }
    }
    if (envData.sidePanel === true) {
      chrome.sidePanel.setOptions({
        enabled: true,
        tabId,
        path: '/sidepanel.html?tabId=' + tabId,
      })
      chrome.sidePanel.setPanelBehavior({
        openPanelOnActionClick: true,
      })
      chrome.sidePanel.open({
        tabId,
      })
    } else {
      closeSidePanel()
      extensionMessaging.sendMessage(false, tabId, TAG_TARGET_INJECT, 'TOGGLE_DISPLAY').catch(console.error)
    }
  })
})

initTaskService()
cleanupSummarySessions().catch(console.error)

chrome.alarms.onAlarm.addListener((alarm) => {
  retrySummaryEmailFromAlarm(alarm.name).catch(console.error)
})
