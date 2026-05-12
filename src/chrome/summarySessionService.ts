import {SUMMARY_SESSION_MAX_COUNT, SUMMARY_SESSION_RETENTION_MS} from '@/consts/const'
import {extractJsonObject, extractStreamingSummaryPreview} from '@/utils/bizUtil'

const SUMMARY_SESSION_STORAGE_PREFIX = 'makunabe_summary_session:'
const SUMMARY_SESSION_MAX_BYTES = 6 * 1024 * 1024
const STREAM_SAVE_INTERVAL_MS = 600
const streamPersistState = new Map<string, {
  lastSavedAt: number
  lastSavedContent: string
}>()

const getSummarySessionStorageKey = (sessionKey: string) => {
  return `${SUMMARY_SESSION_STORAGE_PREFIX}${sessionKey}`
}

const isValidStoredSession = (value: unknown): value is SummarySession => {
  if (value == null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (typeof record.sessionKey !== 'string' || record.sessionKey.length === 0) return false
  if (typeof record.createdAt !== 'number') return false
  if (typeof record.updatedAt !== 'number') return false
  if (record.segments == null || typeof record.segments !== 'object') return false
  if (record.videoMeta == null || typeof record.videoMeta !== 'object') return false
  return true
}

const listStoredSummarySessions = async (): Promise<Array<{storageKey: string, session: SummarySession}>> => {
  const result = await chrome.storage.local.get(null)
  const sessions: Array<{storageKey: string, session: SummarySession}> = []

  for (const [storageKey, rawValue] of Object.entries(result)) {
    if (!storageKey.startsWith(SUMMARY_SESSION_STORAGE_PREFIX) || typeof rawValue !== 'string' || rawValue.length === 0) {
      continue
    }

    try {
      const parsed: unknown = JSON.parse(rawValue)
      if (!isValidStoredSession(parsed)) {
        console.error('Stored summary session has invalid shape, removing', storageKey)
        await chrome.storage.local.remove(storageKey)
        continue
      }
      sessions.push({
        storageKey,
        session: parsed,
      })
    } catch (error) {
      console.error('Failed to parse stored summary session during cleanup', storageKey, error)
      await chrome.storage.local.remove(storageKey)
    }
  }

  return sessions
}

export const cleanupSummarySessions = async (params?: {keepSessionKey?: string}) => {
  const keepSessionKey = params?.keepSessionKey
  const keepStorageKey = typeof keepSessionKey === 'string' && keepSessionKey.length > 0
    ? getSummarySessionStorageKey(keepSessionKey)
    : undefined
  const sessions = await listStoredSummarySessions()
  const now = Date.now()
  const keysToDelete = new Set<string>()

  for (const item of sessions) {
    if (item.storageKey === keepStorageKey) {
      continue
    }

    if (item.session.updatedAt < now - SUMMARY_SESSION_RETENTION_MS) {
      keysToDelete.add(item.storageKey)
    }
  }

  const isPendingEmail = (item: {session: SummarySession}) => item.session.email?.status === 'pending'

  const activeSessions = sessions
    .filter(item => !keysToDelete.has(item.storageKey) && item.storageKey !== keepStorageKey)
    .sort((left, right) => right.session.updatedAt - left.session.updatedAt)

  const overflowSessions = activeSessions.slice(Math.max(0, SUMMARY_SESSION_MAX_COUNT - (keepStorageKey != null ? 1 : 0)))
  for (const item of overflowSessions) {
    if (isPendingEmail(item)) continue
    keysToDelete.add(item.storageKey)
  }

  // Byte-budget pruning: oldest first, skip kept session and pending-email sessions.
  const survivors = activeSessions.filter(item => !keysToDelete.has(item.storageKey))
  let totalBytes = survivors.reduce((sum, item) => sum + JSON.stringify(item.session).length * 2, 0)
  if (totalBytes > SUMMARY_SESSION_MAX_BYTES) {
    const oldestFirst = [...survivors].sort((left, right) => left.session.updatedAt - right.session.updatedAt)
    for (const item of oldestFirst) {
      if (totalBytes <= SUMMARY_SESSION_MAX_BYTES) break
      if (isPendingEmail(item)) continue
      keysToDelete.add(item.storageKey)
      totalBytes -= JSON.stringify(item.session).length * 2
    }
  }

  if (keysToDelete.size > 0) {
    await chrome.storage.local.remove([...keysToDelete])
  }
}

export const clearSummarySessions = async () => {
  const sessions = await listStoredSummarySessions()
  const storageKeys = sessions.map(item => item.storageKey)

  if (storageKeys.length > 0) {
    await chrome.storage.local.remove(storageKeys)
  }

  return {
    deletedCount: storageKeys.length,
  }
}

const loadSummarySession = async (sessionKey: string): Promise<SummarySession | undefined> => {
  const storageKey = getSummarySessionStorageKey(sessionKey)
  const result = await chrome.storage.local.get(storageKey)
  const rawValue = result?.[storageKey]

  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    return undefined
  }

  try {
    const parsed: unknown = JSON.parse(rawValue)
    if (!isValidStoredSession(parsed)) {
      console.error('Stored summary session has invalid shape, removing', sessionKey)
      await chrome.storage.local.remove(storageKey)
      return undefined
    }
    return parsed
  } catch (error) {
    console.error('Failed to parse summary session from storage', sessionKey, error)
    await chrome.storage.local.remove(storageKey)
    return undefined
  }
}

export const saveSummarySession = async (session: SummarySession) => {
  const storageKey = getSummarySessionStorageKey(session.sessionKey)
  await chrome.storage.local.set({
    [storageKey]: JSON.stringify(session),
  })
  await cleanupSummarySessions({
    keepSessionKey: session.sessionKey,
  })
}

export const parseSummaryContentStrict = (content?: string) => {
  if (typeof content !== 'string' || content.trim().length === 0) {
    return {
      content: undefined,
      error: 'Empty summary response',
    }
  }

  const normalizedContent = extractJsonObject(content)

  try {
    return {
      content: JSON.parse(normalizedContent),
      error: undefined,
    }
  } catch (error) {
    return {
      content: undefined,
      error: 'Invalid JSON summary response',
    }
  }
}

const parseSummaryContent = (content?: string) => {
  if (typeof content !== 'string' || content.trim().length === 0) {
    return {
      content: undefined,
      error: 'Empty summary response',
    }
  }

  const strictResult = parseSummaryContentStrict(content)
  if (strictResult.error == null) {
    return strictResult
  }

  const summaryPreview = extractStreamingSummaryPreview(content)
  if (summaryPreview.length > 0) {
    return {
      content: {
        summary: summaryPreview,
      },
      error: undefined,
    }
  }

  return strictResult
}

export const upsertSummarySession = async (input: SummarySessionSyncInput): Promise<SummarySession> => {
  const existingSession = await loadSummarySession(input.sessionKey)
  const now = Date.now()
  const nextSegments: SummarySession['segments'] = {}

  for (const segment of input.segments) {
    nextSegments[String(segment.startIdx)] = {
      startIdx: segment.startIdx,
      endIdx: segment.endIdx,
      text: segment.text,
      firstFrom: segment.firstFrom,
      lastTo: segment.lastTo,
      updatedAt: now,
    }
  }

  const nextSession: SummarySession = {
    sessionKey: input.sessionKey,
    createdAt: existingSession?.createdAt ?? now,
    updatedAt: now,
    runStartedAt: existingSession?.runStartedAt,
    email: existingSession?.email,
    videoSummary: existingSession?.videoSummary,
    videoMeta: {
      ...existingSession?.videoMeta,
      ...input.videoMeta,
    },
    fullText: input.fullText,
    segmentCount: input.segments.length,
    segments: nextSegments,
  }

  await saveSummarySession(nextSession)

  return nextSession
}

export const getSummarySession = async (sessionKey: string) => {
  return await loadSummarySession(sessionKey)
}

export const markVideoSummaryPending = async (params: {
  sessionKey: string
  runStartedAt: number
  recoveryStage?: SummaryRecoveryStage
}) => {
  const session = await loadSummarySession(params.sessionKey)
  if (session == null) {
    throw new Error(`Summary session not found: ${params.sessionKey}`)
  }

  const now = Date.now()
  session.runStartedAt = params.runStartedAt
  session.updatedAt = now
  session.videoSummary = {
    summary: {
      type: 'brief',
      status: 'pending',
      streamingContent: '',
      recoveryStage: params.recoveryStage ?? 'generating',
    },
    updatedAt: now,
  }

  await saveSummarySession(session)
}

export const updateVideoSummaryStage = async (params: {
  sessionKey: string
  recoveryStage: SummaryRecoveryStage
  clearStreamingContent?: boolean
}) => {
  const session = await loadSummarySession(params.sessionKey)
  if (session == null) {
    throw new Error(`Summary session not found: ${params.sessionKey}`)
  }

  const now = Date.now()
  session.updatedAt = now
  session.videoSummary = {
    summary: {
      type: 'brief',
      status: 'pending',
      recoveryStage: params.recoveryStage,
      streamingContent: params.clearStreamingContent === true ? '' : (session.videoSummary?.summary?.streamingContent ?? ''),
    },
    updatedAt: now,
  }

  await saveSummarySession(session)
}

export const updateVideoSummaryStreaming = async (params: {
  sessionKey: string
  streamingContent: string
  force?: boolean
}) => {
  const streamKey = `${params.sessionKey}:video`
  const state = streamPersistState.get(streamKey)
  const now = Date.now()
  if (params.force !== true && state != null) {
    if (state.lastSavedContent === params.streamingContent) {
      return
    }
    if (now - state.lastSavedAt < STREAM_SAVE_INTERVAL_MS) {
      return
    }
  }

  const session = await loadSummarySession(params.sessionKey)
  if (session == null) {
    throw new Error(`Summary session not found: ${params.sessionKey}`)
  }

  session.updatedAt = now
  session.videoSummary = {
    summary: {
      type: 'brief',
      status: 'pending',
      streamingContent: params.streamingContent,
      recoveryStage: session.videoSummary?.summary?.recoveryStage ?? 'generating',
    },
    updatedAt: now,
  }

  await saveSummarySession(session)
  streamPersistState.set(streamKey, {
    lastSavedAt: now,
    lastSavedContent: params.streamingContent,
  })
}

export const finalizeVideoSummary = async (params: {
  sessionKey: string
  content?: string
  taskError?: string
}) => {
  const session = await loadSummarySession(params.sessionKey)
  if (session == null) {
    throw new Error(`Summary session not found: ${params.sessionKey}`)
  }

  const now = Date.now()
  let nextError = params.taskError
  let nextContent: any

  if (nextError == null) {
    const parsed = parseSummaryContent(params.content)
    nextError = parsed.error
    nextContent = parsed.content
  }

  session.updatedAt = now
  session.videoSummary = {
    summary: {
      type: 'brief',
      status: 'done',
      content: nextContent,
      error: nextError,
      streamingContent: undefined,
      recoveryStage: undefined,
    },
    updatedAt: now,
  }

  await saveSummarySession(session)
  streamPersistState.delete(`${params.sessionKey}:video`)
}
