export type ReaderTheme = "day" | "sepia" | "night"
export type HighlightColor = "yellow" | "green" | "blue" | "pink"
export type BookFormat = "PDF" | "EPUB"
export type ModelCategory = "language" | "speech" | "embedding"
export type TranslationDisplayMode = "original" | "translation"
export type ModelFeature =
  | "instant_explain"
  | "article_generate"
  | "aggregation_analyze"
  | "voice_read"
  | "embedding_index"
  | "section_translate"
  | "annotation_rewrite"
export type PublishFormat = "markdown" | "html" | "pdf"
export type AnnotationStatus = "pending" | "processing" | "done" | "failed"

/**
 * 笔记块类型
 * 可扩展的块标识，用于企业级笔记面板渲染
 */
export type NoteBlockType =
  | "heading"
  | "paragraph"
  | "quote"
  | "highlight"
  | "insight"
  | "code"
  | "divider"
  | "chart"

/**
 * 笔记块基础字段
 */
export interface NoteBlockBase {
  id: string
  type: NoteBlockType
  /** 块排序序号 */
  sortOrder: number
}

/** 标题块 */
export interface HeadingBlock extends NoteBlockBase {
  type: "heading"
  level: 1 | 2 | 3
  text: string
}

/** 段落块 */
export interface ParagraphBlock extends NoteBlockBase {
  type: "paragraph"
  text: string
  /** 行内高亮区间 */
  inlineHighlights?: { start: number; end: number; color: string }[]
}

/** 引用块，来自原书 */
export interface QuoteBlock extends NoteBlockBase {
  type: "quote"
  text: string
  sourceBookId?: string
  sourceBookTitle?: string
  sourceLocation?: string
  highlightId?: string
}

/** 关键洞察/高亮块 */
export interface HighlightBlock extends NoteBlockBase {
  type: "highlight"
  text: string
  label?: string
  sourceBookId?: string
  sourceBookTitle?: string
  sourceLocation?: string
  highlightId?: string
}

/** AI 补充说明块 */
export interface InsightBlock extends NoteBlockBase {
  type: "insight"
  text: string
  label?: string
}

/** 代码块 */
export interface CodeBlock extends NoteBlockBase {
  type: "code"
  language?: string
  code: string
}

/** 分隔线块 */
export interface DividerBlock extends NoteBlockBase {
  type: "divider"
}

/** 图表块（预留） */
export interface ChartBlock extends NoteBlockBase {
  type: "chart"
  chartType: "bar" | "line" | "pie" | "radar"
  title?: string
  data: { label: string; value: number }[]
}

export type NoteBlock =
  | HeadingBlock
  | ParagraphBlock
  | QuoteBlock
  | HighlightBlock
  | InsightBlock
  | CodeBlock
  | DividerBlock
  | ChartBlock

/**
 * 批注模式：划词批注或直接对话
 */
export type AnnotationMode = "selection" | "chat"

/**
 * 批注：用户对笔记某个块或某段文本的修改指令
 * 提交后进入后台队列，由 AI 处理
 */
export interface Annotation {
  id: string
  userId: string
  viewpointId: string
  /** 批注模式 */
  mode: AnnotationMode
  /** 关联的块 ID，划词时指向具体块 */
  targetBlockId?: string
  /** 选中的原文片段（划词模式） */
  targetText?: string
  /** 用户的批注内容/指令 */
  comment: string
  status: AnnotationStatus
  /** AI 处理后的错误信息 */
  errorMessage?: string
  createdAt: string
  processedAt?: string
}

/**
 * 批注 AI 配置：独立的提示词和模型绑定
 */
export interface AnnotationConfig {
  userId: string
  /** 系统提示词，引导 AI 如何处理批注 */
  systemPrompt: string
  /** 是否自动处理（否则需手动触发） */
  autoProcess: boolean
}
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

export interface TocTranslationItem {
  id: string
  title: string
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
  contentMode: TranslationDisplayMode
  targetLanguage?: string
  counterpartContent?: string
  counterpartParaOffsetStart?: number
  counterpartParaOffsetEnd?: number
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
  /** 旧版 Markdown 内容（兼容保留） */
  articleContent: string
  /** 新版块状笔记内容 */
  articleBlocks?: NoteBlock[]
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
  translationView: TranslationDisplayMode
}

export interface BookTranslation {
  id: string
  userId: string
  bookId: string
  sectionId: string
  sectionIndex: number
  pageIndex: number
  chapterHref?: string
  sourceHash: string
  targetLanguage: string
  content: string
  blocks?: ReaderSectionBlock[]
  modelId?: string
  createdAt: string
  updatedAt: string
}

export interface BookTocTranslation {
  id: string
  userId: string
  bookId: string
  sourceHash: string
  targetLanguage: string
  items: TocTranslationItem[]
  modelId?: string
  createdAt: string
  updatedAt: string
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
  translations: BookTranslation[]
  tocTranslations: BookTocTranslation[]
  publishTargets: PublishTarget[]
  publishTasks: PublishTask[]
  publishRecords: PublishRecord[]
  aggregateJobs: AggregateJob[]
  annotations: Annotation[]
  annotationConfigs: AnnotationConfig[]
}
