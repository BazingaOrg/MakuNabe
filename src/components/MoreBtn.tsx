import {MouseEvent, useCallback, useContext, useRef, useState} from 'react'
import {useClickAway} from 'ahooks'
import {
  FiMoreVertical,
} from 'react-icons/fi'
import {ImDownload3} from 'react-icons/im'
import {IoMdSettings} from 'react-icons/io'
import {RiFileCopy2Line} from 'react-icons/ri'
import Popover from '../components/Popover'
import {Placement} from '@popperjs/core/lib/enums'
import {useAppDispatch, useAppSelector} from '../hooks/redux'
import {setEnvData, setTempData} from '../redux/envReducer'
import {EventBusContext} from '../Router'
import {EVENT_EXPAND} from '../consts/const'
import {formatSrtTime, formatTime, formatVttTime, downloadText} from '../utils/util'
import toast from 'react-hot-toast'
import {getSummarize} from '../utils/bizUtil'
import dayjs from 'dayjs'
import { useMessage } from '@/hooks/useMessageService'
import {logMessagingError} from '@/utils/messageError'

interface Props {
  placement: Placement
}

const DownloadTypes = [
  {
    type: 'text',
    name: '列表',
  },
  {
    type: 'textWithTime',
    name: '列表(带时间)',
  },
  {
    type: 'article',
    name: '文章',
  },
  {
    type: 'srt',
    name: 'srt',
  },
  {
    type: 'vtt',
    name: 'vtt',
  },
  {
    type: 'json',
    name: '原始json',
  },
  {
    type: 'summarize',
    name: '总结',
  },
]

const menuIconClassName = 'bili-menu-icon'
const menuRowClassName = 'bili-menu-row'

const MoreBtn = (props: Props) => {
  const {placement} = props
  const dispatch = useAppDispatch()

  const moreRef = useRef(null)
  const data = useAppSelector(state => state.env.data)
  const envReady = useAppSelector(state => state.env.envReady)
  const envData = useAppSelector(state => state.env.envData)
  const downloadType = useAppSelector(state => state.env.tempData.downloadType)
  const [moreVisible, setMoreVisible] = useState(false)
  const eventBus = useContext(EventBusContext)
  const videoSummary = useAppSelector(state => state.env.videoSummary)
  const url = useAppSelector(state => state.env.url)
  const title = useAppSelector(state => state.env.title)
  const ctime = useAppSelector(state => state.env.ctime) // 时间戳，单位s
  const author = useAppSelector(state => state.env.author)

  const {sendInject} = useMessage(Boolean(envData.sidePanel))

  const downloadCallback = useCallback((download: boolean) => {
    if (data == null) {
      return
    }

    let fileName = title
    let s, suffix
    const time = ctime != null ? dayjs(ctime * 1000).format('YYYY-MM-DD HH:mm:ss') : '' // 2024-05-01 12:00:00
    if (downloadType == null || downloadType === 'text') {
      s = `${title??'无标题'}\n${url??'无链接'}\n${author??'无作者'} ${time}\n\n`
      for (const item of data.body) {
        s += item.content + '\n'
      }
      suffix = 'txt'
    } else if (downloadType === 'textWithTime') {
      s = `${title??'无标题'}\n${url??'无链接'}\n${author??'无作者'} ${time}\n\n`
      for (const item of data.body) {
        s += formatTime(item.from) + ' ' + item.content + '\n'
      }
      suffix = 'txt'
    } else if (downloadType === 'article') {
      s = `${title??'无标题'}\n${url??'无链接'}\n${author??'无作者'} ${time}\n\n`
      for (const item of data.body) {
        s += item.content + ', '
      }
      s = s.substring(0, s.length - 1) // remove last ','
      suffix = 'txt'
    } else if (downloadType === 'srt') {
      /**
       * 1
       * 00:05:00,400 --> 00:05:15,300
       * This is an example of
       * a subtitle.
       *
       * 2
       * 00:05:16,400 --> 00:05:25,300
       * This is an example of
       * a subtitle - 2nd subtitle.
       */
      s = ''
      for (const item of data.body) {
        const ss = (item.idx + 1) + '\n' + formatSrtTime(item.from) + ' --> ' + formatSrtTime(item.to) + '\n' + ((item.content?.trim()) ?? '') + '\n\n'
        s += ss
      }
      s = s.substring(0, s.length - 1)// remove last '\n'
      suffix = 'srt'
    } else if (downloadType === 'vtt') {
      /**
       * WEBVTT title
       *
       * 1
       * 00:05:00.400 --> 00:05:15.300
       * This is an example of
       * a subtitle.
       *
       * 2
       * 00:05:16.400 --> 00:05:25.300
       * This is an example of
       * a subtitle - 2nd subtitle.
       */
      s = `WEBVTT ${title ?? ''}\n\n`
      for (const item of data.body) {
        const ss = (item.idx + 1) + '\n' + formatVttTime(item.from) + ' --> ' + formatVttTime(item.to) + '\n' + ((item.content?.trim()) ?? '') + '\n\n'
        s += ss
      }
      s = s.substring(0, s.length - 1)// remove last '\n'
      suffix = 'vtt'
    } else if (downloadType === 'json') {
      s = JSON.stringify(data)
      suffix = 'json'
    } else if (downloadType === 'summarize') {
      s = `${title??'无标题'}\n${url??'无链接'}\n${author??'无作者'} ${time}\n\n`
      const [success, content] = getSummarize({
        videoSummary,
      })
      if (!success) return
      s += content
      fileName += ' - 总结'
      suffix = 'txt'
    } else {
      return
    }
    if (download) {
      downloadText(s, fileName+'.'+suffix)
    } else {
      navigator.clipboard.writeText(s).then(() => {
        toast.success('复制成功')
      }).catch(console.error)
    }
    setMoreVisible(false)
  }, [author, ctime, data, downloadType, title, url, videoSummary])

  const downloadAudioCallback = useCallback(() => {
    sendInject(null, 'DOWNLOAD_AUDIO', {}).catch(error => {
      logMessagingError('DOWNLOAD_AUDIO', error)
    })
  }, [sendInject])

  const selectCallback = useCallback((e: any) => {
    dispatch(setTempData({
      downloadType: e.target.value,
    }))
  }, [dispatch])

  const preventCallback = useCallback((e: any) => {
    e.stopPropagation()
  }, [])

  const moreCallback = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    if (envData.flagDot !== true) {
      dispatch(setEnvData({
        ...envData,
        flagDot: true,
      }))
    }
    setMoreVisible(!moreVisible)
    // 显示菜单时自动展开，防止菜单显示不全
    if (!moreVisible) {
      eventBus.emit({
        type: EVENT_EXPAND
      })
    }
  }, [dispatch, envData, eventBus, moreVisible])
  useClickAway(() => {
    setMoreVisible(false)
  }, moreRef)

  return <>
  <div ref={moreRef}>
    <button aria-label='更多操作' className='bili-toolbar-button indicator flex items-center' onClick={moreCallback}>
      {envReady && envData.flagDot !== true && <span className="indicator-item bg-secondary w-1.5 h-1.5 rounded-full"></span>}
      <FiMoreVertical className='desc transition-colors duration-200 ease-out hover:text-primary' title='更多'/>
    </button>
  </div>
  {moreVisible &&
    <Popover refElement={moreRef.current} className='bili-popover text-base-content z-[1000] min-w-[220px]' options={{
      placement
    }}>
      <div className='flex flex-col gap-1'>
        <div className={menuRowClassName}>
          <button className='flex min-w-0 flex-1 items-center gap-3 text-left' onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            downloadCallback(false)
          }}>
            <span className={menuIconClassName}><RiFileCopy2Line className='h-4 w-4'/></span>
            <span className='flex-1'>复制</span>
          </button>
          <select className='select select-ghost select-xs h-8 min-h-0 rounded-full border border-base-300 bg-base-100 pr-7' value={downloadType} onChange={selectCallback}
                  onClick={preventCallback}>
            {DownloadTypes?.map((item: any) => <option key={item.type} value={item.type}>{item.name}</option>)}
          </select>
        </div>
        <div className={menuRowClassName}>
          <button className='flex min-w-0 flex-1 items-center gap-3 text-left' onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            downloadCallback(true)
          }}>
            <span className={menuIconClassName}><ImDownload3 className='h-4 w-4'/></span>
            <span className='flex-1'>下载</span>
          </button>
          <select className='select select-ghost select-xs h-8 min-h-0 rounded-full border border-base-300 bg-base-100 pr-7' value={downloadType} onChange={selectCallback}
                  onClick={preventCallback}>
            {DownloadTypes?.map((item: any) => <option key={item.type} value={item.type}>{item.name}</option>)}
          </select>
        </div>
        <button className={menuRowClassName} onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          downloadAudioCallback()
        }}>
          <span className={menuIconClassName}><ImDownload3 className='h-4 w-4'/></span>
          <span className='flex-1'>下载音频 (m4s)</span>
        </button>
        <button className={menuRowClassName} onClick={(e) => {
          chrome.runtime.openOptionsPage()
          setMoreVisible(false)
          e.preventDefault()
          e.stopPropagation()
        }}>
          <span className={menuIconClassName}><IoMdSettings className='h-4 w-4'/></span>
          <span className='flex-1'>选项</span>
        </button>
      </div>
    </Popover>}
  </>
}

export default MoreBtn
