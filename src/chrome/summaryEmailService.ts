import {SUMMARY_EMAIL_PENDING_TIMEOUT_MS, STORAGE_ENV} from '@/consts/const'
import {saveSummarySession, getSummarySession} from './summarySessionService'
import {getTimeDisplay} from '@/utils/bizUtil'
import dayjs from 'dayjs'

const SUMMARY_EMAIL_RETRY_PREFIX = 'makunabe-summary-email-retry:'
const SUMMARY_EMAIL_RETRY_DELAY_MS = 10 * 1000

const getRetryAlarmName = (sessionKey: string) => {
  return `${SUMMARY_EMAIL_RETRY_PREFIX}${sessionKey}`
}

const sendSummaryEmailRequest = async (webhookUrl: string, payload: Record<string, unknown>) => {
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
    } catch (error) {
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

const loadEnvData = async (): Promise<EnvData> => {
  const result = await chrome.storage.sync.get(STORAGE_ENV)
  const rawValue = result?.[STORAGE_ENV]

  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    return {}
  }

  try {
    return JSON.parse(rawValue) as EnvData
  } catch (error) {
    console.error('Failed to parse env data for summary email', error)
    return {}
  }
}

const buildSummaryEmailPayload = (session: SummarySession) => {
  const orderedSegments = Object.values(session.segments).sort((left, right) => left.startIdx - right.startIdx)
  const lines: string[] = []
  let successCount = 0
  let failedCount = 0

  for (const segment of orderedSegments) {
    const summary = segment.summary
    const summaryText = summary?.content?.summary

    if (summary?.status === 'done' && summary?.error == null && typeof summaryText === 'string' && summaryText.trim().length > 0) {
      lines.push(summaryText.trim())
      successCount++
      continue
    }

    failedCount++
    if (typeof segment.firstFrom === 'number') {
      lines.push(`${getTimeDisplay(segment.firstFrom)} 未总结`)
    } else {
      lines.push('未总结')
    }
  }

  const publishedAt = session.videoMeta.ctime != null
    ? dayjs(session.videoMeta.ctime * 1000).format('YYYY-MM-DD HH:mm:ss')
    : ''

  return {
    markdown: lines.join('\n').trim(),
    publishedAt,
    stats: {
      total: orderedSegments.length,
      success: successCount,
      failed: failedCount,
    },
  }
}

const scheduleRetryAlarm = async (sessionKey: string, when: number) => {
  await chrome.alarms.create(getRetryAlarmName(sessionKey), {
    when,
  })
}

const clearRetryAlarm = async (sessionKey: string) => {
  await chrome.alarms.clear(getRetryAlarmName(sessionKey))
}

export const retrySummaryEmailFromAlarm = async (alarmName: string) => {
  if (!alarmName.startsWith(SUMMARY_EMAIL_RETRY_PREFIX)) {
    return
  }

  const sessionKey = alarmName.slice(SUMMARY_EMAIL_RETRY_PREFIX.length)
  await ensureSummaryEmailSent(sessionKey)
}

export const ensureSummaryEmailSent = async (sessionKey: string) => {
  const session = await getSummarySession(sessionKey)
  if (session == null) {
    return
  }

  const envData = await loadEnvData()
  if (envData.emailAutoSendEnabled !== true) {
    return
  }

  const emailRecipient = envData.emailRecipient?.trim() ?? ''
  const emailWebhookUrl = envData.emailWebhookUrl?.trim() ?? ''
  if (emailRecipient.length === 0 || emailWebhookUrl.length === 0) {
    return
  }

  const runStartedAt = session.runStartedAt
  if (typeof runStartedAt !== 'number') {
    return
  }

  if (session.email?.lastSentRunStartedAt === runStartedAt) {
    await clearRetryAlarm(sessionKey)
    return
  }

  if (session.email?.status === 'pending') {
    const lastAttemptAt = session.email.lastAttemptAt ?? 0
    if (Date.now() - lastAttemptAt < SUMMARY_EMAIL_PENDING_TIMEOUT_MS) {
      return
    }

    const retryAt = Date.now()
    session.email = {
      ...session.email,
      status: 'failed',
      retryAt,
      error: 'Recovered stale pending email job after worker restart',
    }
    session.updatedAt = Date.now()
    await saveSummarySession(session)
    await scheduleRetryAlarm(sessionKey, retryAt)
  }

  if (session.email?.retryAt != null && Date.now() < session.email.retryAt) {
    await scheduleRetryAlarm(sessionKey, session.email.retryAt)
    return
  }

  const orderedSegments = Object.values(session.segments)
  if (orderedSegments.length === 0) {
    return
  }

  const allSummaryDone = orderedSegments.every((segment) => segment.summary?.status === 'done')
  if (!allSummaryDone) {
    return
  }

  const payload = buildSummaryEmailPayload(session)
  if (payload.stats.success === 0) {
    session.email = {
      status: 'done',
      lastAttemptAt: Date.now(),
      lastSentRunStartedAt: runStartedAt,
      error: 'No valid summaries to send',
      attemptCount: session.email?.attemptCount ?? 0,
    }
    session.updatedAt = Date.now()
    await saveSummarySession(session)
    await clearRetryAlarm(sessionKey)
    return
  }

  const configuredSubjectTemplate = envData.emailSubjectTemplate?.trim()
  const subjectTemplate = configuredSubjectTemplate != null && configuredSubjectTemplate.length > 0
    ? configuredSubjectTemplate
    : '[MakuNabe Summary] {{title}}'
  const subject = subjectTemplate
    .replaceAll('{{title}}', session.videoMeta.title ?? 'Untitled')
    .replaceAll('{{author}}', session.videoMeta.author ?? '')
    .replaceAll('{{date}}', payload.publishedAt)

  session.email = {
    ...session.email,
    status: 'pending',
    lastAttemptAt: Date.now(),
    retryAt: undefined,
    error: undefined,
    attemptCount: (session.email?.attemptCount ?? 0) + 1,
  }
  session.updatedAt = Date.now()
  await saveSummarySession(session)

  try {
    await sendSummaryEmailRequest(emailWebhookUrl, {
      to: emailRecipient,
      subject,
      markdown: payload.markdown,
      videoMeta: {
        title: session.videoMeta.title ?? '',
        url: session.videoMeta.url ?? '',
        author: session.videoMeta.author ?? '',
        publishedAt: payload.publishedAt,
      },
      segmentsStats: payload.stats,
    })

    session.email = {
      ...session.email,
      status: 'done',
      lastSentRunStartedAt: runStartedAt,
      retryAt: undefined,
      error: undefined,
    }
    session.updatedAt = Date.now()
    await saveSummarySession(session)
    await clearRetryAlarm(sessionKey)
  } catch (error: any) {
    const retryAt = Date.now() + SUMMARY_EMAIL_RETRY_DELAY_MS
    session.email = {
      ...session.email,
      status: 'failed',
      retryAt,
      error: error?.name === 'AbortError' ? 'Webhook request timeout' : (error?.message ?? 'Unknown webhook error'),
    }
    session.updatedAt = Date.now()
    await saveSummarySession(session)
    await scheduleRetryAlarm(sessionKey, retryAt)
  }
}
