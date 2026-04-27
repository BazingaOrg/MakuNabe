import {useAppDispatch, useAppSelector} from './redux'
import {useInterval, useMemoizedFn} from 'ahooks'
import { buildSummarySessionKey, buildSummarySessionSyncInput, getWholeText, isSummaryEmpty } from '@/utils/bizUtil'
import { useMessage } from './useMessageService'
import toast from 'react-hot-toast'
import { syncSummarySessionState } from '@/redux/envReducer'
import { createElement, useEffect, useMemo, useRef } from 'react'
import {logMessagingError} from '@/utils/messageError'

const SUMMARY_SUCCESS_TOAST_DURATION_MS = 8000
const EMAIL_SUCCESS_TOAST_DURATION_MS = 8000

const getToastVideoLabel = (session: SummarySession) => {
  const title = session.videoMeta.title?.trim()
  if (title == null || title.length === 0) {
    return '当前视频'
  }

  return `《${title.length > 32 ? `${title.slice(0, 32)}...` : title}》`
}

/**
 * Service是单例，类似后端的服务概念
 */
const useTranslateService = () => {
  const emailToastIdPrefix = 'summary-email-status-'
  const summaryDoneToastIdPrefix = 'summary-done-status-'
  const summaryDoneVideoKeyRef = useRef<string | undefined>(undefined)
  const emailStatusToastKeyRef = useRef<string | undefined>(undefined)
  const activeSummaryDoneToastIdRef = useRef<string | undefined>(undefined)
  const activeEmailToastIdRef = useRef<string | undefined>(undefined)
  const previousSummarySessionKeyRef = useRef<string | undefined>(undefined)
  const dispatch = useAppDispatch()
  const envData = useAppSelector(state => state.env.envData)
  const segments = useAppSelector(state => state.env.segments)
  const url = useAppSelector(state => state.env.url)
  const title = useAppSelector(state => state.env.title)
  const ctime = useAppSelector(state => state.env.ctime)
  const author = useAppSelector(state => state.env.author)
  const transcript = useAppSelector(state => state.env.data)
  const {sendExtension} = useMessage(Boolean(envData.sidePanel))
  const summarySessionShapeKey = useMemo(() => {
    return (segments ?? []).map((segment) => `${segment.startIdx}:${segment.endIdx}:${segment.text}`).join('|')
  }, [segments])
  const summarySessionKey = useMemo(() => buildSummarySessionKey({
    url,
    ctime,
    segmentCount: segments?.length,
    segmentShapeKey: summarySessionShapeKey,
  }), [ctime, segments?.length, summarySessionShapeKey, url])
  const summarySessionSyncInput = useMemo(() => {
    if (segments == null || segments.length === 0) {
      return undefined
    }

    return buildSummarySessionSyncInput({
      sessionKey: summarySessionKey,
      url,
      title,
      ctime,
      author,
      fullText: getWholeText((transcript?.body ?? []).map((item) => item.content)),
      segments,
    })
  }, [author, ctime, summarySessionKey, title, transcript?.body, url, segments])

  const showDismissibleToast = useMemoizedFn((params: {
    id: string
    message: string
    icon: '✅' | '❌'
    duration?: number
  }) => {
    const {id, message, icon, duration = Infinity} = params
    toast((toastInstance) => createElement('div', {
      onClick: () => toast.dismiss(toastInstance.id),
      style: {cursor: 'pointer'},
      role: 'button',
      tabIndex: 0,
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          toast.dismiss(toastInstance.id)
        }
      },
    }, message), {
      id,
      duration,
      icon,
    })
  })

  const notifySummarySession = useMemoizedFn((session?: SummarySession) => {
    if (session == null) {
      return
    }

    const runKey = `${session.sessionKey}|${session.runStartedAt ?? ''}`
    const videoLabel = getToastVideoLabel(session)
    const allSummaryDone = session.videoSummary?.summary != null
      && session.videoSummary.summary.status === 'done'
      && !isSummaryEmpty(session.videoSummary.summary)
    if (allSummaryDone && summaryDoneVideoKeyRef.current !== runKey) {
      const toastId = `${summaryDoneToastIdPrefix}${runKey}`
      summaryDoneVideoKeyRef.current = runKey
      activeSummaryDoneToastIdRef.current = toastId
      showDismissibleToast({
        id: toastId,
        icon: '✅',
        message: `${videoLabel}全文总结已完成（点击可关闭）`,
        duration: SUMMARY_SUCCESS_TOAST_DURATION_MS,
      })
    }

    const emailState = session.email
    if (emailState == null) {
      return
    }

    const emailToastKey = `${runKey}|${emailState.status}|${emailState.error ?? ''}`
    if (emailStatusToastKeyRef.current === emailToastKey) {
      return
    }

    if (emailState.status === 'done' && emailState.lastSentRunStartedAt === session.runStartedAt) {
      const toastId = `${emailToastIdPrefix}${runKey}`
      emailStatusToastKeyRef.current = emailToastKey
      activeEmailToastIdRef.current = toastId
      showDismissibleToast({
        id: toastId,
        icon: emailState.error != null ? '❌' : '✅',
        message: emailState.error != null
          ? `${videoLabel}没有可发送的有效总结，已跳过自动邮件（点击可关闭）`
          : `${videoLabel}总结邮件发送成功（点击可关闭）`,
        duration: emailState.error != null ? Infinity : EMAIL_SUCCESS_TOAST_DURATION_MS,
      })
    } else if (emailState.status === 'failed') {
      const toastId = `${emailToastIdPrefix}${runKey}`
      emailStatusToastKeyRef.current = emailToastKey
      activeEmailToastIdRef.current = toastId
      showDismissibleToast({
        id: toastId,
        icon: '❌',
        message: `${videoLabel}总结邮件发送失败：${emailState.error ?? '未知错误'}（点击可关闭）`,
      })
    }
  })

  const syncSummarySession = useMemoizedFn(async () => {
    if (segments == null || segments.length === 0) {
      return
    }

    const session = await sendExtension(null, 'GET_SUMMARY_SESSION', {
      sessionKey: summarySessionKey,
    })
    dispatch(syncSummarySessionState({session}))
    notifySummarySession(session)
  })

  useEffect(() => {
    if (previousSummarySessionKeyRef.current == null) {
      previousSummarySessionKeyRef.current = summarySessionKey
      return
    }

    if (previousSummarySessionKeyRef.current === summarySessionKey) {
      return
    }

    if (activeSummaryDoneToastIdRef.current != null) {
      toast.dismiss(activeSummaryDoneToastIdRef.current)
      activeSummaryDoneToastIdRef.current = undefined
    }
    if (activeEmailToastIdRef.current != null) {
      toast.dismiss(activeEmailToastIdRef.current)
      activeEmailToastIdRef.current = undefined
    }
    summaryDoneVideoKeyRef.current = undefined
    emailStatusToastKeyRef.current = undefined
    previousSummarySessionKeyRef.current = summarySessionKey
  }, [summarySessionKey])

  useEffect(() => {
    if (summarySessionSyncInput == null) {
      return
    }

    sendExtension(null, 'UPSERT_SUMMARY_SESSION', {
      input: summarySessionSyncInput,
    }).then((session) => {
      dispatch(syncSummarySessionState({session}))
      notifySummarySession(session)
    }).catch((error) => {
      logMessagingError('UPSERT_SUMMARY_SESSION', error)
    })
  }, [dispatch, notifySummarySession, sendExtension, summarySessionSyncInput])

  // 每0.5秒检测获取结果
  useInterval(async () => {
    try {
      await syncSummarySession()
    } catch (error) {
      logMessagingError('TRANSLATE_SERVICE_INTERVAL', error)
    }
  }, 500)
}

export default useTranslateService
