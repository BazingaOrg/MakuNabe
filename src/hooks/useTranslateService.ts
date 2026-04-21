import {useAppDispatch, useAppSelector} from './redux'
import {useInterval, useMemoizedFn} from 'ahooks'
import { buildSummarySessionKey, buildSummarySessionSyncInput, isSummaryEmpty } from '@/utils/bizUtil'
import { useMessage } from './useMessageService'
import toast from 'react-hot-toast'
import { syncSummarySessionState } from '@/redux/envReducer'
import { createElement, useEffect, useMemo, useRef } from 'react'
import {logMessagingError} from '@/utils/messageError'

/**
 * Service是单例，类似后端的服务概念
 */
const useTranslateService = () => {
  const emailToastIdPrefix = 'summary-email-status-'
  const summaryDoneToastIdPrefix = 'summary-done-status-'
  const summaryDoneVideoKeyRef = useRef<string | undefined>(undefined)
  const emailStatusToastKeyRef = useRef<string | undefined>(undefined)
  const dispatch = useAppDispatch()
  const envData = useAppSelector(state => state.env.envData)
  const segments = useAppSelector(state => state.env.segments)
  const url = useAppSelector(state => state.env.url)
  const title = useAppSelector(state => state.env.title)
  const ctime = useAppSelector(state => state.env.ctime)
  const author = useAppSelector(state => state.env.author)
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
      segments,
    })
  }, [author, ctime, summarySessionKey, summarySessionShapeKey, title, url])

  const showDismissibleToast = useMemoizedFn((params: {
    id: string
    message: string
    icon: '✅' | '❌'
  }) => {
    const {id, message, icon} = params
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
      duration: Infinity,
      icon,
    })
  })

  const notifySummarySession = useMemoizedFn((session?: SummarySession) => {
    if (session == null) {
      return
    }

    const runKey = `${session.sessionKey}|${session.runStartedAt ?? ''}`
    const orderedSegments = Object.values(session.segments)
    const allSummaryDone = orderedSegments.length > 0 && orderedSegments.every((segment) => segment.summary?.status === 'done')
    if (allSummaryDone && summaryDoneVideoKeyRef.current !== runKey) {
      summaryDoneVideoKeyRef.current = runKey
      showDismissibleToast({
        id: `${summaryDoneToastIdPrefix}${runKey}`,
        icon: '✅',
        message: '当前视频分段总结已全部完成（点击可关闭）',
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
      emailStatusToastKeyRef.current = emailToastKey
      showDismissibleToast({
        id: `${emailToastIdPrefix}${runKey}`,
        icon: emailState.error != null ? '❌' : '✅',
        message: emailState.error != null
          ? '没有可发送的有效总结，已跳过自动邮件（点击可关闭）'
          : '总结邮件发送成功（点击可关闭）',
      })
    } else if (emailState.status === 'failed') {
      emailStatusToastKeyRef.current = emailToastKey
      showDismissibleToast({
        id: `${emailToastIdPrefix}${runKey}`,
        icon: '❌',
        message: `总结邮件发送失败：${emailState.error ?? '未知错误'}（点击可关闭）`,
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
