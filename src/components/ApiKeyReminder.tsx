import React from 'react'
import { useAppSelector } from '../hooks/redux'
import { openOptionsPage } from '../utils/chromeUtils'

const ApiKeyReminder: React.FC = () => {
  const apiKey = useAppSelector(state => state.env.envData.apiKey)

  if (typeof apiKey === 'string' && apiKey.length > 0) {
    return null
  }

  return (
    <div className="bili-panel-soft flex items-center justify-between gap-3 p-3 text-base-content text-sm rounded-lg">
      <span>请先设置 API 密钥以使用总结及翻译功能</span>
      <button
        className="btn btn-xs btn-outline rounded-full border-warning/50 hover:bg-warning/20 text-base-content"
        onClick={openOptionsPage}
      >
        设置 {'->'}
      </button>
    </div>
  )
}

export default ApiKeyReminder
