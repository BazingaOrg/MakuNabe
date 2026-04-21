import {PROMPT_DEFAULTS, PROMPT_TYPE_SUMMARIZE_BRIEF} from '../consts/const'

const hasOwn = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key)

const ENV_DATA_KEYS: Array<keyof EnvData> = [
  'sidePanel',
  'manualInsert',
  'autoExpand',
  'flagDot',
  'apiKey',
  'serverUrl',
  'model',
  'customModel',
  'customModelTokens',
  'discoveredModels',
  'modelDiscoveryUpdatedAt',
  'summarizeEnable',
  'summarizeLanguage',
  'summaryStrategy',
  'words',
  'summarizeFloat',
  'emailAutoSendEnabled',
  'emailRecipient',
  'emailWebhookUrl',
  'emailSubjectTemplate',
  'theme',
  'fontSize',
  'chapterMode',
  'prompts',
]

export const sanitizeEnvData = (data?: EnvData): EnvData | undefined => {
  if (data == null) {
    return undefined
  }

  const nextData: EnvData = {}
  const source = data as EnvData & Record<string, unknown>
  const nextDataRecord = nextData as Record<string, unknown>

  for (const key of ENV_DATA_KEYS) {
    if (hasOwn(source, key)) {
      nextDataRecord[key] = source[key]
    }
  }

  if (nextData.prompts != null) {
    const summaryPrompt = nextData.prompts[PROMPT_TYPE_SUMMARIZE_BRIEF]
    nextData.prompts = {
      [PROMPT_TYPE_SUMMARIZE_BRIEF]: typeof summaryPrompt === 'string'
        ? summaryPrompt
        : PROMPT_DEFAULTS[PROMPT_TYPE_SUMMARIZE_BRIEF],
    }
  }

  return nextData
}

export const sanitizeTempData = (data?: TempData): TempData | undefined => {
  if (data == null) {
    return undefined
  }

  return {
    downloadType: data.downloadType,
    compact: data.compact,
    reviewActions: data.reviewActions,
    reviewed: data.reviewed,
    summaryEmailSentVideoKey: data.summaryEmailSentVideoKey,
  }
}
