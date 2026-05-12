import App from './App'
import React, { useEffect } from 'react'
import { useAppDispatch } from './hooks/redux'
import { setPath } from './redux/envReducer'

const map: { [key: string]: string } = {
  '/options.html': 'options',
  '/sidepanel.html': 'app',
}

const Router = () => {
  const path = map[window.location.pathname] ?? 'app'
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(setPath(path as 'app' | 'options'))
  }, [dispatch, path])

  return (path === 'app' || path === 'options') ? <App/> : null
}

export default Router
