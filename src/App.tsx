import React, {useCallback, useMemo} from 'react'
import 'tippy.js/dist/tippy.css'
import {useAppDispatch, useAppSelector} from './hooks/redux'
import {setEnvData, setEnvReady, setTempData, setTempReady} from './redux/envReducer'
import {cloneDeep} from 'lodash-es'
import {STORAGE_ENV, STORAGE_TEMP} from './consts/const'
import OptionsPage from './pages/OptionsPage'
import {handleJson} from './utils/util'
import {Toaster} from 'react-hot-toast'
import useMessageService from './hooks/useMessageService'
import MainPage from './pages/MainPage'
import useLocalStorage from './hooks/useLocalStorage'
import {sanitizeEnvData, sanitizeTempData} from './utils/envSanitizer'

function App() {
  const dispatch = useAppDispatch()
  const envData = useAppSelector(state => state.env.envData)
  const tempData = useAppSelector(state => state.env.tempData)
  const path = useAppSelector(state => state.env.path)
  const envReady = useAppSelector(state => state.env.envReady)
  const tempReady = useAppSelector(state => state.env.tempReady)

  // env数据
  const savedEnvData = useMemo(() => {
    return handleJson(cloneDeep(sanitizeEnvData(envData))) as EnvData
  }, [envData])
  const onLoadEnv = useCallback((data?: EnvData) => {
    const sanitizedData = sanitizeEnvData(data)
    if (sanitizedData != null) {
      dispatch(setEnvData(sanitizedData))
    }
    dispatch(setEnvReady())
  }, [dispatch])
  useLocalStorage<EnvData>('chrome_client', STORAGE_ENV, savedEnvData, onLoadEnv)

  // temp数据
  const savedTempData = useMemo(() => {
    return handleJson(cloneDeep(sanitizeTempData(tempData))) as TempData
  }, [tempData])
  const onLoadTemp = useCallback((data?: TempData) => {
    const sanitizedData = sanitizeTempData(data)
    if (sanitizedData != null) {
      dispatch(setTempData(sanitizedData))
    }
    dispatch(setTempReady())
  }, [dispatch])
  useLocalStorage<TempData>('chrome_client', STORAGE_TEMP, savedTempData, onLoadTemp)

  // services
  useMessageService()

  return <div>
    <Toaster position={path === 'app'?'bottom-center':'top-center'}/>
    {path === 'app' && <MainPage/>}
    {path === 'options' && envReady && tempReady && <OptionsPage/>}
  </div>
}

export default App
