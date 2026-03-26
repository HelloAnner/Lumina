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
  | "scout_analyze"
  | "scout_expand"
  | "note_chat"

// ─── Scout 类型 ───
export type ScoutChannelProtocol = "rss" | "x_api" | "webpage" | "newsletter"
export type ScoutChannelOrigin = "builtin" | "user"
export type ScoutSourceStatus = "active" | "paused" | "error"
export type ScoutTaskStatus = "active" | "paused"
export type ScoutPatchStatus = "pending" | "approved" | "merged" | "rejected" | "expanding"
export type ScoutEntryStatus = "raw" | "analyzing" | "matched" | "discarded"
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
  // 导入新增
  | "image"
  | "callout"
  | "task"
  | "table"
  | "mermaid"
  | "math"
  | "excalidraw"

/** 行内富文本标记 */
export interface InlineMark {
  type: "bold" | "italic" | "strike" | "code" | "link" | "highlight"
  attrs?: {
    href?: string
  }
}

/** 带格式的文本片段 */
export interface RichTextSegment {
  text: string
  marks?: InlineMark[]
}

/**
 * 笔记块基础字段
 */
export interface NoteBlockBase {
  id: string
  type: NoteBlockType
  /** 块排序序号 */
  sortOrder: number
  /** 来源引用（Scout 或导入） */
  sourceRef?:
    | { type: "scout"; patchId: string; sourceUrl: string; author?: string; fetchedAt: string }
    | { type: "import"; noteId: string; sourcePath: string }
}

/** 标题块 */
export interface HeadingBlock extends NoteBlockBase {
  type: "heading"
  level: 1 | 2 | 3
  text: string
  richText?: RichTextSegment[]
}

/** 段落块 */
export interface ParagraphBlock extends NoteBlockBase {
  type: "paragraph"
  text: string
  richText?: RichTextSegment[]
  /** 行内高亮区间 */
  inlineHighlights?: { start: number; end: number; color: string }[]
}

/** 引用块，来自原书 */
export interface QuoteBlock extends NoteBlockBase {
  type: "quote"
  text: string
  richText?: RichTextSegment[]
  sourceBookId?: string
  sourceBookTitle?: string
  sourceLocation?: string
  highlightId?: string
}

/** 关键洞察/高亮块 */
export interface HighlightBlock extends NoteBlockBase {
  type: "highlight"
  text: string
  richText?: RichTextSegment[]
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
  richText?: RichTextSegment[]
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

/** 图片块 */
export interface ImageBlock extends NoteBlockBase {
  type: "image"
  /** MinIO objectKey */
  objectKey: string
  /** 外部 URL（objectKey 为空时用此字段） */
  externalUrl?: string
  originalName: string
  alt?: string
  /** Obsidian 指定的显示宽度 */
  displayWidth?: number
  width?: number
  height?: number
}

/** Callout 块 */
export interface CalloutBlock extends NoteBlockBase {
  type: "callout"
  calloutType: string
  title?: string
  foldable: boolean
  defaultFolded: boolean
  children: NoteBlock[]
}

/** 任务项 */
export interface TaskItem {
  status: "unchecked" | "checked" | "deferred" | "cancelled"
  rawStatus: string
  text: string
  reminderDate?: string
  children?: TaskItem[]
  indent: number
}

/** 任务列表块 */
export interface TaskBlock extends NoteBlockBase {
  type: "task"
  items: TaskItem[]
}

/** 表格块 */
export interface TableBlock extends NoteBlockBase {
  type: "table"
  headers: string[]
  rows: string[][]
  alignments: ("left" | "center" | "right" | "none")[]
}

/** Mermaid 图表块 */
export interface MermaidBlock extends NoteBlockBase {
  type: "mermaid"
  code: string
}

/** 数学公式块 */
export interface MathBlock extends NoteBlockBase {
  type: "math"
  latex: string
  inline: boolean
}

/** Excalidraw 嵌入块 */
export interface ExcalidrawBlock extends NoteBlockBase {
  type: "excalidraw"
  sourcePath: string
  svgObjectKey?: string
  fallbackText: string
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
  | ImageBlock
  | CalloutBlock
  | TaskBlock
  | TableBlock
  | MermaidBlock
  | MathBlock
  | ExcalidrawBlock

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
/**
 * 笔记对话消息（前端状态，不持久化）
 */
export interface NoteChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  /** AI 建议的操作 */
  action?: NoteChatAction
  createdAt: string
}

/** AI 对话操作建议 */
export type NoteChatAction =
  | { type: "modify"; targetBlockId: string; block: NoteBlock }
  | { type: "insert"; blocks: NoteBlock[]; afterBlockId?: string }

export type TriggerType = "manual" | "cron" | "on_change"

export interface User {
  id: string
  email: string
  passwordHash: string
  name: string
  aggregateSchedule: "manual" | "daily" | "weekly"
  aggregateCron?: string
  /** 归档文章保留天数（0 表示永久保留） */
  archiveRetentionDays?: number
  /** 已读完文章自动归档天数（0 表示不自动归档） */
  autoArchiveAfterDays?: number
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
  coverVariant?: number
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
  /** 来源类型：书籍或文章 */
  sourceType?: "book" | "article"
  /** 关联的文章 ID（sourceType=article 时有效） */
  articleId?: string
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

export interface HighlightShortcuts {
  yellow: string
  green: string
  blue: string
  pink: string
  note: string
}

export interface ReaderSettings {
  userId: string
  fontSize: 14 | 16 | 18 | 20 | 22
  lineHeight: 1.5 | 1.6 | 1.75 | 2
  fontFamily: "system" | "serif" | "sans"
  theme: ReaderTheme
  navigationMode: "horizontal" | "vertical"
  translationView: TranslationDisplayMode
  highlightShortcuts?: HighlightShortcuts
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

// ─── Scout 数据模型 ───

/** 文章内容段落 */
export interface ArticleSection {
  id: string
  type: "heading" | "paragraph" | "image" | "code" | "blockquote" | "list"
  level?: 1 | 2 | 3
  text?: string
  src?: string
  alt?: string
  language?: string
  items?: string[]
}

/** 文章翻译缓存 */
export interface ArticleTranslation {
  id: string
  userId: string
  articleId: string
  sourceHash: string
  targetLanguage: string
  content: ArticleSection[]
  modelId?: string
  createdAt: string
  updatedAt: string
}

/** 互联网文章 */
export interface ScoutArticle {
  id: string
  userId: string
  entryId: string
  sourceId: string
  title: string
  author?: string
  sourceUrl: string
  channelName: string
  channelIcon: string
  publishedAt?: string
  topics: string[]
  summary: string
  content: ArticleSection[]
  readProgress: number
  lastReadPosition?: string
  lastReadAt?: string
  highlightCount: number
  language?: string
  /** 来源站点名（Readability 提取） */
  siteName?: string
  /** 首张图片 URL，用于列表封面 */
  coverImage?: string
  /** 是否正在阅读中（显式标记，点击阅读即为 true，手动归档才清除） */
  reading?: boolean
  /** 归档标记 */
  archived?: boolean
  /** 归档时间 */
  archivedAt?: string
  /** 翻译视图偏好 */
  translationView?: TranslationDisplayMode
  /** 翻译后标题（用于列表展示） */
  translatedTitle?: string
  status: "ready" | "processing" | "failed"
  createdAt: string
}

/** 文章主题分类 */
export interface ArticleTopic {
  id: string
  userId: string
  name: string
  description?: string
  articleCount: number
  sortOrder: number
  createdAt: string
}

/** 渠道参数定义 */
export interface ScoutChannelParam {
  name: string
  label: string
  placeholder: string
  required: boolean
  inputType: "text" | "select"
  options?: { label: string; value: string }[]
}

/** 渠道模板 */
export interface ScoutChannel {
  id: string
  userId?: string
  name: string
  description: string
  icon: string
  protocol: ScoutChannelProtocol
  origin: ScoutChannelOrigin
  tags: string[]
  endpointTemplate: string
  params: ScoutChannelParam[]
  defaultFetchCron: string
  requiresCredential: boolean
  credentialType?: string
  createdAt: string
}

/** 用户凭证 */
export interface ScoutCredential {
  id: string
  userId: string
  type: string
  name: string
  credentials: Record<string, string>
  verified: boolean
  lastVerifiedAt?: string
  createdAt: string
}

/** 信息源 */
export interface ScoutSource {
  id: string
  userId: string
  name: string
  channelId: string
  protocol: ScoutChannelProtocol
  endpoint: string
  paramValues: Record<string, string>
  status: ScoutSourceStatus
  includeKeywords: string[]
  excludeKeywords: string[]
  language?: string
  lastFetchedAt?: string
  lastError?: string
  totalFetched: number
  totalPatches: number
  createdAt: string
}

/** 搜寻任务 */
export interface ScoutTask {
  id: string
  userId: string
  name: string
  description?: string
  status: ScoutTaskStatus
  sourceIds: string[]
  scheduleCron?: string
  scopeViewpointIds: string[]
  relevanceThreshold: number
  maxPatchesPerRun: number
  lastRunAt?: string
  nextRunAt?: string
  totalRuns: number
  createdAt: string
  updatedAt: string
}

/** 抓取条目 */
export interface ScoutEntry {
  id: string
  userId: string
  sourceId: string
  taskId: string
  sourceUrl: string
  normalizedUrl: string
  contentHash: string
  status: ScoutEntryStatus
  title?: string
  content: string
  summary?: string
  author?: string
  publishedAt?: string
  extractedTags?: string[]
  matchedViewpoints?: { viewpointId: string; relevanceScore: number }[]
  articleId?: string
  fetchedAt: string
  analyzedAt?: string
}

/** 追问消息 */
export interface PatchThreadMessage {
  id: string
  role: "user" | "assistant"
  content: string
  updatedBlocks?: NoteBlock[]
  createdAt: string
}

/** 知识 Patch */
export interface ScoutPatch {
  id: string
  userId: string
  entryId: string
  sourceId: string
  taskId: string
  targetViewpointId: string
  targetViewpointTitle: string
  status: ScoutPatchStatus
  relevanceScore: number
  title: string
  rationale: string
  suggestedBlocks: NoteBlock[]
  insertAfterBlockId?: string
  sourceSnapshot: {
    url: string
    title?: string
    author?: string
    publishedAt?: string
    excerpt: string
  }
  thread?: PatchThreadMessage[]
  reviewNote?: string
  mergedAt?: string
  createdAt: string
  updatedAt: string
}

/** 搜寻执行记录 */
export interface ScoutJob {
  id: string
  userId: string
  taskId: string
  sourceIds: string[]
  triggeredBy: "cron" | "manual"
  status: "running" | "completed" | "failed"
  stages: {
    fetch: { total: number; completed: number; errors: number }
    analyze: { total: number; completed: number; errors: number }
    patch: { total: number; generated: number }
  }
  errorMessage?: string
  startedAt: string
  completedAt?: string
}

/** 搜寻全局配置 */
export interface ScoutConfig {
  userId: string
  enabled: boolean
  defaultRelevanceThreshold: number
  dailyPatchLimit: number
  entryRetentionDays: number
  rsshubBaseUrl?: string
}

// ─── 导入模块 ───

export type ImportJobStatus = "pending" | "running" | "committing" | "done" | "failed" | "rolling_back" | "cancelled"
export type ImportJobStage = "scanning" | "parsing" | "uploading" | "analyzing" | "linking"

export interface ImportSource {
  id: string
  userId: string
  type: "obsidian"
  name: string
  path: string
  excludePatterns: string[]
  lastSyncAt?: string
  createdAt: string
}

export interface ImportJob {
  id: string
  userId: string
  sourceId: string
  status: ImportJobStatus
  stage: ImportJobStage
  progress: {
    totalFiles: number
    totalImages: number
    processed: number
    total: number
    currentFile?: string
  }
  result?: {
    importedNotes: number
    importedImages: number
    newViewpoints: number
    linkedViewpoints: number
  }
  errorMessage?: string
  startedAt: string
  finishedAt?: string
}

export interface ImportedNote {
  id: string
  userId: string
  sourceId: string
  relativePath: string
  title: string
  frontmatter: Record<string, unknown>
  blocks: NoteBlock[]
  rawMarkdown: string
  contentHash: string
  tags: string[]
  wikilinks: string[]
  imageKeys: string[]
  importedAt: string
  lastSyncAt: string
}

export interface NoteViewpointLink {
  noteId: string
  viewpointId: string
  relevanceScore: number
  relatedBlockIds: string[]
  reason: string
  confirmed: boolean
  createdAt: string
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
  // Scout 模块
  scoutArticles: ScoutArticle[]
  articleTopics: ArticleTopic[]
  scoutChannels: ScoutChannel[]
  scoutCredentials: ScoutCredential[]
  scoutSources: ScoutSource[]
  scoutTasks: ScoutTask[]
  scoutEntries: ScoutEntry[]
  scoutPatches: ScoutPatch[]
  scoutJobs: ScoutJob[]
  scoutConfigs: ScoutConfig[]
  articleTranslations: ArticleTranslation[]
  // 导入模块
  importSources: ImportSource[]
  importJobs: ImportJob[]
  importedNotes: ImportedNote[]
  noteViewpointLinks: NoteViewpointLink[]
}
