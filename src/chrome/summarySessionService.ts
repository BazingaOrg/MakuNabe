import {SUMMARY_SESSION_MAX_COUNT, SUMMARY_SESSION_RETENTION_MS} from '@/consts/const'
import {extractJsonObject, extractStreamingSummaryPreview} from '@/utils/bizUtil'

const SUMMARY_SESSION_STORAGE_PREFIX = 'makunabe_summary_session:'
const STREAM_SAVE_INTERVAL_MS = 600
const streamPersistState = new Map<string, {
  lastSavedAt: number
  lastSavedContent: string
}>()

const getSummarySessionStorageKey = (sessionKey: string) => {
  return `${SUMMARY_SESSION_STORAGE_PREFIX}${sessionKey}`
}

const listStoredSummarySessions = async (): Promise<Array<{storageKey: string, session: SummarySession}>> => {
  const result = await chrome.storage.local.get(null)
  const sessions: Array<{storageKey: string, session: SummarySession}> = []

  for (const [storageKey, rawValue] of Object.entries(result)) {
    if (!storageKey.startsWith(SUMMARY_SESSION_STORAGE_PREFIX) || typeof rawValue !== 'string' || rawValue.length === 0) {
      continue
    }

    try {
      sessions.push({
        storageKey,
        session: JSON.parse(rawValue) as SummarySession,
      })
    } catch (error) {
      console.error('Failed to parse stored summary session during cleanup', storageKey, error)
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

  const activeSessions = sessions
    .filter(item => !keysToDelete.has(item.storageKey) && item.storageKey !== keepStorageKey)
    .sort((left, right) => right.session.updatedAt - left.session.updatedAt)

  const overflowSessions = activeSessions.slice(Math.max(0, SUMMARY_SESSION_MAX_COUNT - (keepStorageKey != null ? 1 : 0)))
  for (const item of overflowSessions) {
    keysToDelete.add(item.storageKey)
  }

  if (keysToDelete.size > 0) {
    await chrome.storage.local.remove([...keysToDelete])
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
    return JSON.parse(rawValue) as SummarySession
  } catch (error) {
    console.error('Failed to parse summary session from storage', sessionKey, error)
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
    const segmentKey = String(segment.startIdx)
    const existingSegment = existingSession?.segments?.[segmentKey]

    nextSegments[segmentKey] = {
      startIdx: segment.startIdx,
      endIdx: segment.endIdx,
      text: segment.text,
      firstFrom: segment.firstFrom,
      lastTo: segment.lastTo,
      summary: existingSegment?.summary,
      updatedAt: existingSegment?.updatedAt ?? now,
    }
  }

  const nextSession: SummarySession = {
    sessionKey: input.sessionKey,
    createdAt: existingSession?.createdAt ?? now,
    updatedAt: now,
    runStartedAt: existingSession?.runStartedAt,
    email: existingSession?.email,
    videoMeta: {
      ...existingSession?.videoMeta,
      ...input.videoMeta,
    },
    segmentCount: input.segments.length,
    segments: nextSegments,
  }

  await saveSummarySession(nextSession)

  return nextSession
}

export const getSummarySession = async (sessionKey: string) => {
  return await loadSummarySession(sessionKey)
}

export const markSummarySegmentPending = async (params: {
  sessionKey: string
  segmentStartIdx: number
  runStartedAt: number
  recoveryStage?: SummaryRecoveryStage
}) => {
  const session = await loadSummarySession(params.sessionKey)
  if (session == null) {
    throw new Error(`Summary session not found: ${params.sessionKey}`)
  }

  const segmentKey = String(params.segmentStartIdx)
  const existingSegment = session.segments[segmentKey]
  if (existingSegment == null) {
    throw new Error(`Summary segment not found: ${params.segmentStartIdx}`)
  }

  const now = Date.now()
  session.runStartedAt = params.runStartedAt
  session.updatedAt = now
  session.segments[segmentKey] = {
    ...existingSegment,
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

export const updateSummarySegmentStage = async (params: {
  sessionKey: string
  segmentStartIdx: number
  recoveryStage: SummaryRecoveryStage
  clearStreamingContent?: boolean
}) => {
  const session = await loadSummarySession(params.sessionKey)
  if (session == null) {
    throw new Error(`Summary session not found: ${params.sessionKey}`)
  }

  const segmentKey = String(params.segmentStartIdx)
  const existingSegment = session.segments[segmentKey]
  if (existingSegment == null) {
    throw new Error(`Summary segment not found: ${params.segmentStartIdx}`)
  }

  const now = Date.now()
  session.updatedAt = now
  session.segments[segmentKey] = {
    ...existingSegment,
    summary: {
      type: 'brief',
      status: 'pending',
      recoveryStage: params.recoveryStage,
      streamingContent: params.clearStreamingContent === true ? '' : (existingSegment.summary?.streamingContent ?? ''),
    },
    updatedAt: now,
  }

  await saveSummarySession(session)
}

export const updateSummarySegmentStreaming = async (params: {
  sessionKey: string
  segmentStartIdx: number
  streamingContent: string
  force?: boolean
}) => {
  const streamKey = `${params.sessionKey}:${params.segmentStartIdx}`
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

  const segmentKey = String(params.segmentStartIdx)
  const existingSegment = session.segments[segmentKey]
  if (existingSegment == null) {
    throw new Error(`Summary segment not found: ${params.segmentStartIdx}`)
  }

  session.updatedAt = now
  session.segments[segmentKey] = {
    ...existingSegment,
    summary: {
      type: 'brief',
      status: 'pending',
      streamingContent: params.streamingContent,
      recoveryStage: existingSegment.summary?.recoveryStage ?? 'generating',
    },
    updatedAt: now,
  }

  await saveSummarySession(session)
  streamPersistState.set(streamKey, {
    lastSavedAt: now,
    lastSavedContent: params.streamingContent,
  })
}

export const finalizeSummarySegment = async (params: {
  sessionKey: string
  segmentStartIdx: number
  content?: string
  taskError?: string
}) => {
  const session = await loadSummarySession(params.sessionKey)
  if (session == null) {
    throw new Error(`Summary session not found: ${params.sessionKey}`)
  }

  const segmentKey = String(params.segmentStartIdx)
  const existingSegment = session.segments[segmentKey]
  if (existingSegment == null) {
    throw new Error(`Summary segment not found: ${params.segmentStartIdx}`)
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
  session.segments[segmentKey] = {
    ...existingSegment,
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
  streamPersistState.delete(`${params.sessionKey}:${params.segmentStartIdx}`)
}
