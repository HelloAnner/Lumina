export type ReaderTheme = "day" | "sepia" | "night"
export type HighlightColor = "yellow" | "green" | "blue" | "pink"
export type BookFormat = "PDF" | "EPUB"
export type ModelCategory = "language" | "speech" | "embedding"
export type ModelFeature =
  | "instant_explain"
  | "article_generate"
  | "aggregation_analyze"
  | "voice_read"
  | "embedding_index"
export type PublishFormat = "markdown" | "html" | "pdf"
export type TriggerType = "manual" | "cron" | "on_change"

export interface User {
  id: string
  email: string
  passwordHash: string
  name: string
  aggregateSchedule: "manual" | "daily" | "weekly"
  aggregateCron?: string
  deletedAt?: string
  createdAt: string
}

export interface Book {
  id: string
  userId: string
  title: string
  author?: string
  format: BookFormat
  filePath: string
  coverPath?: string
  totalPages?: number
  readProgress: number
  lastReadAt?: string
  tags: string[]
  status: "READY" | "PROCESSING" | "PARSE_FAILED"
  synopsis: string
  toc: TocItem[]
  content: ReaderSection[]
  createdAt: string
}

export interface TocItem {
  id: string
  title: string
  pageIndex?: number
  href?: string
  level?: number
}

export interface ReaderSection {
  id: string
  title: string
  pageIndex: number
  content: string
  href?: string
  blocks?: ReaderSectionBlock[]
}

export interface PdfHighlightRect {
  left: number
  top: number
  width: number
  height: number
}

export type ReaderSectionBlock =
  | {
      type: "paragraph"
      text: string
    }
  | {
      type: "image"
      src: string
      alt?: string
      width?: number
      height?: number
    }

export interface Highlight {
  id: string
  userId: string
  bookId: string
  format: BookFormat
  pageIndex?: number
  pdfRects?: PdfHighlightRect[]
  paraOffsetStart?: number
  paraOffsetEnd?: number
  cfiRange?: string
  chapterHref?: string
  content: string
  note?: string
  color: HighlightColor
  status: "PENDING" | "PROCESSED"
  createdAt: string
}

export interface Viewpoint {
  id: string
  userId: string
  title: string
  parentId?: string
  isFolder: boolean
  isCandidate: boolean
  sortOrder: number
  highlightCount: number
  articleContent: string
  relatedBookIds: string[]
  lastSynthesizedAt?: string
  createdAt: string
}

export interface HighlightViewpoint {
  highlightId: string
  viewpointId: string
  similarityScore: number
  confirmed: boolean
}

export interface ViewpointRelation {
  sourceId: string
  targetId: string
  weight: number
}

export interface ModelConfig {
  id: string
  userId: string
  category: ModelCategory
  name: string
  baseUrl: string
  apiKey: string
  modelName: string
}

export interface ModelBinding {
  id: string
  userId: string
  feature: ModelFeature
  modelId: string
}

export interface StorageConfig {
  userId: string
  useCustom: boolean
  endpoint?: string
  accessKey?: string
  secretKey?: string
  bucket?: string
  region?: string
}

export interface ReaderSettings {
  userId: string
  fontSize: 14 | 16 | 18 | 20 | 22
  lineHeight: 1.5 | 1.6 | 1.75 | 2
  fontFamily: "system" | "serif" | "sans"
  theme: ReaderTheme
  navigationMode: "horizontal" | "vertical"
}

export interface PublishTarget {
  id: string
  userId: string
  name: string
  type: "webhook" | "kms"
  endpointUrl: string
  authHeader?: string
  extraConfig?: Record<string, string>
  createdAt: string
}

export interface PublishTask {
  id: string
  userId: string
  name: string
  viewpointIds: string[]
  targetId: string
  format: PublishFormat
  triggerType: TriggerType
  cronExpr?: string
  onChangeDelay?: number
  enabled: boolean
  createdAt: string
}

export interface PublishRecord {
  id: string
  taskId: string
  triggeredBy: TriggerType | "manual"
  status: "SUCCESS" | "FAILED" | "RUNNING"
  errorMsg?: string
  articleVersion: string
  executedAt: string
}

export interface AggregateJob {
  id: string
  userId: string
  status: "IDLE" | "RUNNING" | "DONE" | "FAILED"
  stage: string
  processed: number
  total: number
  updatedAt: string
}

export interface Database {
  users: User[]
  books: Book[]
  highlights: Highlight[]
  viewpoints: Viewpoint[]
  highlightViewpoints: HighlightViewpoint[]
  relations: ViewpointRelation[]
  modelConfigs: ModelConfig[]
  modelBindings: ModelBinding[]
  storageConfigs: StorageConfig[]
  readerSettings: ReaderSettings[]
  publishTargets: PublishTarget[]
  publishTasks: PublishTask[]
  publishRecords: PublishRecord[]
  aggregateJobs: AggregateJob[]
}
