import {IoIosArrowUp} from 'react-icons/io'
import {useCallback} from 'react'
import {useAppDispatch, useAppSelector} from '../hooks/redux'
import {find, remove} from 'lodash-es'
import {setCurFetched, setCurInfo, setData, setInfos, setUploadedTranscript} from '../redux/envReducer'
import MoreBtn from './MoreBtn'
import classNames from 'classnames'
import {parseTranscript} from '../utils/bizUtil'

const Header = (props: {
  foldCallback: () => void
  isDarkTheme: boolean
}) => {
  const {foldCallback, isDarkTheme} = props
  const dispatch = useAppDispatch()
  const infos = useAppSelector(state => state.env.infos)
  const curInfo = useAppSelector(state => state.env.curInfo)
  const fold = useAppSelector(state => state.env.fold)
  const uploadedTranscript = useAppSelector(state => state.env.uploadedTranscript)
  const envData = useAppSelector(state => state.env.envData)

  const upload = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.vtt,.srt'
    input.onchange = (e: any) => {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result
        if (typeof text === 'string' && text.length > 0) {
          const infos_ = [...(infos??[])]
          // const blob = new Blob([text], {type: 'text/plain'})
          // const url = URL.createObjectURL(blob)
          // remove old if exist
          remove(infos_, {id: 'uploaded'})
          // add new
          const tarInfo = {id: 'uploaded', subtitle_url: 'uploaded', lan_doc: '上传的字幕'}
          infos_.push(tarInfo)
          // set
          const transcript = parseTranscript(file.name, text)
          dispatch(setInfos(infos_))
          dispatch(setCurInfo(tarInfo))
          dispatch(setCurFetched(true))
          dispatch(setUploadedTranscript(transcript))
          dispatch(setData(transcript))
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [dispatch, infos])

  const selectCallback = useCallback((e: any) => {
    if (e.target.value === 'upload') {
      upload()
      return
    }

    const tarInfo = find(infos, {subtitle_url: e.target.value})
    if (curInfo?.id !== tarInfo?.id) {
      dispatch(setCurInfo(tarInfo))
      if (tarInfo != null && tarInfo.subtitle_url === 'uploaded') {
        dispatch(setCurFetched(true))
        dispatch(setData(uploadedTranscript))
      } else {
        dispatch(setCurFetched(false))
      }
    }
  }, [curInfo?.id, dispatch, infos, upload, uploadedTranscript])

  const preventCallback = useCallback((e: any) => {
    e.stopPropagation()
  }, [])

  const onUpload = useCallback((e: any) => {
    e.stopPropagation()
    upload()
  }, [upload])

  return <div className={classNames(
    'h-[48px] flex justify-between items-center cursor-pointer border-b border-base-300/70 px-3',
    fold !== true && 'rounded-bl-[10px] rounded-br-[10px]'
  )} style={{
    background: 'var(--bili-header-bg, #f4f4f4)',
    boxShadow: isDarkTheme ? 'inset 0 -1px 0 rgba(255,255,255,0.04)' : 'inset 0 -1px 0 rgba(24,25,28,0.025)',
  }} onClick={() => {
    if (envData.sidePanel !== true) {
      foldCallback()
    }
  }}>
    <div className='shrink-0 flex items-center gap-2'>
      <span className='shrink-0 text-[15px] font-semibold tracking-[-0.012em]'>字幕列表</span>
      <MoreBtn placement={'right-start'}/>
    </div>
    <div className='flex gap-1 items-center'>
      {(infos == null) || infos.length <= 0
        ?<div className='text-xs desc'>
          <button className='btn btn-xs btn-link min-h-0 h-auto px-0' onClick={onUpload}>上传(vtt/srt)</button>
          (未找到字幕)
      </div>
        :<select disabled={infos == null || infos.length <= 0} className='select select-ghost select-xs line-clamp-1 rounded-full border border-base-300 bg-base-100 pr-7' value={curInfo?.subtitle_url} onChange={selectCallback} onClick={preventCallback}>
          {infos?.map((item: any) => <option key={item.id} value={item.subtitle_url}>{item.lan_doc}</option>)}
          <option key='upload' value='upload'>上传(vtt/srt)</option>
        </select>}
      {envData.sidePanel !== true && <button
        aria-label={fold ? '展开字幕列表' : '折叠字幕列表'}
        className='bili-toolbar-button'
        onClick={(event) => {
          event.stopPropagation()
          foldCallback()
        }}
      >
        <IoIosArrowUp className={classNames('shrink-0 desc transition-transform duration-200 ease-out', fold ? 'rotate-180' : '')}/>
      </button>}
    </div>
  </div>
}

export default Header
