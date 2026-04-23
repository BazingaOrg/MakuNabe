import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  setAutoScroll,
  setCheckAutoScroll,
  setFoldAll,
  setNeedScroll,
  setSegmentFold,
  setTempData
} from '../redux/envReducer'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import {
  AiOutlineAim,
  AiOutlineCloseCircle
} from 'react-icons/ai'
import {FaClipboardList, FaRegArrowAltCircleDown} from 'react-icons/fa'
import {IoMdWarning} from 'react-icons/io'
import {MdExpandMore} from 'react-icons/md'
import classNames from 'classnames'
import toast from 'react-hot-toast'
import SegmentCard from './SegmentCard'
import {
  DEFAULT_USE_PORT,
  HEADER_HEIGHT,
  TITLE_HEIGHT
} from '../consts/const'
import useTranslate from '../hooks/useTranslate'
import useKeyService from '../hooks/useKeyService'
import RateExtension from '../components/RateExtension'
import ApiKeyReminder from './ApiKeyReminder'
import { useMessaging } from '../message'
import {useInViewport} from 'ahooks'
import {extractStreamingSummaryPreview, getSummaryStr, isSummaryEmpty} from '@/utils/bizUtil'
import Markdown from './Markdown'

const VideoSummary = (props: {
  summary?: Summary
  onGenerate: () => void
  disabled?: boolean
  floating?: boolean
}) => {
  const {summary, onGenerate, disabled, floating} = props
  const fontSize = useAppSelector(state => state.env.envData.fontSize)
  const streamingPreview = useMemo(() => extractStreamingSummaryPreview(summary?.streamingContent), [summary?.streamingContent])
  const pendingLabel = useMemo(() => {
    switch (summary?.recoveryStage) {
      case 'retrying':
        return '重试中'
      case 'repairing':
        return '修复格式中'
      default:
        return '生成中'
    }
  }, [summary?.recoveryStage])
  const pendingHint = useMemo(() => {
    switch (summary?.recoveryStage) {
      case 'retrying':
        return '首次请求失败，正在自动重试'
      case 'repairing':
        return '正在把已有输出修复为合法格式'
      default:
        return '正在生成全文总结'
    }
  }, [summary?.recoveryStage])

  const onCopy = useCallback(() => {
    if (summary == null) {
      return
    }

    navigator.clipboard.writeText(getSummaryStr(summary)).then(() => {
      toast.success('已复制到剪贴板!')
    }).catch(console.error)
  }, [summary])

  return <div className={classNames(
    'bili-panel-soft rounded-lg flex flex-col gap-2 p-3',
    floating === true && 'shadow-sm'
  )}>
    <div className='flex items-center justify-between gap-2'>
      <span className='bili-section-label'>全文总结</span>
      {(summary != null) && !isSummaryEmpty(summary) && <button className='btn btn-ghost btn-xs min-h-0 h-7 rounded-full px-3' onClick={onCopy}>复制</button>}
    </div>

    {summary?.type === 'brief' && summary.content != null && !isSummaryEmpty(summary) &&
      <div className={classNames('font-medium overflow-x-hidden', fontSize === 'large' ? 'text-sm' : 'text-xs')}>
        <Markdown content={summary.content.summary}/>
      </div>}

    {summary?.status === 'pending' && streamingPreview.length > 0 &&
      <div className={classNames('font-medium overflow-x-hidden text-base-content/80', fontSize === 'large' ? 'text-sm' : 'text-xs')}>
        <Markdown content={streamingPreview}/>
      </div>}

    <div className='flex flex-col items-center gap-1'>
      {(summary == null || summary.status !== 'done' || summary.error != null) &&
        <button
          disabled={disabled === true || summary?.status === 'pending'}
          className={classNames('btn btn-link btn-xs min-h-0 h-7 rounded-full px-2', summary?.status === 'pending' && 'loading')}
          onClick={onGenerate}
        >
          {(summary == null) || summary.status === 'init' ? '点击生成' : (summary.status === 'pending' ? pendingLabel : '重新生成')}
        </button>}
      {((summary == null) || summary.status === 'init') && <div className='desc-lighter text-xs'>基于当前视频全文生成一份总结</div>}
      {summary?.status === 'pending' && <div className='desc-lighter text-xs'>{pendingHint}</div>}
      {summary?.error != null && summary.error.length > 0 && <div className='text-xs text-error'>{summary.error}</div>}
    </div>
  </div>
}

const Body = () => {
  const dispatch = useAppDispatch()
  const noVideo = useAppSelector(state => state.env.noVideo)
  const autoScroll = useAppSelector(state => state.env.autoScroll)
  const segments = useAppSelector(state => state.env.segments)
  const foldAll = useAppSelector(state => state.env.foldAll)
  const envData = useAppSelector(state => state.env.envData)
  const compact = useAppSelector(state => state.env.tempData.compact)
  const summarizeEnable = useAppSelector(state => state.env.envData.summarizeEnable)
  const videoSummary = useAppSelector(state => state.env.videoSummary)
  const { addSummarizeTask } = useTranslate()
  // const infos = useAppSelector(state => state.env.infos)
  const bodyRef = useRef<any>()
  const summaryRef = useRef<any>(null)
  const [summaryInViewport] = useInViewport(summaryRef, {
    root: bodyRef.current,
  })
  const curOffsetTop = useAppSelector(state => state.env.curOffsetTop)
  const checkAutoScroll = useAppSelector(state => state.env.checkAutoScroll)
  const needScroll = useAppSelector(state => state.env.needScroll)
  const totalHeight = useAppSelector(state => state.env.totalHeight)
  // const title = useAppSelector(state => state.env.title)
  // const fontSize = useAppSelector(state => state.env.envData.fontSize)
  const { disconnected } = useMessaging(DEFAULT_USE_PORT)
  const showFloatingSummary = summarizeEnable === true
    && envData.summarizeFloat === true
    && summaryInViewport !== true
    && videoSummary != null
    && !isSummaryEmpty(videoSummary)

  const normalCallback = useCallback(() => {
    dispatch(setTempData({
      compact: false
    }))
  }, [dispatch])

  const compactCallback = useCallback(() => {
    dispatch(setTempData({
      compact: true
    }))
  }, [dispatch])

  const posCallback = useCallback(() => {
    dispatch(setNeedScroll(true))
  }, [dispatch])

  const onSummarizeAll = useCallback(() => {
    const apiKey = envData.apiKey
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      toast.error('请先在选项页面设置ApiKey!')
      return
    }
    addSummarizeTask().catch((error) => {
      console.error(error)
      toast.error(error instanceof Error ? error.message : '全文总结创建失败')
    })
  }, [addSummarizeTask, envData.apiKey])

  const onFoldAll = useCallback(() => {
    dispatch(setFoldAll(foldAll !== true))
    for (const segment of segments ?? []) {
      dispatch(setSegmentFold({
        segmentStartIdx: segment.startIdx,
        fold: foldAll !== true
      }))
    }
  }, [dispatch, foldAll, segments])

  const onEnableAutoScroll = useCallback(() => {
    dispatch(setAutoScroll(true))
    dispatch(setNeedScroll(true))
  }, [dispatch])

  const onWheel = useCallback(() => {
    if (autoScroll === true) {
      dispatch(setAutoScroll(false))
    }
  }, [autoScroll, dispatch])

  // service
  useKeyService()

  // 自动滚动
  useEffect(() => {
    if (checkAutoScroll === true && curOffsetTop != null && autoScroll === true && needScroll !== true) {
      if (bodyRef.current.scrollTop <= curOffsetTop - bodyRef.current.offsetTop - (totalHeight - 160) + (showFloatingSummary ? 100 : 0) ||
        bodyRef.current.scrollTop >= curOffsetTop - bodyRef.current.offsetTop - 40 - 10
      ) {
        dispatch(setNeedScroll(true))
        dispatch(setCheckAutoScroll(false))
        console.debug('need scroll')
      }
    }
  }, [autoScroll, checkAutoScroll, curOffsetTop, dispatch, needScroll, showFloatingSummary, totalHeight])

  return <div className='relative bg-base-100'>
    {/* title */}
    <div className='absolute top-2 left-3 flex-center gap-1'>
      <button aria-label='滚动到视频位置' className='bili-toolbar-button' onClick={posCallback} title='滚动到视频位置'>
        <AiOutlineAim />
      </button>
      {segments != null && segments.length > 0 &&
        <MdExpandMore className={classNames('cursor-pointer', foldAll === true ? 'text-accent' : '')} onClick={onFoldAll}
          title='展开/折叠全部' />}
    </div>
    <div className='flex justify-center'>
      <div className='bili-segment-switch mt-2'>
        <button className={classNames('bili-segment-switch-item', compact !== true && 'bili-segment-switch-item-active')}
          onClick={normalCallback}>列表视图</button>
        <button className={classNames('bili-segment-switch-item', compact === true && 'bili-segment-switch-item-active')}
          onClick={compactCallback}>文章视图</button>
      </div>
    </div>
    <div className='absolute top-2 right-3 flex items-center gap-1'>
      {summarizeEnable === true &&
        <button aria-label='生成全文总结' className='bili-toolbar-button tooltip tooltip-left z-[100]' data-tip='生成全文总结' onClick={onSummarizeAll}>
          <FaClipboardList />
        </button>}
      {noVideo === true && <div className='tooltip tooltip-left ml-2' data-tip='当前浏览器不支持视频跳转'>
        <IoMdWarning className='text-warning' />
      </div>}
    </div>

    {disconnected && <div className='flex flex-col justify-center items-center gap-2 text-sm bg-error/15 border border-error/40 rounded-md mx-2 py-2'>
      <span className='flex items-center gap-1 text-error'><AiOutlineCloseCircle className='text-error' />已断开连接</span>
    </div>}

    {/* auto scroll btn */}
    {autoScroll !== true && <div
      className='absolute z-[999] top-[96px] right-4 tooltip tooltip-left cursor-pointer rounded-full bg-primary/15 text-primary p-1.5 text-xl border border-primary/30 transition-colors duration-200 ease-out'
      data-tip='开启自动滚动'
      onClick={onEnableAutoScroll}>
      <FaRegArrowAltCircleDown />
    </div>}

    {/* body */}
    <div ref={bodyRef} onWheel={onWheel}
      className={classNames('flex flex-col gap-1.5 overflow-y-auto select-text scroll-smooth px-1.5 pb-1.5', showFloatingSummary && 'pb-[100px]')}
      style={{
        height: `${totalHeight - HEADER_HEIGHT - TITLE_HEIGHT}px`
      }}
    >
      {summarizeEnable === true && segments != null && segments.length > 0 && <div ref={summaryRef} className='mt-1.5'>
        <VideoSummary summary={videoSummary} onGenerate={onSummarizeAll}/>
      </div>}

      {/* segments */}
      {segments?.map((segment, segmentIdx) => <SegmentCard key={segment.startIdx} segment={segment}
        segmentIdx={segmentIdx} bodyRef={bodyRef} />)}

      <ApiKeyReminder />

      <RateExtension />
    </div>

    {showFloatingSummary && <div
      className='absolute bottom-0 left-0 right-0 z-[200] border-t border-base-300 bg-base-100 shadow-sm max-h-[100px] overflow-y-auto scrollbar-hide'
    >
      <div className='bg-primary/10 p-2'>
        <VideoSummary summary={videoSummary} onGenerate={onSummarizeAll} floating/>
      </div>
    </div>}
  </div>
}

export default Body
