interface MethodContext {
  from: 'extension' | 'inject' | 'app'
  event: any
  tabId?: number
  // sender?: chrome.runtime.MessageSender | null
}

interface EnvData {
  sidePanel?: boolean
  manualInsert?: boolean // 是否手动插入字幕列表
  autoExpand?: boolean
  flagDot?: boolean

  // openai
  apiKey?: string
  serverUrl?: string
  model?: string
  customModel?: string
  customModelTokens?: number
  discoveredModels?: string[]
  modelDiscoveryUpdatedAt?: number

  summarizeEnable?: boolean
  summarizeLanguage?: string
  summaryStrategy?: SummaryStrategyCode
  words?: number
  summarizeFloat?: boolean
  emailAutoSendEnabled?: boolean
  emailRecipient?: string
  emailWebhookUrl?: string
  emailSubjectTemplate?: string
  theme?: 'system' | 'light' | 'dark'
  fontSize?: 'normal' | 'large'

  // chapter
  chapterMode?: boolean // 是否启用章节模式，undefined/null/true表示启用，false表示禁用

  prompts?: {
    [key: string]: string
  }
}

interface TempData {
  downloadType?: string
  compact?: boolean // 是否紧凑视图
  reviewActions?: number // 点击或总结行为达到一定次数后，显示评分（一个视频最多只加1次）
  reviewed?: boolean // 是否点击过评分,undefined: 不显示；true: 已点击；false: 未点击(需要显示)
  summaryEmailSentVideoKey?: string
}

interface TaskDef {
  type: 'chatComplete'
  serverUrl?: string
  data: any
  extra?: any
}

interface Task {
  id: string
  startTime: number
  endTime?: number
  def: TaskDef

  status: 'pending' | 'running' | 'done'
  error?: string
  resp?: any
}

interface SummarySessionSegmentSnapshot {
  startIdx: number
  endIdx: number
  text: string
  firstFrom?: number
  lastTo?: number
  summary?: Summary
  updatedAt: number
}

interface SummarySessionVideoMeta {
  url?: string
  title?: string
  ctime?: number | null
  author?: string
}

interface SummarySession {
  sessionKey: string
  createdAt: number
  updatedAt: number
  runStartedAt?: number
  videoMeta: SummarySessionVideoMeta
  segmentCount: number
  email?: SummarySessionEmailState
  segments: Record<string, SummarySessionSegmentSnapshot>
}

interface SummarySessionEmailState {
  status: 'idle' | 'pending' | 'done' | 'failed'
  lastAttemptAt?: number
  lastSentRunStartedAt?: number
  retryAt?: number
  error?: string
  attemptCount?: number
}

interface SummarySessionSyncSegmentInput {
  startIdx: number
  endIdx: number
  text: string
  firstFrom?: number
  lastTo?: number
}

interface SummarySessionSyncInput {
  sessionKey: string
  videoMeta: SummarySessionVideoMeta
  segments: SummarySessionSyncSegmentInput[]
}

type ShowElement = string | JSX.Element | undefined

interface Transcript {
  body: TranscriptItem[]
}

interface TranscriptItem {
  from: number
  to: number
  content: string

  idx: number
}

interface Chapter {
  from: number
  to: number
  content: string // 标题
}

interface Segment {
  items: TranscriptItem[]
  startIdx: number // 从1开始
  endIdx: number
  text: string
  fold?: boolean
  chapterTitle?: string // 章节标题
  summaries: {
    [type: string]: Summary
  }
}

interface Summary {
  type: SummaryType

  status: SummaryStatus
  error?: string
  content?: any
  streamingContent?: string
  recoveryStage?: SummaryRecoveryStage
}

/**
 * 总结
 */
interface BriefSummary extends Summary {
  content?: {
    summary: string
  }
}

type SummaryStatus = 'init' | 'pending' | 'done'
type SummaryType = 'brief'
type SummaryRecoveryStage = 'generating' | 'retrying' | 'repairing'
type SummaryStrategyCode = 'stable' | 'balanced' | 'fast'
