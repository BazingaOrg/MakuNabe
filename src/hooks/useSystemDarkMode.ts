import {useEffect, useState} from 'react'
import {isDarkMode, subscribeSystemThemeChange} from '../utils/env_util'

const useSystemDarkMode = () => {
  const [isSystemDarkMode, setIsSystemDarkMode] = useState(() => isDarkMode())

  useEffect(() => {
    return subscribeSystemThemeChange(() => {
      setIsSystemDarkMode(isDarkMode())
    })
  }, [])

  return isSystemDarkMode
}

export default useSystemDarkMode
