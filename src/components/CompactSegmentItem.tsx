import React from 'react'
import {useAppSelector} from '../hooks/redux'
import classNames from '@/utils/classNames'

const CompactSegmentItem = (props: {
  item: TranscriptItem
  idx: number
  isIn: boolean
  last: boolean
  moveCallback: (event: any) => void
  move2Callback: (event: any) => void
}) => {
  const {item, last, isIn, moveCallback, move2Callback} = props
  const fontSize = useAppSelector(state => state.env.envData.fontSize)

  return <div className={classNames('inline', fontSize === 'large'?'text-sm':'text-xs')}>
    <span className={classNames('pl-1 pr-0.5 py-0.5 cursor-pointer rounded-md hover:bg-base-200', isIn && 'bili-current-line')} onClick={moveCallback} onDoubleClick={move2Callback}>
      <text className={classNames('font-medium', isIn ? 'text-primary' : '')}>{item.content}</text>
    </span>
    <span className='text-base-content/75'>{!last && ','}</span>
  </div>
}

export default CompactSegmentItem
