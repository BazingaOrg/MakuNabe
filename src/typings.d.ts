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
  apiKeyConfigured?: boolean
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
  fullText?: string
  segmentCount: number
  email?: SummarySessionEmailState
  videoSummary?: SummarySessionVideoSummarySnapshot
  segments: Record<string, SummarySessionSegmentSnapshot>
}

interface SummarySessionVideoSummarySnapshot {
  summary?: Summary
  updatedAt: number
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
  fullText?: string
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
