import {useAppDispatch, useAppSelector} from './redux'
import {useInterval, useMemoizedFn} from 'ahooks'
import useTranslate from './useTranslate'
import { buildSummaryEmailMarkdown, isSummaryEmpty } from '@/utils/bizUtil'
import { useMessage } from './useMessageService'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { setTempData } from '@/redux/envReducer'
import { useRef } from 'react'
import {logMessagingError} from '@/utils/messageError'

/**
 * Service是单例，类似后端的服务概念
 */
const useTranslateService = () => {
  const emailToastIdPrefix = 'summary-email-status-'
  const summaryDoneToastIdPrefix = 'summary-done-status-'
  const sendingVideoKeyRef = useRef<string | undefined>(undefined)
  const summaryDoneVideoKeyRef = useRef<string | undefined>(undefined)
  const retryAtMapRef = useRef<Record<string, number>>({})
  const lastErrorToastAtRef = useRef<number>(0)
  const dispatch = useAppDispatch()
  const taskIds = useAppSelector(state => state.env.taskIds)
  const envData = useAppSelector(state => state.env.envData)
  const tempData = useAppSelector(state => state.env.tempData)
  const segments = useAppSelector(state => state.env.segments)
  const url = useAppSelector(state => state.env.url)
  const title = useAppSelector(state => state.env.title)
  const ctime = useAppSelector(state => state.env.ctime)
  const author = useAppSelector(state => state.env.author)
  const lastSummarizeTime = useAppSelector(state => state.env.lastSummarizeTime)
  const {getTask} = useTranslate()
  const {sendExtension} = useMessage(Boolean(envData.sidePanel))

  const tryAutoSendSummaryEmail = useMemoizedFn(async () => {
    if (envData.emailAutoSendEnabled !== true) {
      return
    }
    const emailRecipient = envData.emailRecipient?.trim() ?? ''
    const emailWebhookUrl = envData.emailWebhookUrl?.trim() ?? ''
    if (emailRecipient.length === 0 || emailWebhookUrl.length === 0) {
      return
    }
    if (segments == null || segments.length === 0) {
      return
    }

    const videoKey = `${url ?? ''}|${ctime ?? ''}|${segments.length}|${lastSummarizeTime ?? ''}`
    if (tempData.summaryEmailSentVideoKey === videoKey) {
      return
    }
    if (sendingVideoKeyRef.current === videoKey) {
      return
    }
    const retryAt = retryAtMapRef.current[videoKey]
    if (retryAt != null && Date.now() < retryAt) {
      return
    }

    const allSummaryDone = segments.every((segment) => segment.summaries.brief?.status === 'done')
    if (!allSummaryDone) {
      return
    }
    if (summaryDoneVideoKeyRef.current !== videoKey) {
      summaryDoneVideoKeyRef.current = videoKey
      toast.success('当前视频分段总结已全部完成（点击可关闭）', {
        id: `${summaryDoneToastIdPrefix}${videoKey}`,
        duration: Infinity,
      })
    }

    const hasSuccessSummary = segments.some((segment) => {
      const summary = segment.summaries.brief
      return summary?.status === 'done' && summary.error == null && !isSummaryEmpty(summary)
    })
    if (!hasSuccessSummary) {
      dispatch(setTempData({ summaryEmailSentVideoKey: videoKey }))
      toast.error('没有可发送的有效总结，已跳过自动邮件（点击可关闭）', {
        id: `${emailToastIdPrefix}${videoKey}`,
        duration: Infinity,
      })
      return
    }

    const publishedAt = ctime != null ? dayjs(ctime * 1000).format('YYYY-MM-DD HH:mm:ss') : ''
    const email = buildSummaryEmailMarkdown({
      segments,
    })
    const configuredSubjectTemplate = envData.emailSubjectTemplate?.trim()
    const subjectTemplate = configuredSubjectTemplate != null && configuredSubjectTemplate.length > 0
      ? configuredSubjectTemplate
      : '[MakuNabe Summary] {{title}}'
    const subject = subjectTemplate
      .replaceAll('{{title}}', title ?? 'Untitled')
      .replaceAll('{{author}}', author ?? '')
      .replaceAll('{{date}}', publishedAt)

    sendingVideoKeyRef.current = videoKey
    try {
      const response = await sendExtension(null, 'SEND_SUMMARY_EMAIL', {
        webhookUrl: emailWebhookUrl,
        payload: {
          to: emailRecipient,
          subject,
          markdown: email.markdown,
          videoMeta: {
            title: title ?? '',
            url: url ?? '',
            author: author ?? '',
            publishedAt,
          },
          segmentsStats: email.stats,
        },
      })

      if (response.ok) {
        dispatch(setTempData({ summaryEmailSentVideoKey: videoKey }))
        retryAtMapRef.current[videoKey] = 0
        toast.success('总结邮件发送成功（点击可关闭）', {
          id: `${emailToastIdPrefix}${videoKey}`,
          duration: Infinity,
        })
      } else {
        // Retry later instead of permanently suppressing this video.
        retryAtMapRef.current[videoKey] = Date.now() + 10 * 1000
        if (Date.now() - lastErrorToastAtRef.current >= 10 * 1000) {
          lastErrorToastAtRef.current = Date.now()
          toast.error(`总结邮件发送失败：${response.error ?? '未知错误'}（点击可关闭）`, {
            id: `${emailToastIdPrefix}${videoKey}`,
            duration: Infinity,
          })
        }
      }
    } finally {
      if (sendingVideoKeyRef.current === videoKey) {
        sendingVideoKeyRef.current = undefined
      }
    }
  })

  // 每0.5秒检测获取结果
  useInterval(async () => {
    try {
      if (taskIds != null) {
        for (const taskId of taskIds) {
          await getTask(taskId)
        }
      }
      await tryAutoSendSummaryEmail()
    } catch (error) {
      logMessagingError('TRANSLATE_SERVICE_INTERVAL', error)
    }
  }, 500)
}

export default useTranslateService
