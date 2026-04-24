import {useAppDispatch, useAppSelector} from './redux'
import React, {useCallback} from 'react'
import {setNeedScroll} from '../redux/envReducer'
import { useMessage } from './useMessageService'
import {logMessagingError} from '@/utils/messageError'
const useSubtitle = () => {
  const dispatch = useAppDispatch()
  const envData = useAppSelector(state => state.env.envData)
  const {sendInject} = useMessage(Boolean(envData.sidePanel))

  const move = useCallback((time: number, togglePause: boolean) => {
    sendInject(null, 'MOVE', {time, togglePause}).catch(error => {
      logMessagingError('MOVE', error)
    })
  }, [sendInject])

  const scrollIntoView = useCallback((ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({behavior: 'smooth', block: 'center'})
    dispatch(setNeedScroll(false))
  }, [dispatch])

  return {move, scrollIntoView}
}

export default useSubtitle
