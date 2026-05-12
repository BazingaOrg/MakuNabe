import {useCallback} from 'react'
import {useAppDispatch, useAppSelector} from './redux'
import {setFold} from '../redux/envReducer'
import {useMessage} from './useMessageService'

const useExpand = () => {
  const dispatch = useAppDispatch()
  const fold = useAppSelector(state => state.env.fold)
  const sidePanel = useAppSelector(state => state.env.envData.sidePanel)
  const {sendInject} = useMessage(Boolean(sidePanel))

  return useCallback(() => {
    if (!fold) return
    dispatch(setFold(false))
    sendInject(null, 'FOLD', {fold: false}).catch(console.error)
  }, [dispatch, fold, sendInject])
}

export default useExpand
