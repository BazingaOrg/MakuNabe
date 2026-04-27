import React, {PropsWithChildren, useCallback, useEffect, useMemo, useState} from 'react'
import {setEnvData} from '../redux/envReducer'
import {useAppDispatch, useAppSelector} from '../hooks/redux'
import {
  CUSTOM_MODEL_TOKENS,
  DEFAULT_SERVER_URL_OPENAI,
  LANGUAGES,
  MODEL_DEFAULT,
  MODEL_MAP,
  PROMPT_TYPES,
  SUMMARY_STRATEGIES,
  SUMMARY_STRATEGY_DEFAULT,
  SUMMARIZE_LANGUAGE_DEFAULT,
  WORDS_RATE,
} from '../consts/const'
import {IoMdWarning} from 'react-icons/io'
import classNames from '@/utils/classNames'
import toast from 'react-hot-toast'
import {useEventTarget} from 'ahooks'
import { FaChevronDown, FaChevronUp } from 'react-icons/fa'
import { useMessage } from '@/hooks/useMessageService'
import useEventChecked from '@/hooks/useEventChecked'
import {downloadText} from '@/utils/util'
import {ConfigTransferError, decryptEnvDataFromImport, encryptEnvDataForExport, exportConfigFilename} from '@/utils/configTransfer'
import {sanitizeEnvData} from '@/utils/envSanitizer'

const OptionCard = ({ title, children, defaultExpanded = true }: { title: React.ReactNode, children: React.ReactNode, defaultExpanded?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <section className="bili-panel rounded-2xl mb-4 overflow-hidden">
      <button
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="text-[15px] font-semibold tracking-[-0.012em] text-base-content">{title}</div>
        <span className="bili-toolbar-button" aria-hidden>
          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
        </span>
      </button>
      <div className="border-t border-base-300/80" />
      {isExpanded && <div className="px-5 py-4">{children}</div>}
    </section>
  )
}

const FormItem = (props: {
  title: ShowElement
  tip?: string
  htmlFor?: string
} & PropsWithChildren) => {
  const {title, tip, htmlFor, children} = props
  const hasTip = typeof tip === 'string' && tip.length > 0
  return (
    <div className='bili-field flex items-start gap-4 mb-3'>
      <div className={classNames('w-[140px] shrink-0 pt-2 text-sm', hasTip && 'tooltip tooltip-right z-50')} data-tip={tip}>
        <label className={classNames('font-medium text-base-content/90', hasTip && 'border-b border-dotted border-current pb-[2px]')} htmlFor={htmlFor}>{title}</label>
      </div>
      <div className='flex-1 min-w-0'>
        {children}
      </div>
    </div>
  )
}

type ModelDiscoveryStatus = 'idle' | 'loading' | 'success' | 'error'

const OptionsPage = () => {
  const dispatch = useAppDispatch()
  const envData = useAppSelector(state => state.env.envData)
  const {sendExtension} = useMessage(false)
  const {value: sidePanelValue, setValue: setSidePanelChecked, onChange: setSidePanelValue} = useEventChecked(envData.sidePanel)
  const {value: autoInsertValue, setValue: setAutoInsertChecked, onChange: setAutoInsertValue} = useEventChecked(envData.manualInsert !== true)
  const {value: autoExpandValue, setValue: setAutoExpandChecked, onChange: setAutoExpandValue} = useEventChecked(envData.autoExpand)
  const {value: summarizeEnableValue, setValue: setSummarizeEnableChecked, onChange: setSummarizeEnableValue} = useEventChecked(envData.summarizeEnable)
  const {value: emailAutoSendEnabledValue, setValue: setEmailAutoSendEnabledChecked, onChange: setEmailAutoSendEnabledValue} = useEventChecked(envData.emailAutoSendEnabled)
  const {value: summarizeFloatValue, setValue: setSummarizeFloatChecked, onChange: setSummarizeFloatValue} = useEventChecked(envData.summarizeFloat)
  const {value: chapterModeValue, setValue: setChapterModeChecked, onChange: setChapterModeValue} = useEventChecked(envData.chapterMode ?? true)
  const [apiKeyValue, { onChange: onChangeApiKeyValue }] = useEventTarget({initialValue: ''})
  const [apiKeyConfiguredValue, setApiKeyConfiguredValue] = useState(envData.apiKeyConfigured === true)
  const [clearSavedApiKey, setClearSavedApiKey] = useState(false)
  const [serverUrlValue, setServerUrlValue] = useState(envData.serverUrl)
  const [modelValue, { onChange: onChangeModelValue }] = useEventTarget({initialValue: envData.model??MODEL_DEFAULT})
  const [customModelValue, { onChange: onChangeCustomModelValue }] = useEventTarget({initialValue: envData.customModel})
  const [customModelTokensValue, setCustomModelTokensValue] = useState(envData.customModelTokens)
  const [discoveredModelsValue, setDiscoveredModelsValue] = useState<string[]>(envData.discoveredModels ?? [])
  const [modelDiscoveryStatus, setModelDiscoveryStatus] = useState<ModelDiscoveryStatus>((envData.discoveredModels?.length ?? 0) > 0 ? 'success' : 'idle')
  const [modelDiscoveryError, setModelDiscoveryError] = useState<string>()
  const [summarizeLanguageValue, { onChange: onChangeSummarizeLanguageValue }] = useEventTarget({initialValue: envData.summarizeLanguage??SUMMARIZE_LANGUAGE_DEFAULT})
  const [summaryStrategyValue, { onChange: onChangeSummaryStrategyValue }] = useEventTarget({initialValue: envData.summaryStrategy ?? SUMMARY_STRATEGY_DEFAULT})
  const [emailRecipientValue, { onChange: onChangeEmailRecipientValue }] = useEventTarget({initialValue: envData.emailRecipient ?? ''})
  const [emailWebhookUrlValue, { onChange: onChangeEmailWebhookUrlValue }] = useEventTarget({initialValue: envData.emailWebhookUrl ?? ''})
  const [emailSubjectTemplateValue, { onChange: onChangeEmailSubjectTemplateValue }] = useEventTarget({initialValue: envData.emailSubjectTemplate ?? '[MakuNabe Summary] {{title}}'})
  const [themeValue, setThemeValue] = useState(envData.theme)
  const [fontSizeValue, setFontSizeValue] = useState(envData.fontSize)
  const [wordsValue, setWordsValue] = useState<number | undefined>(envData.words)
  const [promptsValue, setPromptsValue] = useState<{[key: string]: string}>(envData.prompts??{})
  const hasPendingApiKeyInput = useMemo(() => {
    return typeof apiKeyValue === 'string' && apiKeyValue.trim().length > 0
  }, [apiKeyValue])
  const apiKeyAvailable = useMemo(() => {
    if (clearSavedApiKey) {
      return hasPendingApiKeyInput
    }
    return apiKeyConfiguredValue || hasPendingApiKeyInput
  }, [apiKeyConfiguredValue, clearSavedApiKey, hasPendingApiKeyInput])
  const modelOptions = useMemo(() => {
    const selectedModel = (modelValue as string) ?? ''
    const options: Array<{code: string, name: string}> = discoveredModelsValue.map(modelName => ({
      code: modelName,
      name: modelName,
    }))

    if (selectedModel.length > 0 && selectedModel !== 'custom' && !options.some(option => option.code === selectedModel)) {
      options.unshift({
        code: selectedModel,
        name: selectedModel,
      })
    }

    options.push({
      code: 'custom',
      name: '自定义',
    })

    return options
  }, [discoveredModelsValue, modelValue])

  const triggerValueChange = useCallback((onChange: (event: any) => void, value: string) => {
    onChange({target: {value}})
  }, [])

  const getFormEnvData = useCallback((): EnvData => {
    return {
      sidePanel: sidePanelValue,
      manualInsert: autoInsertValue !== true,
      autoExpand: autoExpandValue,
      apiKeyConfigured: apiKeyAvailable,
      serverUrl: serverUrlValue,
      model: modelValue,
      customModel: customModelValue,
      customModelTokens: customModelTokensValue,
      discoveredModels: discoveredModelsValue,
      theme: themeValue,
      summarizeEnable: summarizeEnableValue,
      emailAutoSendEnabled: emailAutoSendEnabledValue,
      emailRecipient: emailRecipientValue,
      emailWebhookUrl: emailWebhookUrlValue,
      emailSubjectTemplate: emailSubjectTemplateValue,
      summarizeFloat: summarizeFloatValue,
      summarizeLanguage: summarizeLanguageValue,
      summaryStrategy: summaryStrategyValue as SummaryStrategyCode,
      words: wordsValue,
      fontSize: fontSizeValue,
      prompts: promptsValue,
      chapterMode: chapterModeValue,
    }
  }, [sidePanelValue, autoInsertValue, autoExpandValue, apiKeyAvailable, serverUrlValue, modelValue, customModelValue, customModelTokensValue, discoveredModelsValue, themeValue, summarizeEnableValue, emailAutoSendEnabledValue, emailRecipientValue, emailWebhookUrlValue, emailSubjectTemplateValue, summarizeFloatValue, summarizeLanguageValue, summaryStrategyValue, wordsValue, fontSizeValue, promptsValue, chapterModeValue])

  const applyFormEnvData = useCallback((nextEnvData: EnvData) => {
    setSidePanelChecked(nextEnvData.sidePanel)
    setAutoInsertChecked(!(nextEnvData.manualInsert ?? false))
    setAutoExpandChecked(nextEnvData.autoExpand)
    setSummarizeEnableChecked(nextEnvData.summarizeEnable)
    setEmailAutoSendEnabledChecked(nextEnvData.emailAutoSendEnabled)
    setSummarizeFloatChecked(nextEnvData.summarizeFloat)
    setChapterModeChecked(nextEnvData.chapterMode ?? true)

    triggerValueChange(onChangeApiKeyValue, '')
    setApiKeyConfiguredValue(nextEnvData.apiKeyConfigured === true)
    setClearSavedApiKey(false)
    setServerUrlValue(nextEnvData.serverUrl)
    triggerValueChange(onChangeModelValue, nextEnvData.model ?? MODEL_DEFAULT)
    triggerValueChange(onChangeCustomModelValue, nextEnvData.customModel ?? '')
    setCustomModelTokensValue(nextEnvData.customModelTokens)
    setDiscoveredModelsValue(nextEnvData.discoveredModels ?? [])
    setModelDiscoveryStatus((nextEnvData.discoveredModels?.length ?? 0) > 0 ? 'success' : 'idle')
    setModelDiscoveryError(undefined)
    triggerValueChange(onChangeSummarizeLanguageValue, nextEnvData.summarizeLanguage ?? SUMMARIZE_LANGUAGE_DEFAULT)
    triggerValueChange(onChangeSummaryStrategyValue, nextEnvData.summaryStrategy ?? SUMMARY_STRATEGY_DEFAULT)
    triggerValueChange(onChangeEmailRecipientValue, nextEnvData.emailRecipient ?? '')
    triggerValueChange(onChangeEmailWebhookUrlValue, nextEnvData.emailWebhookUrl ?? '')
    triggerValueChange(onChangeEmailSubjectTemplateValue, nextEnvData.emailSubjectTemplate ?? '[MakuNabe Summary] {{title}}')
    setThemeValue(nextEnvData.theme)
    setFontSizeValue(nextEnvData.fontSize)
    setWordsValue(nextEnvData.words)
    setPromptsValue(nextEnvData.prompts ?? {})
  }, [setSidePanelChecked, setAutoInsertChecked, setAutoExpandChecked, setSummarizeEnableChecked, setEmailAutoSendEnabledChecked, setSummarizeFloatChecked, setChapterModeChecked, triggerValueChange, onChangeApiKeyValue, onChangeModelValue, onChangeCustomModelValue, onChangeSummarizeLanguageValue, onChangeSummaryStrategyValue, onChangeEmailRecipientValue, onChangeEmailWebhookUrlValue, onChangeEmailSubjectTemplateValue])

  useEffect(() => {
    setApiKeyConfiguredValue(envData.apiKeyConfigured === true)
  }, [envData.apiKeyConfigured])

  useEffect(() => {
    sendExtension(null, 'GET_API_SECRET_STATUS').then((response) => {
      setApiKeyConfiguredValue(response.configured)
      setClearSavedApiKey(false)
      dispatch(setEnvData({
        apiKeyConfigured: response.configured,
      }))
    }).catch(console.error)
  }, [dispatch, sendExtension])

  const discoverModelsAndApply = useCallback(async (nextModelValue?: string) => {
    const trimmedApiKeyValue = typeof apiKeyValue === 'string' ? apiKeyValue.trim() : ''
    if (trimmedApiKeyValue.length === 0 && !apiKeyConfiguredValue) {
      throw new Error('API key is not configured')
    }
    if (trimmedApiKeyValue.length === 0 && clearSavedApiKey) {
      throw new Error('API key will be cleared after save')
    }

    setModelDiscoveryStatus('loading')
    setModelDiscoveryError(undefined)
    const response = await sendExtension(null, 'DISCOVER_MODELS', {
      serverUrl: serverUrlValue,
      apiKey: trimmedApiKeyValue.length > 0 ? trimmedApiKeyValue : undefined,
    })
    const models = response.models.filter(item => typeof item === 'string' && item.length > 0)
    if (models.length <= 0) {
      throw new Error('No models returned from server')
    }

    setDiscoveredModelsValue(models)
    setModelDiscoveryStatus('success')
    setModelDiscoveryError(undefined)

    let modelToUse = nextModelValue ?? modelValue
    if (modelToUse !== 'custom' && !models.includes(modelToUse as string)) {
      modelToUse = models[0]
      triggerValueChange(onChangeModelValue, modelToUse)
    }

    return {
      models,
      model: modelToUse as string,
    }
  }, [apiKeyConfiguredValue, apiKeyValue, clearSavedApiKey, modelValue, onChangeModelValue, sendExtension, serverUrlValue, triggerValueChange])

  const onExportConfig = useCallback(async () => {
    const passphrase = window.prompt('请输入用于加密导出配置的口令：')
    if (passphrase == null) {
      return
    }

    const passphraseConfirm = window.prompt('请再次输入口令：')
    if (passphraseConfirm == null) {
      return
    }

    if (passphrase !== passphraseConfirm) {
      toast.error('两次输入的口令不一致')
      return
    }

    try {
      const {apiKey} = await sendExtension(null, 'GET_API_SECRET', {})
      const encryptedConfig = await encryptEnvDataForExport({
        envData: getFormEnvData(),
        apiKey,
      }, passphrase)
      downloadText(JSON.stringify(encryptedConfig, null, 2), exportConfigFilename())
      toast.success('配置导出成功')
    } catch (error) {
      if (error instanceof ConfigTransferError) {
        toast.error(error.message)
      } else {
        toast.error('配置导出失败')
      }
    }
  }, [getFormEnvData])

  const onImportConfig = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement
      const file = target.files?.[0]
      if (file == null) {
        return
      }

      const passphrase = window.prompt('请输入用于解密导入配置的口令：')
      if (passphrase == null) {
        return
      }

      try {
        const fileText = await file.text()
        const importedConfig = await decryptEnvDataFromImport(fileText, passphrase)
        let importedApiKeyConfigured = false
        if (typeof importedConfig.apiKey === 'string' && importedConfig.apiKey.length > 0) {
          await sendExtension(null, 'SET_API_SECRET', {
            apiKey: importedConfig.apiKey,
          })
          const {configured} = await sendExtension(null, 'GET_API_SECRET_STATUS')
          if (configured !== true) {
            throw new Error('API key 恢复失败，请重新导入或手动填写')
          }
          importedApiKeyConfigured = true
        }
        const mergedEnvData = sanitizeEnvData({
          ...getFormEnvData(),
          ...importedConfig.envData,
          apiKeyConfigured: importedApiKeyConfigured
            ? true
            : importedConfig.envData.apiKeyConfigured,
        })
        if (mergedEnvData == null) {
          toast.error('导入的配置内容为空')
          return
        }

        applyFormEnvData(mergedEnvData)
        dispatch(setEnvData({
          apiKeyConfigured: mergedEnvData.apiKeyConfigured === true,
        }))
        toast.success('配置已导入，API key 已恢复到本地存储，请点击“保存”后生效')
      } catch (error) {
        if (error instanceof ConfigTransferError) {
          toast.error(error.message)
        } else {
          toast.error('配置导入失败')
        }
      }
    }
    input.click()
  }, [applyFormEnvData, getFormEnvData, sendExtension])

  const onSave = useCallback(async () => {
    const trimmedApiKeyValue = typeof apiKeyValue === 'string' ? apiKeyValue.trim() : ''
    let nextApiKeyConfigured = apiKeyConfiguredValue

    if (clearSavedApiKey) {
      await sendExtension(null, 'CLEAR_API_SECRET', {})
      nextApiKeyConfigured = false
    }

    if (trimmedApiKeyValue.length > 0) {
      await sendExtension(null, 'SET_API_SECRET', {
        apiKey: trimmedApiKeyValue,
      })
      nextApiKeyConfigured = true
    }

    let nextModel = (modelValue as string) ?? MODEL_DEFAULT
    let nextDiscoveredModels = discoveredModelsValue

    if (nextApiKeyConfigured) {
      try {
        const modelResult = await discoverModelsAndApply(nextModel)
        nextModel = modelResult.model
        nextDiscoveredModels = modelResult.models
      } catch (error: any) {
        const errorMessage = error?.message ?? '无法从服务端加载模型列表'
        const displayMessage = `模型发现失败：${String(errorMessage)}`
        setModelDiscoveryStatus('error')
        setModelDiscoveryError(displayMessage)
        toast.error('模型发现失败，已保留当前模型')
      }
    } else {
      setModelDiscoveryStatus('idle')
      setModelDiscoveryError(undefined)
    }

    dispatch(setEnvData({
      ...getFormEnvData(),
      apiKeyConfigured: nextApiKeyConfigured,
      model: nextModel,
      discoveredModels: nextDiscoveredModels,
      modelDiscoveryUpdatedAt: Date.now(),
    }))
    setApiKeyConfiguredValue(nextApiKeyConfigured)
    setClearSavedApiKey(false)
    triggerValueChange(onChangeApiKeyValue, '')
    dispatch(setEnvData({
      apiKeyConfigured: nextApiKeyConfigured,
    }))
    toast.success('保存成功')
    sendExtension(null, 'CLOSE_SIDE_PANEL')
    // 3秒后关闭
    setTimeout(() => {
      window.close()
    }, 3000)
  }, [apiKeyConfiguredValue, apiKeyValue, clearSavedApiKey, discoverModelsAndApply, dispatch, discoveredModelsValue, getFormEnvData, modelValue, onChangeApiKeyValue, sendExtension, triggerValueChange])

  const onCancel = useCallback(() => {
    window.close()
  }, [])

  const onRefreshModels = useCallback(async () => {
    try {
      await discoverModelsAndApply()
      toast.success('模型列表刷新成功')
    } catch (error: any) {
      const errorMessage = error?.message ?? '无法从服务端加载模型列表'
      const displayMessage = `模型发现失败：${String(errorMessage)}`
      setModelDiscoveryStatus('error')
      setModelDiscoveryError(displayMessage)
      toast.error('模型发现失败')
    }
  }, [discoverModelsAndApply])

  const onClearSavedApiKey = useCallback(() => {
    triggerValueChange(onChangeApiKeyValue, '')
    setApiKeyConfiguredValue(false)
    setClearSavedApiKey(true)
    setModelDiscoveryStatus('idle')
    setModelDiscoveryError(undefined)
  }, [onChangeApiKeyValue, triggerValueChange])

  const onClearSummaryHistory = useCallback(async () => {
    const confirmed = window.confirm('确定要清空所有已保存的视频总结历史吗？这个操作不会删除设置或 API key；已缓存的总结会被移除，如果有正在生成的总结，可能需要重新生成。')
    if (!confirmed) {
      return
    }

    try {
      const result = await sendExtension(null, 'CLEAR_SUMMARY_SESSIONS', {})
      toast.success(`已清空 ${result.deletedCount} 条历史总结`)
    } catch (error) {
      console.error(error)
      toast.error('清空历史总结失败')
    }
  }, [sendExtension])

  const onSelTheme1 = useCallback(() => {
    setThemeValue('system')
  }, [])

  const onSelTheme2 = useCallback(() => {
    setThemeValue('light')
  }, [])

  const onSelTheme3 = useCallback(() => {
    setThemeValue('dark')
  }, [])

  const onSelFontSize1 = useCallback(() => {
    setFontSizeValue('normal')
  }, [])

  const onSelFontSize2 = useCallback(() => {
    setFontSizeValue('large')
  }, [])

  return (
    <div className='container mx-auto max-w-4xl p-4 md:p-6 bg-base-200 min-h-screen'>
      <div className='mb-5 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-base-100 to-secondary/10 px-5 py-4'>
        <div className='text-lg font-semibold tracking-[-0.012em] text-base-content'>MakuNabe 设置</div>
        <div className='mt-1 text-sm desc'>面向 Bilibili 视频页的字幕辅助扩展配置。优先保证信息密度、清晰层级和轻量交互。</div>
      </div>
      <OptionCard title="通用配置">
        <FormItem title='侧边栏' htmlFor='sidePanel' tip='字幕列表是否显示在侧边栏'>
          <input id='sidePanel' type='checkbox' className='toggle toggle-primary' checked={sidePanelValue}
                 onChange={setSidePanelValue}/>
        </FormItem>
        {sidePanelValue !== true && <FormItem title='自动插入' htmlFor='autoInsert' tip='是否自动插入字幕列表(可以手动点击扩展图标插入)'>
          <input id='autoInsert' type='checkbox' className='toggle toggle-primary' checked={autoInsertValue}
                 onChange={setAutoInsertValue}/>
        </FormItem>}
        {sidePanelValue !== true && <FormItem title='自动展开' htmlFor='autoExpand' tip='是否视频有字幕时自动展开字幕列表'>
          <input id='autoExpand' type='checkbox' className='toggle toggle-primary' checked={autoExpandValue}
                 onChange={setAutoExpandValue}/>
        </FormItem>}
        <FormItem title='章节模式' htmlFor='chapterMode' tip='如果视频包含章节，则会按章节分割字幕列表，但总结始终基于全文生成'>
          <input id='chapterMode' type='checkbox' className='toggle toggle-primary' checked={chapterModeValue}
                 onChange={setChapterModeValue}/>
        </FormItem>
        <FormItem title='主题'>
          <div className="bili-segment-switch">
            <button onClick={onSelTheme1} className={classNames('bili-segment-switch-item', (themeValue == null || themeValue === 'system') && 'bili-segment-switch-item-active')}>系统</button>
            <button onClick={onSelTheme2} className={classNames('bili-segment-switch-item', themeValue === 'light' && 'bili-segment-switch-item-active')}>浅色</button>
            <button onClick={onSelTheme3} className={classNames('bili-segment-switch-item', themeValue === 'dark' && 'bili-segment-switch-item-active')}>深色</button>
          </div>
        </FormItem>
        <FormItem title='字体大小'>
          <div className="bili-segment-switch">
            <button onClick={onSelFontSize1} className={classNames('bili-segment-switch-item', (fontSizeValue == null || fontSizeValue === 'normal') && 'bili-segment-switch-item-active')}>普通</button>
            <button onClick={onSelFontSize2} className={classNames('bili-segment-switch-item', fontSizeValue === 'large' && 'bili-segment-switch-item-active')}>加大</button>
          </div>
        </FormItem>
      </OptionCard>

      <OptionCard title="AI 配置">
        {<FormItem title='ApiKey' htmlFor='apiKey'>
          <div className='flex flex-col gap-2'>
            <input id='apiKey' type='password' className='input input-sm input-bordered w-full' placeholder='sk-...'
                   value={apiKeyValue} onChange={(event) => {
                     setClearSavedApiKey(false)
                     onChangeApiKeyValue(event)
                   }}/>
            <div className='flex flex-wrap items-center gap-2 text-xs desc-lighter'>
              <span>
                {clearSavedApiKey
                  ? 'Saved API key will be cleared after you save.'
                  : (apiKeyConfiguredValue
                    ? 'A saved API key already exists in the extension background.'
                    : 'No saved API key yet.')}
              </span>
              {apiKeyConfiguredValue && !clearSavedApiKey && (
                <button className='btn btn-xs btn-outline' onClick={onClearSavedApiKey}>
                  Clear saved key
                </button>
              )}
            </div>
          </div>
        </FormItem>}
        {<FormItem title='服务器' htmlFor='serverUrl'>
          <input id='serverUrl' type='text' className='input input-sm input-bordered w-full'
                 placeholder={DEFAULT_SERVER_URL_OPENAI} value={serverUrlValue}
                 onChange={e => setServerUrlValue(e.target.value)}/>
        </FormItem>}
        {<FormItem title='模型选择' htmlFor='modelSel' tip='注意，不同模型有不同价格与token限制'>
          <select id='modelSel' className="select select-sm select-bordered" value={modelValue}
                  onChange={onChangeModelValue}>
            {modelOptions.map(model => <option key={model.code} value={model.code}>{model.name}</option>)}
          </select>
        </FormItem>}
        {<FormItem title='模型发现'>
          <div className='flex items-center gap-2'>
            <button className='btn btn-xs btn-outline' onClick={onRefreshModels} disabled={modelDiscoveryStatus === 'loading'}>
              {modelDiscoveryStatus === 'loading' ? '加载中...' : '刷新模型'}
            </button>
            {modelDiscoveryStatus === 'success' && <span className='text-xs text-success'>已发现 {discoveredModelsValue.length} 个模型</span>}
            {modelDiscoveryStatus === 'error' && <span className='text-xs text-error'>{modelDiscoveryError ?? '模型发现失败'}</span>}
          </div>
        </FormItem>}
        {modelValue === 'custom' && <FormItem title='模型名' htmlFor='customModel'>
          <input id='customModel' type='text' className='input input-sm input-bordered w-full' placeholder='llama2'
                 value={customModelValue} onChange={onChangeCustomModelValue}/>
        </FormItem>}
        {modelValue === 'custom' && <FormItem title='Token上限' htmlFor='customModelTokens'>
          <input id='customModelTokens' type='number' className='input input-sm input-bordered w-full'
                 placeholder={'' + CUSTOM_MODEL_TOKENS}
                 value={customModelTokensValue}
                 onChange={e => setCustomModelTokensValue(e.target.value.length > 0 ? parseInt(e.target.value) : undefined)}/>
        </FormItem>}
      </OptionCard>

      <OptionCard title={<div className='flex items-center'>
        总结配置
        {!apiKeyAvailable && <div className='tooltip tooltip-right ml-1' data-tip='未设置ApiKey无法使用'>
          <IoMdWarning className='text-sm text-warning'/>
        </div>}
      </div>}>
        <FormItem title='启用总结' htmlFor='summarizeEnable'>
          <input id='summarizeEnable' type='checkbox' className='toggle toggle-primary' checked={summarizeEnableValue}
                 onChange={setSummarizeEnableValue}/>
        </FormItem>
        <FormItem title='浮动窗口' htmlFor='summarizeFloat' tip='当前总结离开视野时,是否显示浮动窗口'>
          <input id='summarizeFloat' type='checkbox' className='toggle toggle-primary' checked={summarizeFloatValue}
                 onChange={setSummarizeFloatValue}/>
        </FormItem>
        <FormItem title='自动发邮件' htmlFor='emailAutoSendEnabled' tip='一个视频的全文总结完成后，自动发送一封汇总邮件'>
          <input id='emailAutoSendEnabled' type='checkbox' className='toggle toggle-primary' checked={emailAutoSendEnabledValue}
                 onChange={setEmailAutoSendEnabledValue}/>
        </FormItem>
        <FormItem title='历史总结' tip='清空保存在本机浏览器中的视频总结缓存，不影响设置和 API key'>
          <div className='flex flex-col gap-1'>
            <button className='btn btn-xs btn-outline active:scale-95 self-start' onClick={onClearSummaryHistory}>
              清空历史总结
            </button>
            <div className='text-xs desc-lighter'>
              默认会自动保留最近 7 天、最多 50 条历史总结；这里可手动立即清空。
            </div>
          </div>
        </FormItem>
        <FormItem title='默认收件人' htmlFor='emailRecipient' tip='多个收件人请用英文逗号分隔'>
          <input id='emailRecipient' type='text' className='input input-sm input-bordered w-full'
                 placeholder='you@example.com'
                 value={emailRecipientValue}
                 onChange={onChangeEmailRecipientValue}/>
        </FormItem>
        <FormItem title='回调地址' htmlFor='emailWebhookUrl' tip='扩展会以 JSON POST 的方式把总结内容发送到这个接口'>
          <input id='emailWebhookUrl' type='text' className='input input-sm input-bordered w-full'
                 placeholder='https://example.com/api/send-summary-email'
                 value={emailWebhookUrlValue}
                 onChange={onChangeEmailWebhookUrlValue}/>
        </FormItem>
        <FormItem title='邮件主题模板' htmlFor='emailSubjectTemplate' tip='支持占位符：{{title}} {{author}} {{date}}'>
          <input id='emailSubjectTemplate' type='text' className='input input-sm input-bordered w-full'
                 placeholder='[MakuNabe Summary] {{title}}'
                 value={emailSubjectTemplateValue}
                 onChange={onChangeEmailSubjectTemplateValue}/>
        </FormItem>
        <FormItem title='总结语言' htmlFor='summarizeLanguage'>
          <select id='summarizeLanguage' className="select select-sm select-bordered" value={summarizeLanguageValue} onChange={onChangeSummarizeLanguageValue}>
            {LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}
          </select>
        </FormItem>
        <FormItem title='总结策略' htmlFor='summaryStrategy' tip='控制总结速度、流式展示、自动重试和格式修复。'>
          <div className='flex flex-col gap-1'>
            <select id='summaryStrategy' className="select select-sm select-bordered" value={summaryStrategyValue} onChange={(event) => {
              onChangeSummaryStrategyValue({
                target: {
                  value: event.target.value as SummaryStrategyCode,
                },
              } as any)
            }}>
              {SUMMARY_STRATEGIES.map(strategy => <option key={strategy.code} value={strategy.code}>{strategy.name}</option>)}
            </select>
            <div className='text-xs desc-lighter'>
              {SUMMARY_STRATEGIES.find(strategy => strategy.code === summaryStrategyValue)?.tip}
            </div>
          </div>
        </FormItem>
        <FormItem htmlFor='words' title='分段字数' tip='注意，不同模型有不同字数限制'>
          <div className='flex-1 flex flex-col'>
            <input id='words' type='number' className='input input-sm input-bordered w-full' placeholder={`默认为上限x${WORDS_RATE}`} value={wordsValue??''} onChange={e => setWordsValue(e.target.value.length > 0 ? parseInt(e.target.value) : undefined)}/>
            {/* <input type="range" min={WORDS_MIN} max={WORDS_MAX} step={WORDS_STEP} value={wordsValue} className="range range-primary" onChange={onWordsChange} /> */}
            {/* <div className="w-full flex justify-between text-sm px-2"> */}
            {/*  {wordsList.map(words => <span key={words}>{words}</span>)} */}
            {/* </div> */}
          </div>
        </FormItem>
        <div className='desc text-sm px-1'>
          当前选择的模型的分段字数上限是<span className='font-semibold font-mono'>{MODEL_MAP[modelValue??MODEL_DEFAULT]?.tokens??'未知'}</span>
          （太接近上限总结会报错）
        </div>
      </OptionCard>
      <OptionCard title='提示词配置'>
        {PROMPT_TYPES.map((item) => <FormItem key={item.type} title={item.name} htmlFor={`prompt-${item.type}`}>
          <textarea id={`prompt-${item.type}`} className='mt-2 textarea input-bordered w-full'
                    placeholder='留空将使用内置默认提示词。支持变量：{{language}}、{{title}}、{{transcript}}。兼容旧变量：{{segment}}、{{subtitles}}。'
                    value={promptsValue[item.type] ?? ''} onChange={(e) => {
                      setPromptsValue({
                        ...promptsValue,
                        [item.type]: e.target.value
                      })
                    }}/>
        </FormItem>)}
      </OptionCard>

      <div className='bili-panel rounded-2xl flex flex-col justify-center items-center gap-4 mt-6 mb-4 px-5 py-5'>
        <div className='flex flex-wrap justify-center gap-3'>
          <button className='btn btn-sm btn-outline' onClick={onExportConfig}>导出配置</button>
          <button className='btn btn-sm btn-outline' onClick={onImportConfig}>导入配置</button>
        </div>
        <div className='desc text-xs text-center'>导入配置仅回填当前表单，点击“保存”后才会生效。</div>
        <button className='btn btn-primary btn-wide' onClick={onSave}>保存</button>
        <button className='btn btn-wide' onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

export default OptionsPage
