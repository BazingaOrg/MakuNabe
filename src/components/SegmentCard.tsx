import {MutableRefObject, useCallback, useMemo} from 'react'
import {useAppDispatch, useAppSelector} from '../hooks/redux'
import {setSegmentFold} from '../redux/envReducer'
import classNames from '@/utils/classNames'
import {BsDashSquare, BsPlusSquare} from 'react-icons/bs'
import SegmentItem from './SegmentItem'
import {getLastTime} from '../utils/bizUtil'

const SegmentCard = (props: {
  bodyRef: MutableRefObject<any>
  segment: Segment
  segmentIdx: number
}) => {
  const {bodyRef, segment} = props

  const dispatch = useAppDispatch()
  const segments = useAppSelector(state => state.env.segments)
  const needScroll = useAppSelector(state => state.env.needScroll)
  const curIdx = useAppSelector(state => state.env.curIdx)
  const compact = useAppSelector(state => state.env.tempData.compact)
  const showCurrent = useMemo(() => curIdx != null && segment.startIdx <= curIdx && curIdx <= segment.endIdx, [curIdx, segment.endIdx, segment.startIdx])

  const onFold = useCallback(() => {
    dispatch(setSegmentFold({
      segmentStartIdx: segment.startIdx,
      fold: segment.fold !== true
    }))
  }, [dispatch, segment.fold, segment.startIdx])

  return <div
    className={classNames('bili-panel-soft rounded-lg flex flex-col p-2 gap-2', showCurrent && 'bili-current-segment')}>
    {typeof segment.chapterTitle === 'string' && segment.chapterTitle.length > 0 && <div className='text-center py-1 px-2 bg-primary/10 rounded text-sm font-semibold text-primary border border-primary/20'>
      {segment.chapterTitle}
    </div>}

    <div className='relative flex justify-center min-h-[28px] items-center'>
      {segments != null && segments.length > 0 &&
        <div className='absolute left-0 top-0 bottom-0 text-xs select-none flex-center desc'>
          {segment.fold === true
            ? <BsPlusSquare className='cursor-pointer' onClick={onFold}/> :
            <BsDashSquare className='cursor-pointer' onClick={onFold}/>}
        </div>}
      <span className='bili-section-label'>字幕分段</span>
      <div
        className='absolute right-0 top-0 bottom-0 text-xs desc-lighter select-none flex-center'>{getLastTime(segment.items[segment.items.length - 1].to - segment.items[0].from)}</div>
    </div>

    {segment.fold !== true
      ? <div>
        {compact !== true && <div className='desc text-xs flex py-1'>
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
        {segments != null && segments.length > 0 && <div className='flex justify-center'><button className='btn btn-ghost btn-xs min-h-0 h-7 rounded-full px-3'
                                                                                            onClick={onFold}>折叠 {segment.items.length} 行</button>
        </div>}
      </div>
      : <div className='flex justify-center'><button className='btn btn-ghost btn-xs min-h-0 h-7 rounded-full px-3'
                                                onClick={onFold}>{segment.items.length} 行已折叠，点击展开</button>
      </div>}
  </div>
}

export default SegmentCard
