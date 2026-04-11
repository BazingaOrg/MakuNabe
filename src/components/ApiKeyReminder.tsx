import React from 'react'
import { useAppSelector } from '../hooks/redux'
import { openOptionsPage } from '../utils/chromeUtils'

const ApiKeyReminder: React.FC = () => {
  const apiKey = useAppSelector(state => state.env.envData.apiKey)

  if (apiKey) {
    return null
  }

  return (
    <div className="flex items-center justify-between p-2 border border-warning/40 bg-warning/15 text-base-content text-sm rounded-md">
      <span>请先设置 API 密钥以使用总结及翻译功能</span>
      <button
        className="btn btn-xs btn-outline border-warning/50 hover:bg-warning/20 text-base-content"
        onClick={openOptionsPage}
      >
        设置 {'->'}
      </button>
    </div>
  )
}

export default ApiKeyReminder
