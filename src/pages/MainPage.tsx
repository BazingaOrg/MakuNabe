import React, {useCallback, useContext} from 'react'
import {useAppDispatch, useAppSelector} from '../hooks/redux'
import Header from '../components/Header'
import Body from '../components/Body'
import useSubtitleService from '../hooks/useSubtitleService'
import {EVENT_EXPAND} from '../consts/const'
import {EventBusContext} from '../Router'
import useTranslateService from '../hooks/useTranslateService'
import {setFold} from '../redux/envReducer'
import { useMessage } from '@/hooks/useMessageService'
import classNames from '@/utils/classNames'
import useSystemDarkMode from '@/hooks/useSystemDarkMode'

function App() {
  const dispatch = useAppDispatch()
  const fold = useAppSelector(state => state.env.fold)
  const envData = useAppSelector(state => state.env.envData)
  const eventBus = useContext(EventBusContext)
  const totalHeight = useAppSelector(state => state.env.totalHeight)
  const {sendInject} = useMessage(Boolean(envData.sidePanel))
  const isSystemDarkMode = useSystemDarkMode()
  const isDarkTheme = envData.theme === 'dark' || ((envData.theme == null || envData.theme === 'system') && isSystemDarkMode)

  const foldCallback = useCallback(() => {
    dispatch(setFold(!fold))
    sendInject(null, 'FOLD', {fold: !fold})
  }, [dispatch, fold, sendInject])

  // handle event
  eventBus.useSubscription((event: any) => {
    if (event.type === EVENT_EXPAND) {
      if (fold) {
        foldCallback()
      }
    }
  })

  useSubtitleService()
  useTranslateService()

  return <div className={classNames(
    'select-none w-full subtitle-shell bili-panel'
  )} style={{
    height: fold?undefined:`${totalHeight}px`,
  }}>
    <Header foldCallback={foldCallback} isDarkTheme={isDarkTheme}/>
    {!fold && <Body/>}
  </div>
}

export default App
