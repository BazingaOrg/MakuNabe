import React from 'react'
import {formatTime} from '../utils/util'
import {useAppSelector} from '../hooks/redux'
import classNames from '@/utils/classNames'

const NormalSegmentItem = (props: {
  item: TranscriptItem
  idx: number
  isIn: boolean
  moveCallback: (event: any) => void
  move2Callback: (event: any) => void
}) => {
  const {item, isIn, moveCallback, move2Callback} = props
  const fontSize = useAppSelector(state => state.env.envData.fontSize)

  return <div className={classNames('flex py-0.5 cursor-pointer rounded-md hover:bg-base-200', isIn && 'bili-current-line', fontSize === 'large'?'text-sm':'text-xs')}
              onClick={moveCallback} onDoubleClick={move2Callback}>
    <div className='desc w-[66px] flex justify-center'>{formatTime(item.from)}</div>
    <div className={'flex-1'}>
      <div className={classNames('font-medium', isIn ? 'text-primary' : '')}>{item.content}</div>
    </div>
  </div>
}

export default NormalSegmentItem
