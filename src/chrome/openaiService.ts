import {DEFAULT_SERVER_URL_OPENAI, SUMMARY_REPAIR_PROMPT} from '../consts/const'
import {updateVideoSummaryStreaming} from './summarySessionService'

export interface ModelDiscoveryResult {
  models: string[]
}

export const getServerUrl = (serverUrl?: string) => {
  if (serverUrl == null || serverUrl.length === 0) {
    return DEFAULT_SERVER_URL_OPENAI
  }
  if (serverUrl.endsWith('/')) {
    serverUrl = serverUrl.slice(0, -1)
  }
  // 如果serverUrl以https://generativelanguage.googleapis.com开头，则直接返回
  if (serverUrl.toLowerCase().startsWith('https://generativelanguage.googleapis.com')) {
    return serverUrl
  }
  // 如果serverUrl不以/vxxx结尾，则添加/v1
  if (!/\/v\d+$/.test(serverUrl.toLowerCase())) {
    serverUrl += '/v1'
  }
  return serverUrl
}

const getErrorMessage = async (resp: Response) => {
  try {
    const data = await resp.json() as { error?: { message?: string }, message?: string }
    return data.error?.message ?? data.message
  } catch {
    return undefined
  }
}

const buildStreamResponsePayload = (content: string) => {
  return {
    choices: [
      {
        message: {
          content,
        },
      },
    ],
  }
}

const parseChatCompletionChunk = (line: string) => {
  if (!line.startsWith('data:')) {
    return {
      done: false,
      contentPart: '',
    }
  }

  const payload = line.slice(5).trim()
  if (payload.length === 0) {
    return {
      done: false,
      contentPart: '',
    }
  }

  if (payload === '[DONE]') {
    return {
      done: true,
      contentPart: '',
    }
  }

  try {
    const chunk = JSON.parse(payload) as {
      choices?: Array<{
        delta?: { content?: string }
        message?: { content?: string }
      }>
      error?: { code?: string, message?: string }
    }

    if (chunk.error != null) {
      const errorCode = chunk.error.code ?? ''
      const errorMessage = chunk.error.message ?? ''
      throw new Error(`${errorCode} ${errorMessage}`.trim())
    }

    const contentPart = chunk.choices?.[0]?.delta?.content
      ?? chunk.choices?.[0]?.message?.content
      ?? ''

    return {
      done: false,
      contentPart,
    }
  } catch (error) {
    throw new Error(`Failed to parse stream chunk: ${payload}`)
  }
}

const readChatCompletionStream = async (params: {
  resp: Response
  onContent?: (content: string) => Promise<void>
}) => {
  const {resp, onContent} = params
  if (resp.body == null) {
    throw new Error('Readable stream is not available')
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let bufferedText = ''
  let mergedContent = ''

  while (true) {
    const {value, done} = await reader.read()
    if (done) {
      break
    }

    bufferedText += decoder.decode(value, {stream: true})
    const lines = bufferedText.split('\n')
    bufferedText = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (line.length === 0) {
        continue
      }

      const chunk = parseChatCompletionChunk(line)
      mergedContent += chunk.contentPart
      if (chunk.contentPart.length > 0 && onContent != null) {
        await onContent(mergedContent.trim())
      }
      if (chunk.done) {
        if (onContent != null) {
          await onContent(mergedContent.trim())
        }
        return buildStreamResponsePayload(mergedContent.trim())
      }
    }
  }

  const trailingLine = bufferedText.trim()
  if (trailingLine.length > 0) {
    const chunk = parseChatCompletionChunk(trailingLine)
    mergedContent += chunk.contentPart
  }

  if (onContent != null) {
    await onContent(mergedContent.trim())
  }

  return buildStreamResponsePayload(mergedContent.trim())
}

export const discoverModels = async (params: { serverUrl?: string, apiKey?: string }): Promise<ModelDiscoveryResult> => {
  const serverUrl = getServerUrl(params.serverUrl)
  const resp = await fetch(`${serverUrl}/models`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(typeof params.apiKey === 'string' && params.apiKey.length > 0 ? {Authorization: 'Bearer ' + params.apiKey} : {}),
    },
  })
  if (!resp.ok) {
    const errorMessage = await getErrorMessage(resp)
    throw new Error(errorMessage ?? `Failed to fetch model list: ${resp.status}`)
  }

  const data = await resp.json() as { data?: Array<{ id?: string }> }
  const modelSet = new Set<string>()
  for (const item of data.data ?? []) {
    if (typeof item.id === 'string' && item.id.trim().length > 0) {
      modelSet.add(item.id.trim())
    }
  }
  const models = [...modelSet]
  if (models.length === 0) {
    throw new Error('No models returned from server')
  }
  return {models}
}

export const repairSummaryJson = async (params: {
  serverUrl?: string
  apiKey?: string
  model?: string
  content: string
}) => {
  const serverUrl = getServerUrl(params.serverUrl)
  const resp = await fetch(`${serverUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(typeof params.apiKey === 'string' && params.apiKey.length > 0 ? {Authorization: 'Bearer ' + params.apiKey} : {}),
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        {
          role: 'system',
          content: SUMMARY_REPAIR_PROMPT,
        },
        {
          role: 'user',
          content: params.content,
        },
      ],
      temperature: 0,
      n: 1,
      stream: false,
    }),
  })

  if (!resp.ok) {
    const errorMessage = await getErrorMessage(resp)
    throw new Error(errorMessage ?? `Summary repair failed: ${resp.status}`)
  }

  const payload = await resp.json() as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { code?: string, message?: string }
  }
  const repairedContent = payload.choices?.[0]?.message?.content?.trim()
  if (typeof repairedContent === 'string' && repairedContent.length > 0) {
    return repairedContent
  }

  const errorCode = payload.error?.code ?? ''
  const errorMessage = payload.error?.message ?? ''
  const combinedErrorMessage = `${errorCode} ${errorMessage}`.trim()
  throw new Error(combinedErrorMessage.length > 0 ? combinedErrorMessage : 'Summary repair returned empty content')
}

export const handleChatCompleteTask = async (task: Task) => {
  const data = task.def.data
  const serverUrl = getServerUrl(task.def.serverUrl)
  const resp = await fetch(`${serverUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + task.def.extra.apiKey,
    },
    body: JSON.stringify(data),
  })
  if (!resp.ok) {
    const errorMessage = await getErrorMessage(resp)
    throw new Error(errorMessage ?? `Chat completion failed: ${resp.status}`)
  }

  const expectsStream = data?.stream === true
  const contentType = resp.headers.get('content-type')?.toLowerCase() ?? ''
  if (expectsStream && contentType.includes('text/event-stream')) {
    const summarySessionKey = task.def.extra?.summarySessionKey as string | undefined
    task.resp = await readChatCompletionStream({
      resp,
      onContent: async (content) => {
        if (typeof summarySessionKey === 'string' && summarySessionKey.length > 0) {
          await updateVideoSummaryStreaming({
            sessionKey: summarySessionKey,
            streamingContent: content,
          })
        }
      },
    })
  } else {
    task.resp = await resp.json()
  }

  const responsePayload = task.resp as {
    usage?: { total_tokens?: number }
    choices?: Array<{ message?: { content?: string } }>
    error?: { code?: string, message?: string }
  }

  const firstMessageContent = responsePayload.choices?.[0]?.message?.content?.trim()
  if (typeof firstMessageContent === 'string' && firstMessageContent.length > 0) {
    return true
  }

  if (responsePayload.usage != null) {
    return (responsePayload.usage.total_tokens ?? 0) > 0
  }

  const errorCode = responsePayload.error?.code ?? ''
  const errorMessage = responsePayload.error?.message ?? ''
  throw new Error(`${errorCode} ${errorMessage}`.trim())
}
