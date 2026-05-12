import React, {useCallback, useEffect, useRef} from 'react'
import {useAppDispatch, useAppSelector} from '../hooks/redux'
import useSubtitle from '../hooks/useSubtitle'
import {setCheckAutoScroll, setCurOffsetTop, setNeedScroll} from '../redux/envReducer'
import NormalSegmentItem from './NormalSegmentItem'
import CompactSegmentItem from './CompactSegmentItem'
import toast from 'react-hot-toast'

const SegmentItem = (props: {
  bodyRef: any
  item: TranscriptItem
  idx: number
  isIn: boolean
  needScroll?: boolean
  last: boolean
}) => {
  const {bodyRef, item, idx, isIn, needScroll, last} = props
  const dispatch = useAppDispatch()
  const ref = useRef<any>()
  const {move} = useSubtitle()

  const compact = useAppSelector(state => state.env.tempData.compact)

  const moveCallback = useCallback((event: any) => {
    if (event.altKey === true) { // 复制
      navigator.clipboard.writeText(item.content).then(() => {
        toast.success('已复制')
      }).catch(console.error)
    } else {
      move(item.from, false)
    }
  }, [item.content, item.from, move])

  const move2Callback = useCallback((event: any) => {
    if (event.altKey === true) { // 复制
      navigator.clipboard.writeText(item.content).then(() => {
        toast.success('已复制')
      }).catch(console.error)
    } else {
      move(item.from, true)
    }
  }, [item.content, item.from, move])

  // 检测需要滚动进入视野
  useEffect(() => {
    if (needScroll === true) {
      bodyRef.current.scrollTop = ref.current.offsetTop - bodyRef.current.offsetTop - 40
      dispatch(setNeedScroll(false))
    }
  }, [dispatch, needScroll, bodyRef])

  // 进入时更新当前offsetTop
  useEffect(() => {
    if (isIn) {
      dispatch(setCurOffsetTop(ref.current.offsetTop))
      dispatch(setCheckAutoScroll(true))
    }
  }, [dispatch, isIn])

  return <span ref={ref}>
    {compact === true
      ? <CompactSegmentItem
        item={item}
        idx={idx}
        isIn={isIn}
        last={last}
        moveCallback={moveCallback}
        move2Callback={move2Callback}
      />
      :
      <NormalSegmentItem
        item={item}
        idx={idx}
        isIn={isIn}
        moveCallback={moveCallback}
        move2Callback={move2Callback}
      />
    }
  </span>
}

export default React.memo(SegmentItem)
