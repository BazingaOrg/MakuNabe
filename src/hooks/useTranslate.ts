import {useAppDispatch, useAppSelector} from './redux'
import {useCallback} from 'react'
import {
  setLastSummarizeTime,
  setReviewAction,
  setTempData,
  setVideoSummaryState
} from '../redux/envReducer'
import {
  LANGUAGES_MAP,
  PROMPT_DEFAULTS,
  PROMPT_TYPE_SUMMARIZE_BRIEF,
  SUMMARIZE_LANGUAGE_DEFAULT,
  SUMMARY_STRATEGY_DEFAULT,
  SUMMARY_STRATEGY_MAP,
  SUMMARIZE_THRESHOLD,
} from '../consts/const'
import toast from 'react-hot-toast'
import {buildSummarySessionKey, buildSummarySessionSyncInput, getModel, getWholeText} from '../utils/bizUtil'
import { useMessage } from './useMessageService'

const resolveTemperature = (envData: EnvData, defaultTemperature: number) => {
  const modelName = (getModel(envData) ?? '').toLowerCase()

  // Some Kimi models only accept temperature=1.
  if (modelName.startsWith('kimi')) {
    return 1
  }

  return defaultTemperature
}

const resolvePromptTemplate = (envData: EnvData) => {
  const customizedPrompt = envData.prompts?.[PROMPT_TYPE_SUMMARIZE_BRIEF]
  if (typeof customizedPrompt === 'string' && customizedPrompt.trim().length > 0) {
    return customizedPrompt
  }
  return PROMPT_DEFAULTS[PROMPT_TYPE_SUMMARIZE_BRIEF]
}

const useTranslate = () => {
  const dispatch = useAppDispatch()
  const envData = useAppSelector(state => state.env.envData)
  const summarizeLanguage = LANGUAGES_MAP[envData.summarizeLanguage??SUMMARIZE_LANGUAGE_DEFAULT]
  const title = useAppSelector(state => state.env.title)
  const url = useAppSelector(state => state.env.url)
  const ctime = useAppSelector(state => state.env.ctime)
  const author = useAppSelector(state => state.env.author)
  const transcript = useAppSelector(state => state.env.data)
  const segments = useAppSelector(state => state.env.segments)
  const reviewed = useAppSelector(state => state.env.tempData.reviewed)
  const reviewAction = useAppSelector(state => state.env.reviewAction)
  const reviewActions = useAppSelector(state => state.env.tempData.reviewActions)
  const {sendExtension} = useMessage(Boolean(envData.sidePanel))
  const summarySessionShapeKey = useCallback((segmentsToHash?: Segment[]) => {
    return (segmentsToHash ?? []).map((item) => `${item.startIdx}:${item.endIdx}:${item.text}`).join('|')
  }, [])

  const addSummarizeTask = useCallback(async () => {
    // review action
    if (reviewed === undefined && !reviewAction) {
      dispatch(setReviewAction(true))
      dispatch(setTempData({
        reviewActions: (reviewActions ?? 0) + 1
      }))
    }

    const fullText = getWholeText((transcript?.body ?? []).map((item) => item.content))
    if (fullText.length < SUMMARIZE_THRESHOLD) {
      toast.error('全文字幕过短，无法总结')
      return
    }

    const summaryStrategy = SUMMARY_STRATEGY_MAP[envData.summaryStrategy ?? SUMMARY_STRATEGY_DEFAULT]
    const summarySessionKey = buildSummarySessionKey({
      url,
      ctime,
      segmentCount: segments?.length,
      segmentShapeKey: summarySessionShapeKey(segments),
    })
    const summaryRunStartedAt = Date.now()
    await sendExtension(null, 'UPSERT_SUMMARY_SESSION', {
      input: buildSummarySessionSyncInput({
        sessionKey: summarySessionKey,
        url,
        title,
        ctime,
        author,
        fullText,
        segments,
      }),
    })

    let prompt = resolvePromptTemplate(envData)
    prompt = prompt.replaceAll('{{language}}', summarizeLanguage.name)
    prompt = prompt.replaceAll('{{title}}', title??'')
    prompt = prompt.replaceAll('{{transcript}}', fullText)
    prompt = prompt.replaceAll('{{subtitles}}', fullText)
    prompt = prompt.replaceAll('{{segment}}', fullText)
    if (prompt.trim().length === 0) {
      toast.error('提示词模板为空')
      return
    }

    const taskDef: TaskDef = {
      type: 'chatComplete',
      serverUrl: envData.serverUrl,
      data: {
        model: getModel(envData),
        messages: [
          {
            role: 'user',
            content: prompt,
          }
        ],
        temperature: resolveTemperature(envData, summaryStrategy.temperature),
        n: 1,
        stream: summaryStrategy.stream,
      },
      extra: {
        type: 'summarize',
        apiKey: envData.apiKey,
        summarySessionKey,
        summaryRunStartedAt,
        summaryStrategyCode: summaryStrategy.code,
        summaryAutoRetry: summaryStrategy.autoRetry,
        summaryAutoRepair: summaryStrategy.autoRepair,
      }
    }
    console.debug('addSummarizeTask', taskDef)
    dispatch(setVideoSummaryState({
      type: 'brief',
      status: 'pending',
      error: undefined,
      content: undefined,
      streamingContent: '',
      recoveryStage: 'generating',
    }))
    dispatch(setLastSummarizeTime(summaryRunStartedAt))
    await sendExtension(null, 'ADD_TASK', {taskDef})
  }, [author, ctime, dispatch, envData, reviewAction, reviewActions, reviewed, segments, sendExtension, summarySessionShapeKey, summarizeLanguage.name, title, transcript?.body, url])

  return {addSummarizeTask}
}

export default useTranslate
