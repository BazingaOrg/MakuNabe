export const DEFAULT_USE_PORT = false

export const EVENT_EXPAND = 'expand'

export const APP_DOM_ID = 'makunabe'

export const IFRAME_ID = 'makunabe-iframe'

export const STORAGE_ENV = 'makunabe_env'
export const STORAGE_TEMP = 'makunabe_temp'

export const PROMPT_TYPE_SUMMARIZE_BRIEF = 'summarize_brief'
export const PROMPT_TYPES = [{
  name: '总结',
  type: PROMPT_TYPE_SUMMARIZE_BRIEF,
}]

export const SUMMARIZE_TYPES = {
  brief: {
    name: '总结',
    desc: '一句话总结',
    downloadName: '💡视频总结💡',
    promptType: PROMPT_TYPE_SUMMARIZE_BRIEF,
  },
}

export const PROMPT_DEFAULTS = {
  [PROMPT_TYPE_SUMMARIZE_BRIEF]: `你是一位专业的视频字幕总结专家，擅长处理各种类型视频（讲座、新闻、访谈、教程、纪录片、短视频、故事等）的字幕内容。

【任务要求】
用户将提供一段视频的完整字幕文本（可能是中文、英文，或中英混杂）。请严格按照以下步骤执行：

1. 字幕校对修正（必须先做这一步）
- 仔细检查并修正字幕中的错别字、拼写错误、语法错误、重复词语或不自然表达。
- 修正时保持原意不变，只做必要润色使语句通顺。
- 如果字幕是英文，请使用正确英文修正拼写和语法。

2. 内容总结（严格基于修正后的字幕）
- 绝对禁止凭空扩展、推测、添加背景知识、个人观点或不在字幕中的任何信息。
- 如果字幕内容很短（总字数少于 120 字或只有几句话），请在总结开头注明“【短视频字幕】”。
- 如果字幕明显不完整或有明显缺失，请在总结最后用一句话标注。

【输出要求】
- 输出语言必须为：{{language}}
- 必须只输出 markdown json 格式。
- 不得输出任何 JSON 之外的解释文字。
- JSON 必须严格为以下结构：

\`\`\`json
{
  "summary": "**主要主题：**\\n（用一句话概括整个视频的核心主题）\\n\\n**关键要点：**\\n- 要点1（简洁明确）\\n- 要点2\\n- 要点3\\n\\n**详细总结：**\\n（用一段或多段连贯文字，层次清晰地复述核心内容，语言客观、流畅，长度与原字幕信息量成正比）\\n\\n**说明：**\\n（仅在必要时填写；若无则不展示说明）"
}
\`\`\`

视频标题：
{{title}}

视频字幕全文：
{{transcript}}`,
}

export const SUMMARY_REPAIR_PROMPT = `You will receive a model output that should represent a JSON object with a single field named "summary".

Your task:
1. Preserve the original meaning.
2. Convert the content into valid JSON.
3. Output only the JSON object, with exactly this shape:
{"summary":"..."}
4. Do not add markdown fences, explanations, or extra fields.

If the original output already contains a useful summary body, keep it inside "summary" as markdown text.`

export const TASK_EXPIRE_TIME = 15*60*1000
export const SUMMARY_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
export const SUMMARY_SESSION_MAX_COUNT = 50
export const SUMMARY_EMAIL_PENDING_TIMEOUT_MS = 30 * 1000

export const PAGE_MAIN = 'main'
export const PAGE_SETTINGS = 'settings'

export const TOTAL_HEIGHT_MIN = 400
export const TOTAL_HEIGHT_DEF = 520
export const TOTAL_HEIGHT_MAX = 800
export const HEADER_HEIGHT = 48
export const TITLE_HEIGHT = 24
export const SEARCH_BAR_HEIGHT = 32
export const RECOMMEND_HEIGHT = 36

export const WORDS_RATE = 0.75
export const WORDS_MIN = 500
export const WORDS_MAX = 16000
export const WORDS_STEP = 500
export const SUMMARIZE_THRESHOLD = 100
export const SUMMARIZE_LANGUAGE_DEFAULT = 'cn'
export const SUMMARY_STRATEGY_DEFAULT: SummaryStrategyCode = 'balanced'
export const SUMMARIZE_ALL_THRESHOLD = 5
export const DEFAULT_SERVER_URL_OPENAI = 'https://api.openai.com'
export const DEFAULT_SERVER_URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/'
export const CUSTOM_MODEL_TOKENS = 16385

export interface ModelConfig {
  code: string
  name: string
  tokens?: number
}

export const MODELS: ModelConfig[] = [{
  code: 'custom',
  name: '自定义',
}]

/**
 * Keep token metadata for known models so request sizing remains stable
 * even when model dropdown is driven by runtime discovery.
 */
export const KNOWN_MODEL_TOKENS: Record<string, number> = {
  'gpt-4o-mini': 128000,
  'gpt-3.5-turbo-0125': 16385,
  'gpt-4o': 128000,
  'gpt-4.1-mini': 128000,
}

export const MODEL_DEFAULT = MODELS[0].code
export const MODEL_MAP: {[key: string]: ModelConfig} = {}
for (const model of MODELS) {
  MODEL_MAP[model.code] = model
}
for (const [modelCode, modelTokens] of Object.entries(KNOWN_MODEL_TOKENS)) {
  MODEL_MAP[modelCode] = {
    code: modelCode,
    name: modelCode,
    tokens: modelTokens,
  }
}

export const SUMMARY_STRATEGIES: Array<{
  code: SummaryStrategyCode
  name: string
  tip: string
  temperature: number
  stream: boolean
  autoRetry: boolean
  autoRepair: boolean
}> = [{
  code: 'stable',
  name: '稳定',
  tip: '更保守，优先降低格式错误，启用自动重试和格式修复。',
  temperature: 0.1,
  stream: false,
  autoRetry: true,
  autoRepair: true,
}, {
  code: 'balanced',
  name: '平衡',
  tip: '默认策略，兼顾速度与稳定性，启用流式、自动重试和格式修复。',
  temperature: 0.2,
  stream: true,
  autoRetry: true,
  autoRepair: true,
}, {
  code: 'fast',
  name: '快速',
  tip: '优先更快返回，保留流式，关闭自动重试和格式修复。',
  temperature: 0.3,
  stream: true,
  autoRetry: false,
  autoRepair: false,
}]

export const SUMMARY_STRATEGY_MAP: Record<SummaryStrategyCode, typeof SUMMARY_STRATEGIES[number]> = {
  stable: SUMMARY_STRATEGIES[0],
  balanced: SUMMARY_STRATEGIES[1],
  fast: SUMMARY_STRATEGIES[2],
}

export const LANGUAGES = [{
  code: 'en',
  name: 'English',
}, {
  code: 'ja',
  name: '日本語',
}, {
  code: 'ena',
  name: 'American English',
}, {
  code: 'enb',
  name: 'British English',
}, {
  code: 'cn',
  name: '中文简体',
}, {
  code: 'cnt',
  name: '中文繁体',
}, {
  code: 'Spanish',
  name: 'español',
}, {
  code: 'French',
  name: 'Français',
}, {
  code: 'Arabic',
  name: 'العربية',
}, {
  code: 'Russian',
  name: 'русский',
}, {
  code: 'German',
  name: 'Deutsch',
}, {
  code: 'Portuguese',
  name: 'Português',
}, {
  code: 'Italian',
  name: 'Italiano',
}, {
  code: 'ko',
  name: '한국어',
}, {
  code: 'hi',
  name: 'हिन्दी',
}, {
  code: 'tr',
  name: 'Türkçe',
}, {
  code: 'nl',
  name: 'Nederlands',
}, {
  code: 'pl',
  name: 'Polski',
}, {
  code: 'sv',
  name: 'Svenska',
}, {
  code: 'vi',
  name: 'Tiếng Việt',
}, {
  code: 'th',
  name: 'ไทย',
}, {
  code: 'id',
  name: 'Bahasa Indonesia',
}, {
  code: 'el',
  name: 'Ελληνικά',
}, {
  code: 'he',
  name: 'עברית',
}]
export const LANGUAGES_MAP: {[key: string]: typeof LANGUAGES[number]} = {}
for (const language of LANGUAGES) {
  LANGUAGES_MAP[language.code] = language
}
