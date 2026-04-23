import React, { useState } from 'react'
import { FaStar } from 'react-icons/fa'
import { IoMdClose } from 'react-icons/io'
import { setTempData } from '../redux/envReducer'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { openUrl } from '../utils/env_util'
import { isEdgeBrowser } from '../utils/util'

const RateExtension: React.FC = () => {
  const dispatch = useAppDispatch()
  const [isHovered, setIsHovered] = useState(false)
  const reviewed = useAppSelector(state => state.env.tempData.reviewed)

  const handleRateClick = () => {
    dispatch(setTempData({
      reviewed: true
    }))
    // Chrome Web Store URL for your extension
    if (isEdgeBrowser()) {
      openUrl('https://microsoftedge.microsoft.com/addons/detail/lignnlhlpiefmcjkdkmfjdckhlaiajan')
    } else {
      openUrl('https://chromewebstore.google.com/webstore/detail/bciglihaegkdhoogebcdblfhppoilclp/reviews')
    }
  }

  if (reviewed === true || reviewed === undefined) return null

  return (
    <div className="relative bili-panel-soft m-1.5 p-4 rounded-lg text-base-content text-sm">
      <button
        onClick={() => {
          dispatch(setTempData({
            reviewed: true
          }))
        }}
        className="absolute top-2 right-2 bili-toolbar-button"
      >
        <IoMdClose size={18} />
      </button>
      <h3 className="text-sm font-semibold mb-1">喜欢这个扩展吗？</h3>
      <p className="mb-3 text-base-content/75">如果觉得有用，欢迎去商店给个评分。</p>
      <button
        onClick={handleRateClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="btn btn-primary btn-sm gap-2"
      >
        <FaStar className={`inline-block ${isHovered ? 'text-warning' : 'text-primary-content'}`} />
        去评分
        <span className="inline-block">{isHovered ? '>' : '->'}</span>
      </button>
    </div>
  )
}

export default RateExtension
