import {MutableRefObject, useCallback, useEffect, useMemo, useRef} from 'react'
import {useAppDispatch, useAppSelector} from '../hooks/redux'
import {setFloatKeyPointsSegIdx, setSegmentFold} from '../redux/envReducer'
import classNames from 'classnames'
import {SUMMARIZE_THRESHOLD, SUMMARIZE_TYPES} from '../consts/const'
import useTranslate from '../hooks/useTranslate'
import {BsDashSquare, BsPlusSquare, RiFileCopy2Line} from 'react-icons/all'
import toast from 'react-hot-toast'
import {extractStreamingSummaryPreview, getLastTime, getSummaryStr, isSummaryEmpty} from '../utils/bizUtil'
import {useInViewport} from 'ahooks'
import SegmentItem from './SegmentItem'
import {stopPopFunc} from '../utils/util'
import Markdown from './Markdown'

const Summarize = (props: {
  segment: Segment
  summary?: Summary
  float?: boolean
}) => {
  const {segment, summary, float} = props

  const envData = useAppSelector(state => state.env.envData)
  const fontSize = useAppSelector(state => state.env.envData.fontSize)
  const {addSummarizeTask} = useTranslate()
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
        return '正在生成总结内容'
    }
  }, [summary?.recoveryStage])

  const onGenerate = useCallback(() => {
    const apiKey = envData.apiKey
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      addSummarizeTask(segment).catch(console.error)
    } else {
      toast.error('请先在选项页面设置ApiKey!')
    }
  }, [addSummarizeTask, envData.apiKey, segment])

  const onCopy = useCallback(() => {
    if (summary != null) {
      navigator.clipboard.writeText(getSummaryStr(summary)).then(() => {
        toast.success('已复制到剪贴板!')
      }).catch(console.error)
    }
  }, [summary])

  return <div className='flex flex-col gap-0.5 relative'>
    {(summary != null) && !isSummaryEmpty(summary) && <div className='absolute top-0 right-0'>
      <RiFileCopy2Line className='desc cursor-pointer' onClick={onCopy}/>
    </div>}
    <div className='flex justify-center items-center'>
      {summary?.type === 'brief' && (summary.content != null) &&
        <div className={classNames('font-medium max-w-[90%] overflow-x-hidden', fontSize === 'large' ? 'text-sm' : 'text-xs')}>
          <Markdown content={summary.content.summary}/>
        </div>}
      {summary?.status === 'pending' && streamingPreview.length > 0 &&
        <div className={classNames('font-medium max-w-[90%] overflow-x-hidden text-base-content/80', fontSize === 'large' ? 'text-sm' : 'text-xs')}>
          <Markdown content={streamingPreview}/>
        </div>}
    </div>
    <div className='flex flex-col justify-center items-center'>
      {segment.text.length < SUMMARIZE_THRESHOLD && <div className='desc-lighter text-xs'>文字过短，无法总结.</div>}
      {segment.text.length >= SUMMARIZE_THRESHOLD && (summary == null || summary.status !== 'done' || summary.error != null) && <button disabled={summary?.status === 'pending'}
                className={classNames('btn btn-link btn-xs', summary?.status === 'pending' && 'loading')}
                onClick={onGenerate}>{(summary == null) || summary.status === 'init' ? '点击生成' : (summary.status === 'pending' ? pendingLabel : '重新生成')}</button>}
      {((summary == null) || summary.status === 'init') && <div className='desc-lighter text-xs'>{SUMMARIZE_TYPES.brief.desc}</div>}
      {summary?.status === 'pending' && <div className='desc-lighter text-xs'>{pendingHint}</div>}
      {summary?.error != null && summary.error.length > 0 && <div className='text-xs text-error'>{summary.error}</div>}
    </div>
    {float !== true && <div className='mx-2 my-1 h-[1px] bg-base-300'></div>}
  </div>
}

const SegmentCard = (props: {
  bodyRef: MutableRefObject<any>
  segment: Segment
  segmentIdx: number
}) => {
  const {bodyRef, segment} = props

  const dispatch = useAppDispatch()
  const summarizeRef = useRef<any>(null)
  const [inViewport] = useInViewport(summarizeRef, {
    root: bodyRef.current,
  })
  const segments = useAppSelector(state => state.env.segments)
  const needScroll = useAppSelector(state => state.env.needScroll)
  const curIdx = useAppSelector(state => state.env.curIdx)
  const summarizeEnable = useAppSelector(state => state.env.envData.summarizeEnable)
  const summarizeFloat = useAppSelector(state => state.env.envData.summarizeFloat)
  const fold = useAppSelector(state => state.env.fold)
  const compact = useAppSelector(state => state.env.tempData.compact)
  const floatKeyPointsSegIdx = useAppSelector(state => state.env.floatKeyPointsSegIdx)
  const showCurrent = useMemo(() => curIdx != null && segment.startIdx <= curIdx && curIdx <= segment.endIdx, [curIdx, segment.endIdx, segment.startIdx])
  const summary = useMemo(() => {
    const result = segment.summaries.brief
    if (result != null) {
      return result
    }
    return undefined
  }, [segment.summaries])

  const onFold = useCallback(() => {
    dispatch(setSegmentFold({
      segmentStartIdx: segment.startIdx,
      fold: segment.fold !== true
    }))
  }, [dispatch, segment.fold, segment.startIdx])

  // 检测设置floatKeyPointsSegIdx
  useEffect(() => {
    if (summarizeFloat === true) { // 已启用
      if (!fold && showCurrent) { // 当前Card有控制权
        if (inViewport !== true && summary != null && !isSummaryEmpty(summary)) {
          dispatch(setFloatKeyPointsSegIdx(segment.startIdx))
        } else {
          dispatch(setFloatKeyPointsSegIdx())
        }
      }
    }
  }, [dispatch, fold, inViewport, segment.startIdx, showCurrent, summarizeFloat, summary])

  return <div
    className={classNames('border border-base-300 bg-base-100 rounded-md flex flex-col m-1.5 p-1.5 gap-1', showCurrent && 'ring-1 ring-primary/35 shadow-sm')}>
    {/* 章节标题 */}
    {typeof segment.chapterTitle === 'string' && segment.chapterTitle.length > 0 && <div className='text-center py-1 px-2 bg-primary/10 rounded text-sm font-semibold text-primary border border-primary/20'>
      {segment.chapterTitle}
    </div>}
    <div className='relative flex justify-center min-h-[20px]'>
      {segments != null && segments.length > 0 &&
        <div className='absolute left-0 top-0 bottom-0 text-xs select-none flex-center desc'>
          {segment.fold === true
            ? <BsPlusSquare className='cursor-pointer' onClick={onFold}/> :
            <BsDashSquare className='cursor-pointer' onClick={onFold}/>}
        </div>}
      {summarizeEnable === true && <div className="tabs">
        <a className="tab tab-lifted tab-xs tab-disabled cursor-default"></a>
        <a className='tab tab-lifted tab-xs tab-active'>总结</a>
        <a className="tab tab-lifted tab-xs tab-disabled cursor-default"></a>
      </div>}
      <div
        className='absolute right-0 top-0 bottom-0 text-xs desc-lighter select-none flex-center'>{getLastTime(segment.items[segment.items.length - 1].to - segment.items[0].from)}</div>
    </div>
    {summarizeEnable === true && <div ref={summarizeRef}>
      <Summarize segment={segment} summary={summary}/>
    </div>}
    {segment.fold !== true
      ? <div>
        {compact !== true && <div className='desc text-xs flex py-0.5'>
          <div className='w-[66px] flex justify-center'>时间</div>
          <div className='flex-1'>字幕内容</div>
        </div>}
        {segment.items.map((item: TranscriptItem, idx: number) => <SegmentItem key={item.idx}
                                                                               bodyRef={bodyRef}
                                                                               item={item}
                                                                               idx={segment.startIdx + idx}
                                                                               isIn={curIdx === segment.startIdx + idx}
                                                                               needScroll={needScroll === true && curIdx === segment.startIdx + idx}
                                                                               last={idx === segment.items.length - 1}
        />)}
        {segments != null && segments.length > 0 && <div className='flex justify-center'><a className='link text-xs'
                                                                                            onClick={onFold}>点击折叠{segment.items.length}行</a>
        </div>}
      </div>
      : <div className='flex justify-center'><a className='link text-xs'
                                                onClick={onFold}>{segment.items.length}行已折叠,点击展开</a>
      </div>}
    {floatKeyPointsSegIdx === segment.startIdx && <div
      className='absolute bottom-0 left-0 right-0 z-[200] border-t border-base-300 bg-base-100 shadow-sm max-h-[100px] overflow-y-auto scrollbar-hide'
      onWheel={stopPopFunc}
    >
      <div className='bg-primary/10 p-2'>
        <Summarize segment={segment} summary={summary} float/>
      </div>
    </div>}
  </div>
}

export default SegmentCard
