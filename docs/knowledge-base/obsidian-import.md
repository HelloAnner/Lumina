# 知识库 — Obsidian 导入

> 依赖：知识库基础、聚合引擎
> 核心目标：从 Obsidian Vault 无损导入笔记（含图片及全部 Obsidian 语法），借助 LLM 自动拆分观点并归属到知识库观点树

---

## 1. 概述

用户选择一个 Obsidian Vault 目录后，系统扫描全部 `.md` 文件及其引用的图片资源，
将笔记内容无损转换为 NoteBlock 序列存储（图片上传至 MinIO），
同时通过 LLM 对每篇笔记进行「观点拆分」——识别笔记中包含的核心观点，
将其匹配到已有观点或新建观点，建立笔记与观点之间的多对多关系。

**笔记是原料，观点是提炼物。一篇笔记可以喂养多个观点，一个观点可以汇聚多篇笔记的片段。**

导入遵循事务语义：**要么全量成功，要么全量失败**。不存在「导了一半」的中间状态。

---

## 2. 核心概念

### 2.1 ImportedNote（导入笔记）

从外部来源无损导入的原始笔记，保留完整内容（含图片），不做删减。
它是观点的「上游素材」，通过 `NoteViewpointLink` 与观点建立多对多关系。

### 2.2 NoteViewpointLink（笔记 - 观点关联）

一篇笔记中可能包含多个不同观点的论据或论述。
LLM 在分析时标注每个关联对应的**笔记片段范围**（blockId 区间），
使得观点文章可以精准引用笔记中的相关段落。

### 2.3 ImportSource（导入来源）

记录用户配置的导入来源（本期仅 Obsidian），包括路径、过滤规则、上次同步时间等。
为后续支持更多来源（Notion、Logseq、本地文件夹）预留扩展点。

---

## 3. 数据结构

### 3.1 ImportSource

```typescript
interface ImportSource {
  id: string
  userId: string
  /** 来源类型，本期仅 obsidian */
  type: "obsidian"
  /** 来源显示名 */
  name: string
  /** Vault 绝对路径 */
  path: string
  /** 排除的目录/文件 glob 列表，默认排除 .obsidian/, .trash/ */
  excludePatterns: string[]
  /** 上次同步时间 */
  lastSyncAt?: string
  createdAt: string
}
```

### 3.2 ImportJob

```typescript
type ImportJobStatus = "pending" | "running" | "committing" | "done" | "failed" | "rolling_back" | "cancelled"

/** 管线阶段，按顺序推进 */
type ImportJobStage = "scanning" | "parsing" | "uploading" | "analyzing" | "linking"

interface ImportJob {
  id: string
  userId: string
  sourceId: string
  status: ImportJobStatus
  /** 当前管线阶段 */
  stage: ImportJobStage
  /** 各阶段进度 */
  progress: {
    /** 扫描到的文件总数 */
    totalFiles: number
    /** 扫描到的图片总数 */
    totalImages: number
    /** 当前阶段已处理数 */
    processed: number
    /** 当前阶段总数（随阶段变化） */
    total: number
    /** 当前正在处理的文件名 */
    currentFile?: string
  }
  /** 结果统计（完成后填入） */
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
```

### 3.3 ImportedNote

```typescript
interface ImportedNote {
  id: string
  userId: string
  sourceId: string
  /** 相对于 Vault 根目录的文件路径 */
  relativePath: string
  /** 原始文件名（不含扩展名） */
  title: string
  /** Obsidian frontmatter 元数据 */
  frontmatter: Record<string, unknown>
  /** 无损转换后的块序列 */
  blocks: NoteBlock[]
  /** 原始 Markdown 全文（保底备份，确保无损） */
  rawMarkdown: string
  /** 文件 SHA-256 哈希，用于增量同步时判断变更 */
  contentHash: string
  /** Obsidian 标签（从 frontmatter.tags + 正文 #tag 提取，含层级如 #算法/二叉树） */
  tags: string[]
  /** Obsidian 双链引用（[[...]]） */
  wikilinks: string[]
  /** 该笔记引用的图片 objectKey 列表 */
  imageKeys: string[]
  importedAt: string
  lastSyncAt: string
}
```

### 3.4 NoteViewpointLink

```typescript
interface NoteViewpointLink {
  noteId: string
  viewpointId: string
  /** LLM 判断的相关性分数 0~1 */
  relevanceScore: number
  /** 该笔记中与此观点相关的块 ID 列表 */
  relatedBlockIds: string[]
  /** LLM 给出的关联理由（一句话） */
  reason: string
  /** 用户是否已确认 */
  confirmed: boolean
  createdAt: string
}
```

### 3.5 新增块类型

在现有 NoteBlock 联合类型中新增以下块类型，以完整覆盖 Obsidian 语法：

```typescript
/** 图片块 */
interface ImageBlock extends NoteBlockBase {
  type: "image"
  /** MinIO objectKey，通过 /api/import/images/:key 代理访问 */
  objectKey: string
  /** 外部 URL（objectKey 为空时用此字段直接渲染） */
  externalUrl?: string
  /** 原始文件名 */
  originalName: string
  /** alt 文本 */
  alt?: string
  /** Obsidian 指定的显示宽度（如 ![[img|400]] 中的 400） */
  displayWidth?: number
  /** 图片原始宽度（像素） */
  width?: number
  /** 图片原始高度（像素） */
  height?: number
}

/** Callout 块（> [!type] title） */
interface CalloutBlock extends NoteBlockBase {
  type: "callout"
  /** callout 类型：info, warning, tip, note, danger, abstract, todo, example, quote 等 */
  calloutType: string
  /** 自定义标题（可选，默认用 calloutType 首字母大写） */
  title?: string
  /** 是否可折叠 */
  foldable: boolean
  /** 默认是否折叠 */
  defaultFolded: boolean
  /** callout 内部内容（递归块序列） */
  children: NoteBlock[]
}

/** 任务列表块 */
interface TaskBlock extends NoteBlockBase {
  type: "task"
  items: TaskItem[]
}

interface TaskItem {
  /** 任务状态：unchecked, checked, deferred, cancelled 等 */
  status: "unchecked" | "checked" | "deferred" | "cancelled"
  /** 原始状态字符（- [ ], - [x], - [>], - [-]） */
  rawStatus: string
  text: string
  /** 提醒日期（(@2024-07-22) 语法） */
  reminderDate?: string
  /** 嵌套子任务 */
  children?: TaskItem[]
  /** 缩进层级 */
  indent: number
}

/** 表格块 */
interface TableBlock extends NoteBlockBase {
  type: "table"
  /** 表头 */
  headers: string[]
  /** 表格行 */
  rows: string[][]
  /** 列对齐方式 */
  alignments: ("left" | "center" | "right" | "none")[]
}

/** Mermaid 图表块 */
interface MermaidBlock extends NoteBlockBase {
  type: "mermaid"
  /** Mermaid 源码 */
  code: string
}

/** 数学公式块 */
interface MathBlock extends NoteBlockBase {
  type: "math"
  /** LaTeX 源码 */
  latex: string
  /** 行内公式 or 块级公式 */
  inline: boolean
}

/** Excalidraw 嵌入块 */
interface ExcalidrawBlock extends NoteBlockBase {
  type: "excalidraw"
  /** 原始 .excalidraw.md 文件的相对路径 */
  sourcePath: string
  /** 导出为 SVG 后的 objectKey（上传至 MinIO） */
  svgObjectKey?: string
  /** 降级显示：Excalidraw 中的文本元素拼接 */
  fallbackText: string
}
```

NoteBlockType 扩展：

```typescript
type NoteBlockType =
  | "heading" | "paragraph" | "quote" | "highlight"
  | "insight" | "code" | "divider" | "chart"
  // 导入新增
  | "image" | "callout" | "task" | "table"
  | "mermaid" | "math" | "excalidraw"
```

NoteBlock 联合类型同步扩展：

```typescript
type NoteBlock =
  | HeadingBlock | ParagraphBlock | QuoteBlock | HighlightBlock
  | InsightBlock | CodeBlock | DividerBlock | ChartBlock
  | ImageBlock | CalloutBlock | TaskBlock | TableBlock
  | MermaidBlock | MathBlock | ExcalidrawBlock
```

### 3.6 ParagraphBlock 行内格式扩展

ParagraphBlock 的 `text` 字段需要保留 Obsidian 的行内富文本标记，渲染时解析为对应样式：

| 语法 | 含义 | 渲染 |
|------|------|------|
| `**bold**` | 粗体 | `<strong>` |
| `*italic*` | 斜体 | `<em>` |
| `==highlight==` | 高亮 | `<mark>` 默认黄色背景 |
| `<mark style="background: #BBFABBA6;">text</mark>` | Highlightr 插件彩色高亮 | `<mark>` 保留原始背景色 |
| `<u>text</u>` | 下划线 | `<u>` |
| `~~strikethrough~~` | 删除线 | `<del>` |
| `` `inline code` `` | 行内代码 | `<code>` |
| `[[target\|display]]` | Wikilink | 渲染为文本 `display`，hover 显示 `target` |
| `[text](url)` | 外部链接 | `<a>` 可点击 |
| `$latex$` | 行内公式 | KaTeX 渲染 |

这些标记在 `text` 中保留原始语法，由前端渲染器统一解析。不做服务端预处理。

### 3.7 Database 扩展

```typescript
interface Database {
  // ... 现有字段 ...
  importSources: ImportSource[]
  importJobs: ImportJob[]
  importedNotes: ImportedNote[]
  noteViewpointLinks: NoteViewpointLink[]
}
```

---

## 4. 导入流程

### 4.1 整体管线

```
用户选择 Vault 目录 → 跳转导入进度页
       │
       ▼
  ┌─────────────┐
  │  1. 扫描     │  递归遍历 .md + 图片 + .excalidraw.md，排除配置的 glob
  └──────┬──────┘  产出：文件清单 + 图片清单
         ▼
  ┌─────────────┐
  │  2. 解析     │  逐文件：frontmatter → Markdown AST → NoteBlock[]
  └──────┬──────┘  全部 Obsidian 语法转为对应块类型
         ▼
  ┌─────────────┐
  │  3. 上传图片  │  将引用到的图片/Excalidraw SVG 上传至 MinIO
  └──────┬──────┘  回填 objectKey，记录 imageKeys
         ▼
  ┌─────────────┐
  │  4. 分析     │  LLM 对每篇笔记提取观点列表（见 §5 Prompt）
  └──────┬──────┘  Frontmatter tags 作为辅助信号
         ▼
  ┌─────────────┐
  │  5. 关联     │  匹配已有观点或新建，写入 NoteViewpointLink
  └──────┬──────┘  观点文章中插入引用块
         ▼
  ┌─────────────┐
  │  6. 提交     │  所有数据一次性写入数据库（事务提交）
  └─────────────┘
```

### 4.2 事务语义

导入是全量操作：**要么全部成功写入，要么回滚到导入前的状态**。

实现方式：
1. 整个管线（扫描 → 解析 → 上传 → 分析 → 关联）在内存中完成，产出一组待写入数据
2. 图片上传至 MinIO 是唯一的外部副作用，先上传到临时前缀 `_staging/{jobId}/` 下
3. 全部阶段成功后，进入 `committing` 状态：
   - MinIO：将 `_staging/{jobId}/*` 批量 rename 到正式路径 `imports/{sourceId}/`
   - 数据库：一次 `mutateDatabase()` 调用写入全部 importedNotes + noteViewpointLinks + 新 viewpoints
4. 任一阶段失败或用户取消 → 进入 `rolling_back` 状态：
   - 清理 MinIO `_staging/{jobId}/` 下所有已上传文件
   - 内存数据丢弃，数据库无变更
   - Job 状态置为 `failed` 或 `cancelled`

```typescript
async function executeImport(job: ImportJob, signal: AbortSignal): Promise<void> {
  const pendingData = {
    notes: [] as ImportedNote[],
    links: [] as NoteViewpointLink[],
    newViewpoints: [] as Viewpoint[],
    stagedImageKeys: [] as string[],
  }

  try {
    await scanStage(job, pendingData, signal)
    await parseStage(job, pendingData, signal)
    await uploadStage(job, pendingData, signal)
    await analyzeStage(job, pendingData, signal)
    await linkStage(job, pendingData, signal)

    // 提交
    updateJobStatus(job, "committing")
    await promoteStagedImages(job.id, job.sourceId)
    commitToDatabase(pendingData)
    updateJobStatus(job, "done")
  } catch (error) {
    updateJobStatus(job, "rolling_back")
    await cleanupStagedImages(job.id)
    if (signal.aborted) {
      updateJobStatus(job, "cancelled")
    } else {
      updateJobStatus(job, "failed", error.message)
    }
  }
}
```

### 4.3 取消导入

用户可在进度页点击「取消」中断正在进行的导入。

实现方式：
- 后端使用 `AbortController` / `AbortSignal` 贯穿整个管线
- 前端调用 `POST /api/import/jobs/:id/cancel`，后端触发 `abort()`
- 每个阶段在循环体内检查 `signal.aborted`，尽早退出
- 取消后走标准回滚流程：清理 staging 图片，Job 状态置为 `cancelled`
- 取消是尽力而为的（best-effort），不保证立即停止（LLM 调用中的请求会等待返回或超时）

### 4.4 并发防护

同一个 ImportSource 同时只允许一个 running 的 ImportJob：
- `POST /api/import/sources/:id/sync` 时检查该 sourceId 是否有 `status = running | committing` 的 Job
- 有 → 返回 409 Conflict，前端提示「该来源正在导入中」并跳转到现有 Job 的进度页
- 无 → 正常创建新 Job

### 4.5 扫描阶段

```typescript
interface ScanResult {
  mdFiles: string[]
  imageFiles: Map<string, string>        // 相对路径 → 绝对路径
  excalidrawFiles: Map<string, string>   // .excalidraw.md 相对路径 → 绝对路径
}

async function scanVault(vaultPath: string, excludePatterns: string[]): Promise<ScanResult> {
  // 1. 递归遍历 vaultPath，收集 .md / .excalidraw.md / 图片文件
  // 2. 排除匹配 excludePatterns 的路径
  // 3. 默认排除：[".obsidian/**", ".trash/**", "node_modules/**"]
  // 4. .excalidraw.md 单独收集，不作为普通笔记解析
  // 5. 图片仅收集被 .md 引用的（解析阶段反向标记）
}
```

### 4.6 解析阶段

#### Markdown → NoteBlock 完整转换规则

| Obsidian 语法 | NoteBlock 类型 | 说明 |
|---------------|---------------|------|
| `# / ## / ###` | HeadingBlock | level 对应 1/2/3 |
| 普通段落 | ParagraphBlock | 保留全部行内格式（见 §3.6） |
| `> 普通引用` | QuoteBlock | text 取引用内容 |
| `> [!type] title` | **CalloutBlock** | 解析 type/title/foldable，内容递归解析为 children |
| `` ```lang ... ``` `` | CodeBlock | language + code |
| `` ```mermaid ... ``` `` | **MermaidBlock** | 单独类型，前端用 mermaid.js 渲染 |
| `$$...$$` | **MathBlock** | inline: false，前端用 KaTeX 渲染 |
| `$...$`（独占一行） | **MathBlock** | inline: true |
| `---` | DividerBlock | — |
| `- [ ] / - [x] / - [>] / - [-]` | **TaskBlock** | 支持嵌套、自定义状态、(@date) 提醒 |
| `![alt](path)` | **ImageBlock** | 标准 Markdown 图片 |
| `![[image.png]]` | **ImageBlock** | Obsidian 嵌入图片 |
| `![[image.png\|400]]` | **ImageBlock** | displayWidth = 400 |
| `![[file.excalidraw]]` | **ExcalidrawBlock** | 导出 SVG 或降级为文本 |
| `![[note]]` | ParagraphBlock | 非图片/非 Excalidraw 嵌入 → `[嵌入: note]` |
| `\|表头\|...\|` | **TableBlock** | 解析为结构化 headers/rows/alignments |
| `[[target\|display]]` | — | 提取到 wikilinks，正文保留原始语法（渲染时解析） |
| `#tag` / `#tag/subtag` | — | 提取到 tags（含层级） |
| `%%comment%%` | — | **静默丢弃**，不生成块，不保留 |
| `^blockId` | — | 块尾标记，存入 block metadata 但不渲染 |
| `<mark style="...">` | ParagraphBlock | 保留原始 HTML，渲染时解析颜色 |
| `<u>text</u>` | ParagraphBlock | 保留原始 HTML |
| `==highlight==` | ParagraphBlock | 保留原始语法，渲染时转为 `<mark>` |
| Excalidraw `.excalidraw.md` 文件 | — | 不作为普通笔记导入，仅在被嵌入时处理 |

**原则：宁可保留原始文本，不可丢失内容。无法识别的元素一律作为 ParagraphBlock 保留原文。**

#### Callout 解析细节

Obsidian Callout 语法：

```markdown
> [!info] 自定义标题
> 第一行内容
> 第二行内容
>
> > [!warning] 嵌套 callout
> > 嵌套内容

> [!tip]- 可折叠（默认折叠）
> 内容

> [!note]+ 可折叠（默认展开）
> 内容
```

解析规则：
- `[!type]` → `calloutType`，支持全部 Obsidian 内置类型（note, abstract, info, tip, success, question, warning, failure, danger, bug, example, quote）
- `[!type]-` → `foldable: true, defaultFolded: true`
- `[!type]+` → `foldable: true, defaultFolded: false`
- 无 `+/-` → `foldable: false`
- `[!type]` 后的文本 → `title`
- callout 内容递归解析为 `children: NoteBlock[]`（支持嵌套 callout）

#### 任务列表解析细节

```markdown
- [ ] 未完成任务
- [x] 已完成任务
- [>] 已推迟任务
- [-] 已取消任务
	- [ ] 嵌套子任务
	- [x] 嵌套已完成(@2024-07-22)
```

解析规则：
- `[ ]` → `status: "unchecked"`
- `[x]` → `status: "checked"`
- `[>]` → `status: "deferred"`
- `[-]` → `status: "cancelled"`
- `(@yyyy-mm-dd)` 或 `(@yyyy-mm-dd HH:mm)` → `reminderDate`
- 缩进层级通过 tab/空格计算 → `indent`（0-based）
- 连续的任务行合并为一个 TaskBlock

#### 图片路径解析

Obsidian 图片引用有多种形式，按优先级解析：

1. `![[image.png]]` → 在 Vault 全局查找文件名匹配的图片（Obsidian 的短路径机制）
2. `![[subfolder/image.png]]` → 相对于 Vault 根目录的路径
3. `![[image.png|400]]` → 同 1，`displayWidth = 400`
4. `![alt](./attachments/image.png)` → 相对于当前 .md 文件的路径
5. `![alt](/absolute/path.png)` → 相对于 Vault 根目录
6. `![alt](https://...)` → 外部 URL，不导入，`objectKey` 置空，`externalUrl` 存原始 URL

找不到本地文件时，降级为 ParagraphBlock `[图片缺失: filename]`，不中断导入。

#### Excalidraw 嵌入处理

当笔记中出现 `![[xxx.excalidraw]]` 嵌入时：
1. 找到对应的 `.excalidraw.md` 文件
2. 解析其中 `## Text Elements` 部分，提取所有文本元素拼接为 `fallbackText`
3. 如果文件中包含 `compressed-json` 数据块，尝试解压并通过 excalidraw-to-svg 导出为 SVG
4. SVG 上传至 MinIO，`svgObjectKey` 记录路径
5. 渲染时优先展示 SVG 图片，SVG 不可用时显示 fallbackText
6. 独立的 `.excalidraw.md` 文件不作为普通笔记导入（它们通过嵌入引用被消费）

### 4.7 图片上传阶段

```typescript
const IMPORT_BUCKET = "lumina-imports"

async function uploadStage(job: ImportJob, pendingData: PendingData, signal: AbortSignal): Promise<void> {
  // 收集所有 ImageBlock + ExcalidrawBlock 的 SVG（去重）
  const uniqueImages = deduplicateImages(pendingData.notes)

  for (const image of uniqueImages) {
    if (signal.aborted) throw new Error("cancelled")

    const stagingKey = `_staging/${job.id}/${image.hash}${image.ext}`
    await minioClient.putObject(IMPORT_BUCKET, stagingKey, image.buffer)
    pendingData.stagedImageKeys.push(stagingKey)

    const finalKey = `imports/${job.sourceId}/${image.hash}${image.ext}`
    backfillObjectKey(pendingData.notes, image.originalPath, finalKey)
  }
}
```

图片去重：同一张图片被多篇笔记引用时，只上传一次（按文件内容 SHA-256 去重）。

### 4.8 分析阶段（LLM 观点拆分）

见 §5 Prompt 设计。

### 4.9 关联阶段

观点匹配策略（按优先级）：

1. **精确标题匹配**：LLM 返回的观点标题与已有观点标题完全相同 → 直接关联
2. **模糊标题匹配**：标题编辑距离 / 包含关系 → 置信度 > 0.8 时自动关联
3. **向量相似度**（可选，依赖 embedding 模型配置）：余弦相似度 > 0.85 → 关联
4. **无匹配** → 新建观点节点，标记 `isCandidate: true`

对每个 `NoteViewpointLink`：
- 在目标观点的 `articleBlocks` 末尾追加一个 QuoteBlock，引用笔记中的相关段落
- QuoteBlock.sourceRef 设置为 `{ type: "import", noteId, sourcePath }`
- 不覆盖观点中已有的用户编辑内容

---

## 5. Prompt 设计

### 5.1 观点拆分 Prompt

每次处理一篇笔记，输入笔记全文，输出结构化 JSON。

```
你是一位知识管理专家。请分析以下笔记，提取其中包含的核心「观点」。

**观点的定义**：一个可独立成文的主题或论点，具有足够的深度和独立性。
例如「第一性原理思维」「长期主义投资」「系统思维」是观点；
「今天天气不错」「读了一本书」不是观点。

**规则**：
1. 一篇笔记可能包含 0~5 个观点（大多数 1~3 个）
2. 如果笔记是纯日志/流水账/无实质性观点，返回空列表
3. 观点标题应简洁、抽象、可复用（不要包含具体书名/人名）
4. 标注每个观点对应的段落范围（用块序号 blockIndex 表示）
5. 给出关联理由（一句话）和置信度（0~1）
6. 参考笔记的标签和分类信息辅助判断

**已有观点列表**（优先归属到这些观点，避免重复创建）：
{existingViewpoints}

**笔记元数据**：
- 标签：{tags}
- 来源路径：{relativePath}

**笔记内容**（每段前有 [B{index}] 标记，图片标记为 [IMG]，图表标记为 [MERMAID]，任务列表标记为 [TASKS]）：
{noteContentWithBlockIndex}

请以 JSON 格式返回：
```json
{
  "viewpoints": [
    {
      "title": "观点标题",
      "isExisting": true/false,
      "existingViewpointId": "如果匹配已有观点则填 id",
      "relatedBlockIndices": [0, 1, 3],
      "reason": "一句话说明为什么这段内容属于该观点",
      "confidence": 0.85
    }
  ]
}
```
```

### 5.2 Frontmatter 辅助信号

Frontmatter 中的以下字段传入 Prompt 辅助 LLM 判断：

| 字段 | 用途 |
|------|------|
| `tags` / `tag` | 笔记分类标签，传入 Prompt 的 `{tags}` |
| `category` | 笔记分类，合并到 tags |
| `aliases` | 笔记别名，帮助 LLM 理解笔记主题 |
| `kms` / `kms_url` | 外部知识库链接，存入 frontmatter 但不传入 Prompt |

路径本身也是信号：`Fine AI/FineInsight/开发文档/xxx.md` 暗示属于 AI 产品开发类。
路径中的目录名拆解后追加到 `{tags}` 中。

### 5.3 Prompt 调用策略

- **单文件调用**：每篇笔记独立调用一次 LLM，避免上下文过长
- **批量优化**：短笔记（< 500 字）可合并 3~5 篇一起分析，减少调用次数
- **模型绑定**：使用 `aggregation_analyze` 功能绑定的模型
- **失败重试**：JSON 解析失败时重试一次，仍失败则**整个导入任务失败**（事务回滚）

---

## 6. 增量同步

### 6.1 变更检测

通过 `contentHash`（SHA-256）判断文件是否变更：

- **新文件**：Vault 中存在但 `importedNotes` 中无对应 `relativePath` → 按新文件处理
- **已修改**：`relativePath` 匹配但 `contentHash` 不同 → 重新解析 + 重新分析
- **已删除**：`importedNotes` 中存在但 Vault 中已无文件 → 标记但不删除（保留历史）
- **无变化**：跳过

增量同步同样遵循事务语义：变更部分要么全部成功，要么全部回滚。

### 6.2 重新分析时的关联保留

笔记内容变更后重新分析观点时：
- 保留用户已 `confirmed: true` 的关联
- 未确认的关联全部重建
- 新增的关联标记 `confirmed: false`

### 6.3 图片清理

增量同步时，如果某篇笔记的图片引用发生变化：
- 新增的图片引用 → 上传新图片
- 移除的图片引用 → 检查该图片是否仍被其他笔记引用
  - 无其他引用 → 从 MinIO 中删除
  - 仍有引用 → 保留

---

## 7. 来源删除与数据清理

删除 ImportSource 时执行级联清理：

### 7.1 清理范围

| 数据 | 操作 |
|------|------|
| `importedNotes`（该 sourceId 下所有） | 删除 |
| `noteViewpointLinks`（关联到被删笔记的） | 删除 |
| MinIO `imports/{sourceId}/*` 下全部图片 | 删除 |
| `importJobs`（该 sourceId 下所有） | 删除 |
| 观点中由导入产生的 QuoteBlock（sourceRef.type = "import"） | 删除对应块 |
| 观点本身 | **保留**（即使其 QuoteBlock 被清空，观点结构不因来源删除而消失） |

### 7.2 确认流程

删除操作不可逆，前端弹出确认对话框：

```
确定要移除导入来源「MyVault」吗？

将删除 128 篇导入笔记和 46 张图片。
知识库中由这些笔记产生的引用块也将被移除。
已有的观点结构不受影响。

[取消]  [确认移除]
```

---

## 8. NoteBlock sourceRef 扩展

当前 `NoteBlockBase.sourceRef` 仅支持 `type: "scout"`。扩展为联合类型：

```typescript
interface NoteBlockBase {
  // ... 现有字段 ...
  sourceRef?:
    | { type: "scout"; patchId: string; sourceUrl: string; author?: string; fetchedAt: string }
    | { type: "import"; noteId: string; sourcePath: string }
}
```

---

## 9. API 设计

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/import/sources` | 列出用户的导入来源 |
| POST | `/api/import/sources` | 新建导入来源（选择 Vault 目录） |
| PUT | `/api/import/sources/:id` | 更新来源配置（排除规则等） |
| DELETE | `/api/import/sources/:id` | 删除导入来源（级联清理，见 §7） |
| POST | `/api/import/sources/:id/sync` | 触发同步（409 if already running） |
| GET | `/api/import/jobs` | 列出导入任务（按来源过滤） |
| GET | `/api/import/jobs/:id` | 查询导入任务状态（轮询） |
| POST | `/api/import/jobs/:id/cancel` | 取消正在进行的导入 |
| GET | `/api/import/notes` | 列出导入的笔记（支持分页、来源过滤） |
| GET | `/api/import/notes/:id` | 查看笔记详情（含块内容） |
| GET | `/api/import/notes/:id/viewpoints` | 查看笔记关联的观点列表 |
| PUT | `/api/import/links/:noteId/:viewpointId` | 确认/取消笔记-观点关联 |
| GET | `/api/import/images/:key(*)` | 代理访问 MinIO 图片（鉴权 + 缓存） |

---

## 10. UI 设计

### 10.1 入口

设置页面 → 「导入来源」分区：

```
┌─────────────────────────────────────────────────┐
│  导入来源                                        │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  ◎ Obsidian                               │    │
│  │  ~/notes/Work                             │    │
│  │  上次同步：2026-03-25 14:30               │    │
│  │  128 篇笔记 · 46 张图片 · 23 个观点       │    │
│  │                                           │    │
│  │  [同步]  [设置]  [移除]                    │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  [+ 添加来源]                                    │
└─────────────────────────────────────────────────┘
```

### 10.2 添加来源对话框

```
┌─────────────────────────────────────┐
│  添加导入来源                        │
│                                      │
│  来源类型                            │
│  ┌─────────────────────────────┐    │
│  │  Obsidian Vault             │    │
│  └─────────────────────────────┘    │
│                                      │
│  Vault 路径                          │
│  ┌─────────────────────────────┐    │
│  │  /Users/.../Work       [选择] │    │
│  └─────────────────────────────┘    │
│                                      │
│  排除目录（每行一个 glob）            │
│  ┌─────────────────────────────┐    │
│  │  .obsidian/**               │    │
│  │  .trash/**                  │    │
│  │  Templates/**               │    │
│  │  Excalidraw/**              │    │
│  └─────────────────────────────┘    │
│                                      │
│        [取消]  [添加并开始导入]       │
└─────────────────────────────────────┘
```

点击「添加并开始导入」→ 创建 ImportSource → 触发 sync → **跳转到导入进度页**。

### 10.3 导入进度页（独立页面）

路由：`/sources/import/:jobId`

独立全屏页面，用户触发同步后自动跳转至此。

```
┌─────────────────────────────────────────────────────────────┐
│  ← 返回设置                                                  │
│                                                              │
│                                                              │
│                    导入 Work                                  │
│                                                              │
│         ┌──────────────────────────────────┐                 │
│         │                                  │                 │
│         │   ○ 扫描文件        ✓ 完成        │                 │
│         │   ○ 解析笔记        ✓ 完成        │                 │
│         │   ○ 上传图片        ✓ 完成        │                 │
│         │   ● 分析观点        进行中        │                 │
│         │   ○ 建立关联        等待中        │                 │
│         │                                  │                 │
│         │   ████████████░░░░░░  62 / 128   │                 │
│         │                                  │                 │
│         │   正在分析: Fine AI/xxx.md         │                 │
│         │                                  │                 │
│         └──────────────────────────────────┘                 │
│                                                              │
│         扫描  128 篇笔记 · 46 张图片                          │
│         已识别  5 个新观点 · 关联 12 个已有观点                 │
│                                                              │
│                              [取消导入]                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 阶段展示规则

五个阶段纵向排列，每个阶段有四种状态：
- `○` 等待中（灰色空心圆）
- `●` 进行中（主题色实心圆，带呼吸动效）
- `✓` 完成（主题色对勾）
- `✗` 失败（红色叉号）

进度条仅在当前进行中的阶段下方显示，展示该阶段的 `processed / total`。
进度条下方显示当前正在处理的文件名（fade 切换，不跳动）。

底部的统计数字实时更新（fade 过渡）。

#### 完成态

```
┌─────────────────────────────────────────────────────────────┐
│  ← 返回设置                                                  │
│                                                              │
│                    导入完成                                    │
│                                                              │
│         ┌──────────────────────────────────┐                 │
│         │   ✓ 扫描文件                      │                 │
│         │   ✓ 解析笔记                      │                 │
│         │   ✓ 上传图片                      │                 │
│         │   ✓ 分析观点                      │                 │
│         │   ✓ 建立关联                      │                 │
│         └──────────────────────────────────┘                 │
│                                                              │
│         128 篇笔记 · 46 张图片                                │
│         5 个新观点 · 关联 12 个已有观点                        │
│                                                              │
│         [前往知识库查看]                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 失败态

```
┌─────────────────────────────────────────────────────────────┐
│  ← 返回设置                                                  │
│                                                              │
│                    导入失败                                    │
│                                                              │
│         ┌──────────────────────────────────┐                 │
│         │   ✓ 扫描文件                      │                 │
│         │   ✓ 解析笔记                      │                 │
│         │   ✓ 上传图片                      │                 │
│         │   ✗ 分析观点        失败           │                 │
│         │   ○ 建立关联                      │                 │
│         └──────────────────────────────────┘                 │
│                                                              │
│         LLM 返回格式错误，重试后仍无法解析                      │
│         已自动回滚，数据未变更                                  │
│                                                              │
│         [重试]   [返回设置]                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 取消态

```
┌─────────────────────────────────────────────────────────────┐
│  ← 返回设置                                                  │
│                                                              │
│                    导入已取消                                  │
│                                                              │
│         ┌──────────────────────────────────┐                 │
│         │   ✓ 扫描文件                      │                 │
│         │   ✓ 解析笔记                      │                 │
│         │   — 上传图片        已取消          │                 │
│         │   ○ 分析观点                      │                 │
│         │   ○ 建立关联                      │                 │
│         └──────────────────────────────────┘                 │
│                                                              │
│         已自动回滚，数据未变更                                  │
│                                                              │
│         [重新导入]   [返回设置]                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 前端轮询

进度页通过轮询 `GET /api/import/jobs/:id` 获取状态，间隔 1.5s。
Job 进入终态（`done` / `failed` / `cancelled`）后停止轮询。

### 10.4 笔记渲染设计

渲染品质是导入功能的核心体验。目标：**每一种块的渲染效果都必须比 Obsidian 原生更精致**。
Obsidian 的默认渲染是「够用」级别——我们要做到「让用户觉得笔记在 Lumina 里比在 Obsidian 里更好看」。

设计语言延续 Swan Song 体系：温暖极简、负空间充足、字体排印精致、色彩克制但有层次。

#### 全局排版基线

```
容器最大宽度：720px，居中显示
段落间距：20px（比 Obsidian 默认更宽松，让内容呼吸）
块间距：16px（同类块之间）、24px（不同类块之间）
行高：1.75（正文）、1.4（标题）
字体：Inter 450（正文）、Inter 600（标题）
正文字号：15px（比 Obsidian 14px 略大，阅读更舒适）
颜色：$text-primary on $bg-surface-1
```

#### HeadingBlock

```
H1：24px / Inter 600 / $text-primary / margin-top 40px
H2：20px / Inter 600 / $text-primary / margin-top 32px
H3：17px / Inter 500 / $text-secondary / margin-top 24px

H2 下方带一条极细分隔线：1px solid $border-subtle / opacity 0.4 / margin-bottom 16px
（H1、H3 无分隔线——层次通过字号和间距区分，不靠线条堆砌）
```

Obsidian 的标题只是变大变粗。我们的 H2 分隔线为长文建立视觉节奏感。

#### ParagraphBlock（行内富文本）

正文 15px / Inter 450 / $text-primary / line-height 1.75。

行内格式渲染：

| 语法 | 渲染 | 设计细节 |
|------|------|---------|
| `**bold**` | `<strong>` Inter 600 | — |
| `*italic*` | `<em>` | — |
| `==highlight==` | `<mark>` | 背景 `$accent-yellow/15%`，padding `2px 4px`，圆角 3px。比 Obsidian 的刺眼荧光黄柔和得多 |
| `<mark style="background: #BBFABBA6;">` | `<mark>` 保留原色 | 但降低饱和度 10%，避免在 Swan Song 色彩体系中过于刺眼 |
| `<u>text</u>` | 下划线 | 使用 `text-decoration: underline` + `text-underline-offset: 3px` + `text-decoration-color: $text-tertiary`，比浏览器默认下划线更雅致 |
| `~~strikethrough~~` | 删除线 | `text-decoration-color: $text-tertiary`，淡化而非抹杀 |
| `` `inline code` `` | `<code>` | 背景 `$bg-surface-2`，字体 JetBrains Mono 13px，padding `2px 6px`，圆角 4px |
| `[[target\|display]]` | 文本链接 | 正文色 + 底部虚线 `border-bottom: 1px dashed $text-tertiary`。hover 时底线变实线 + 弹出浮层预览卡片（笔记标题 + 首段摘要 + 标签，200ms 延迟） |
| `[text](url)` | `<a>` | `$accent-blue` 色，hover 底线，`target="_blank"` |
| `$latex$` | KaTeX 行内 | 与正文基线对齐 |

**Wikilink 浮层预览**是超越 Obsidian 的关键体验之一。Obsidian 需要安装 Page Preview 插件才有此功能，我们内置。

浮层规格：
```
┌─────────────────────────────┐
│  读书笔记-从0到1              │  ← 笔记标题 Inter 500 15px
│                              │
│  Peter Thiel 认为创业的核心   │  ← 首段摘要 $text-secondary 13px
│  在于从 0 到 1 的突破...      │     最多 3 行，末尾 ellipsis
│                              │
│  #读书笔记  #商业              │  ← 标签 $text-tertiary 12px
└─────────────────────────────┘
宽度 280px / 圆角 12px / shadow-md / $bg-surface-1
延迟 200ms 显示，鼠标移出 150ms 消失
```

#### QuoteBlock

```
┌─ 3px solid $accent-blue/40% ──────────────────┐
│                                                 │
│  "原文引用内容在这里，可以很长很长..."            │
│                                                 │
│  — 《从0到1》第3章                 跳转原文 ↗    │
│                                                 │
└─────────────────────────────────────────────────┘

左侧色条：3px solid $accent-blue，opacity 40%
背景：$bg-surface-2/50%（极淡，几乎透明）
内边距：16px 20px
引用文字：14px / Inter 400 / $text-secondary / italic
来源标注：12px / $text-tertiary / 右下角
圆角：0（左侧直角保持引用的严肃感，不同于 callout 的圆角）
```

比 Obsidian 默认的灰色竖线 + 灰色文字更有层次感。

#### CalloutBlock

Obsidian 的 callout 已经是它最好看的元素之一。我们要在此基础上做到更精致。

```
┌─────────────────────────────────────────────────┐
│  ┌──┐                                            │
│  │ i │  Info 标题文字                              │
│  └──┘                                            │
│                                                  │
│  Callout 内部内容，支持递归嵌套其他块类型...       │
│  包括段落、代码块、甚至子 callout。               │
│                                                  │
│                                           [▾ 折叠] │
└─────────────────────────────────────────────────┘
```

类型 → 颜色 → 图标映射（使用 Lucide 图标）：

| calloutType | 色调 | 图标 | 背景色 |
|-------------|------|------|--------|
| note | `$text-secondary` | FileText | `$bg-surface-2/60%` |
| info | `#4A90D9` 柔蓝 | Info | `#4A90D9/8%` |
| tip | `#5B9A6B` 柔绿 | Lightbulb | `#5B9A6B/8%` |
| warning | `#C4954A` 暖橙 | AlertTriangle | `#C4954A/8%` |
| danger / failure | `#C25B5B` 柔红 | AlertOctagon | `#C25B5B/8%` |
| success | `#5B9A6B` 柔绿 | CheckCircle | `#5B9A6B/8%` |
| question | `#C4954A` 暖橙 | HelpCircle | `#C4954A/8%` |
| abstract / summary | `#6B8EAE` 灰蓝 | ClipboardList | `#6B8EAE/8%` |
| example | `#8B7EC8` 柔紫 | Puzzle | `#8B7EC8/8%` |
| quote | `$text-secondary` | Quote | `$bg-surface-2/60%` |
| bug | `#C25B5B` 柔红 | Bug | `#C25B5B/8%` |
| todo | `#4A90D9` 柔蓝 | ListTodo | `#4A90D9/8%` |

设计细节：
```
圆角：12px
左侧色条：3px solid {色调}
背景：{背景色}（极淡透明，不抢正文焦点）
图标：16px，色调色，与标题同行
标题：14px / Inter 500 / {色调}
内容区：正常正文样式，padding-left 24px（图标宽度对齐）
折叠动效：Framer Motion height auto-animate，200ms ease

嵌套 callout：
  - 内层背景色叠加（不透明度递减，避免色彩浑浊）
  - 内层左侧色条缩短为 2px
  - 最大嵌套 3 层（超过后平铺显示）
```

与 Obsidian 的差异：
- Obsidian 的 callout 图标是字体图标，粗糙；我们用 Lucide SVG 图标，精致
- Obsidian 的折叠是瞬间切换；我们用高度动画过渡
- Obsidian 的背景色偏重；我们极淡透明，保持 Swan Song 的宁静感
- 颜色经过降饱和处理，不出现 Obsidian 那种刺眼的荧光色

#### TaskBlock

```
  ✓  已完成的任务                        ← checked: 勾选图标 + 文字淡化
  ○  未完成的任务                        ← unchecked: 空心圆
  →  已推迟的任务            2024-07-22   ← deferred: 右箭头 + 日期标注
  —  已取消的任务                        ← cancelled: 横线 + 删除线文字
     ○  嵌套子任务                       ← indent 1: 左缩进 24px
     ✓  嵌套已完成子任务                  ← indent 1
```

设计细节：
```
状态图标：16px Lucide 图标，替代 Obsidian 的原生 checkbox
  - unchecked: Circle (空心) / $text-tertiary
  - checked: CheckCircle (实心勾) / $accent-green / 文字加 $text-tertiary + opacity 0.6
  - deferred: ArrowRight / $accent-blue
  - cancelled: Minus / $text-tertiary / 文字加删除线 + opacity 0.5

日期标注：(@2024-07-22) → 渲染为右侧淡色标签
  背景 $bg-surface-2 / 圆角 4px / padding 2px 8px
  字号 12px / $text-tertiary / JetBrains Mono

缩进：每层 24px，缩进线为 1px dashed $border-subtle（仅 hover 时可见）
行高：36px（比正文更宽，任务条目需要点击友好）
```

超越 Obsidian 的点：
- Obsidian 用浏览器原生 checkbox，不同系统样式不一致；我们用 Lucide 图标统一
- `[>]` 在 Obsidian 中只是特殊字符显示；我们有专属图标和颜色
- 提醒日期在 Obsidian 中靠 reminder 插件渲染；我们内置渲染为精致的日期标签
- 缩进连接线让嵌套层级一目了然

#### TableBlock

```
┌──────────────────────────────────────────────┐
│  列标题 A          列标题 B          列标题 C  │ ← 表头行
├──────────────────────────────────────────────┤
│  单元格内容        单元格内容        单元格内容  │
│  单元格内容        单元格内容        单元格内容  │
│  单元格内容        单元格内容        单元格内容  │ ← hover 行高亮
└──────────────────────────────────────────────┘
```

设计细节：
```
容器：圆角 10px / 1px solid $border-default / overflow hidden
表头：背景 $bg-surface-2 / Inter 500 13px / $text-secondary / padding 10px 16px
表体：背景透明 / Inter 400 14px / $text-primary / padding 10px 16px
行分隔：1px solid $border-subtle
行 hover：背景 $bg-surface-2/40%（200ms transition）
列对齐：支持 left/center/right（从 Markdown 对齐语法解析）
宽表格：容器内横向滚动，fade 遮罩提示可滚动
```

超越 Obsidian：
- Obsidian 的表格没有圆角容器，直接暴露线条，视觉粗糙
- 我们有行 hover 高亮、fade 滚动提示、统一的容器圆角

#### CodeBlock

```
┌─────────────────────────────────────────────────┐
│  java                                    [复制]  │ ← 语言标签 + 复制按钮
│─────────────────────────────────────────────────│
│  public class HelloWorld {                       │
│      public static void main(String[] args) {    │
│          System.out.println("Hello");            │
│      }                                           │
│  }                                               │
└─────────────────────────────────────────────────┘
```

设计细节：
```
容器：圆角 10px / 背景 $bg-surface-2 / 1px solid $border-subtle
语言标签：左上角 / 12px / $text-tertiary / JetBrains Mono
复制按钮：右上角 / 仅 hover 容器时可见 / 点击后切换为 ✓ 2s
代码字体：JetBrains Mono 13px / line-height 1.6
语法高亮：使用 Shiki（比 Obsidian 的 highlight.js 更准确、主题更丰富）
  主题：自定义 Swan Song 主题（基于 vitesse-light 改色）
  关键字：$accent-blue / 字符串：$accent-green / 注释：$text-tertiary
内边距：16px（比 Obsidian 默认更宽松）
最大高度：400px，超出后展示 [展开全部] 按钮（Obsidian 无此功能）
行号：可选显示（默认隐藏，hover 左侧区域时淡入）
```

#### MermaidBlock

```
┌─────────────────────────────────────────────────┐
│                                                  │
│          ┌─────────┐     ┌─────────┐            │
│          │  Node A  │────▶│  Node B  │            │
│          └─────────┘     └─────────┘            │
│                 │                                 │
│                 ▼                                 │
│          ┌─────────┐                             │
│          │  Node C  │                             │
│          └─────────┘                             │
│                                                  │
│                                    [查看源码]     │
└─────────────────────────────────────────────────┘
```

设计细节：
```
容器：圆角 10px / 背景 $bg-surface-1 / 1px solid $border-subtle
渲染引擎：mermaid.js（客户端渲染为 SVG）
自定义主题：覆盖 mermaid 默认配色，对齐 Swan Song 色彩
  - 节点填充：$bg-surface-2
  - 节点边框：$border-default
  - 箭头/连线：$text-tertiary
  - 文字：$text-primary / Inter
  - 高亮节点：$accent-blue/10% 填充
内边距：24px
居中显示，最大宽度 100%
交互：hover 显示「查看源码」按钮 → 展开源码 CodeBlock（可复制）
渲染失败：降级为 CodeBlock 展示 mermaid 源码，附「图表渲染失败」提示
```

#### MathBlock

```
行内公式：与正文同行，KaTeX 渲染，基线对齐
块级公式：居中显示，上下各 16px 间距

E = mc²
```

设计细节：
```
渲染引擎：KaTeX（比 MathJax 快，SSR 友好）
字号：与正文一致（行内）或 110%（块级）
颜色：$text-primary
块级容器：无边框、无背景，纯公式居中
hover：块级公式 hover 时右侧淡入 [复制 LaTeX] 按钮
渲染失败：显示原始 LaTeX 文本 + `<code>` 样式 + 「公式渲染失败」淡色提示
```

#### ImageBlock

```
┌─────────────────────────────────────────────────┐
│                                                  │
│                  [图片内容]                        │
│                                                  │
│                                                  │
└─────────────────────────────────────────────────┘
        图片描述文字（如果有 alt）                    ← caption
```

设计细节：
```
容器：无边框，居中显示
最大宽度：displayWidth 存在时使用，否则 min(图片原宽, 100%)
圆角：8px（图片本身裁切圆角）
加载态：灰色占位区域（从 width/height 计算比例），shimmer 动画
失败态：$bg-surface-2 区域 + 中央 ImageOff 图标 + 文件名
Alt 文本：图片下方居中 / 12px / $text-tertiary / italic（Obsidian 不显示 alt）
点击交互：点击图片打开 lightbox 全屏查看（Obsidian 无此功能）
  - 全屏遮罩 $bg-base/80% backdrop-blur
  - 图片居中最大化显示
  - ESC 或点击遮罩关闭
  - 支持滚轮缩放
外部 URL 图片：objectKey 为空时用 externalUrl 渲染，右下角小图标标识「外部链接」
```

Lightbox 是超越 Obsidian 的杀手级体验。Obsidian 看大图需要安装 Image Toolkit 插件。

#### ExcalidrawBlock

```
┌─────────────────────────────────────────────────┐
│                                                  │
│          [Excalidraw SVG 渲染内容]                │
│                                                  │
│                                                  │
│                              Excalidraw 绘图      │ ← 来源标注
└─────────────────────────────────────────────────┘
```

设计细节：
```
优先级：svgObjectKey → SVG 图片渲染（与 ImageBlock 类似）
降级：fallbackText → 渲染为带特殊样式的文本卡片
  背景 $bg-surface-2 / 圆角 10px / padding 20px
  文字 13px / $text-secondary / 行间距宽松
  左上角 Pencil 图标 + "Excalidraw" 标签
手绘风格保留：SVG 渲染时保持 Excalidraw 原始手绘线条风格
```

#### DividerBlock

```
──────────────── · ────────────────
```

设计细节：
```
实现：居中的三点分隔符（· · ·），两侧渐隐线条
线条：$border-subtle / 高度 1px / 两端 gradient to transparent
间距：上下各 24px
（比 Obsidian 的一条直线更有呼吸感）
```

#### 全局交互增强

以下交互在所有块类型上通用，均为 Obsidian 不具备的：

**1. 块级 hover 指示器**
```
hover 任意块时，左侧出现一条极淡的 2px 竖线（$accent-blue/20%）
标识当前聚焦的块，辅助长文阅读定位
120ms fade-in / fade-out
```

**2. 块级锚点复制**
```
hover 块时，左侧竖线旁出现 # 锚点图标（12px / $text-tertiary）
点击复制该块的永久链接到剪贴板
仅 heading 和 highlight 块显示
```

**3. 平滑滚动定位**
```
从观点文章中点击引用块的「跳转原文」→ 平滑滚动到目标块
到达后目标块短暂高亮（$accent-blue/10% 背景 flash，800ms fade-out）
```

**4. 阅读进度指示器**
```
长笔记（> 20 个块）时，右侧出现极细的滚动进度条
宽度 2px / $text-tertiary/30%
当前视窗位置对应的段高亮为 $accent-blue/60%
```

### 10.5 知识库侧边栏扩展

在观点树底部增加「导入笔记」折叠区域：

```
▼ 思维框架
  ├ 第一性原理
  └ 长期主义
▶ 商业洞察
▶ 投资哲学

──────────────────
▶ 导入笔记 (128)
  ▶ Work
    ├ Fine AI/FineInsight/xxx.md    → AI 工程, 产品设计
    ├ 日记/2026-03-25.md            → (无观点)
    └ ...
```

点击笔记 → 右侧以只读模式渲染全部 NoteBlock 内容，
右上角显示「关联观点」标签，点击可跳转对应观点。

---

## 11. 安全

### 11.1 路径安全

后端直接通过 `fs` 读取用户指定的 Vault 路径，必须防止路径穿越攻击。

规则：
- `ImportSource.path` 必须是绝对路径
- 创建 ImportSource 时，后端校验路径存在且为目录
- 扫描阶段，所有解析出的文件路径（md、图片）必须经过 `realpath` 解析后确认仍在 Vault 根目录下
- 图片路径解析后同样做 `startsWith(vaultRealPath)` 校验
- 拒绝符号链接指向 Vault 外部的文件

```typescript
function validatePath(filePath: string, vaultRealPath: string): boolean {
  const realFile = fs.realpathSync(filePath)
  return realFile.startsWith(vaultRealPath + path.sep) || realFile === vaultRealPath
}
```

### 11.2 图片访问鉴权

`GET /api/import/images/:key` 代理 MinIO 图片时：
- 必须验证当前用户身份
- 校验请求的 objectKey 对应的 sourceId 属于当前用户
- 防止用户 A 通过猜测 key 访问用户 B 的图片

---

## 12. 技术约束

### 12.1 文件系统访问

Lumina 运行在本地 Next.js 进程中，可通过 Node.js `fs` 模块直接读取本地文件系统。
前端通过 `<input type="file" webkitdirectory>` 或目录选择器获取路径。

### 12.2 图片存储

- Bucket：`lumina-imports`（与 books/covers 分开）
- 路径格式：`imports/{sourceId}/{contentHash}{ext}`
- 支持格式：`.png` `.jpg` `.jpeg` `.gif` `.svg` `.webp`
- 单张图片上限 20MB，超出跳过并降级为文本占位
- 同一图片被多笔记引用时只存储一份（内容哈希去重）

### 12.3 性能考量

- 单个 Vault 上限约 5000 篇笔记（超过后建议分批同步）
- LLM 调用并发限制：同时最多 5 个并发请求
- 图片上传并发限制：同时最多 10 个
- 大笔记（> 10000 字）截断至前 8000 字发送给 LLM（原文仍无损保存）
- Mermaid / Excalidraw 渲染在客户端完成，不占用服务端资源

### 12.4 错误处理与事务保障

| 场景 | 处理 |
|------|------|
| Vault 路径不存在/无权限 | 前端即时提示，不创建 ImportJob |
| 路径穿越检测到非法路径 | 跳过该文件，记录警告，不中断 |
| 文件编码非 UTF-8 | **整个导入失败**，提示用户修复编码 |
| 图片文件损坏/无法读取 | 降级为 ParagraphBlock 文本占位，不中断 |
| 单张图片超过 20MB | 跳过该图片，降级为文本占位，不中断 |
| Excalidraw SVG 导出失败 | 降级为 fallbackText，不中断 |
| MinIO 上传失败 | 重试 2 次，仍失败则**整个导入失败并回滚** |
| LLM 返回格式错误 | 重试 1 次，仍失败则**整个导入失败并回滚** |
| LLM 服务不可用 | **整个导入失败并回滚** |
| 数据库写入失败 | **整个导入失败，已上传的 staging 图片清理** |
| 用户取消 | 走标准回滚流程，状态置为 `cancelled` |

核心原则：图片/Excalidraw 缺失可以降级，但数据一致性问题必须回滚。

---

## 13. 验收标准

### 导入流程
- [ ] 用户可在设置页添加 Obsidian Vault 来源
- [ ] 选择目录后自动跳转到独立的导入进度页
- [ ] 进度页正确展示五个阶段的状态流转（等待/进行中/完成/失败）
- [ ] 进度条、当前文件名、统计数字实时更新
- [ ] 导入成功后展示完成态，可跳转知识库
- [ ] 导入失败后展示失败态，明确提示「已回滚」
- [ ] 用户可取消正在进行的导入，取消后正确回滚
- [ ] 失败/取消后数据库无脏数据，MinIO 无残留文件
- [ ] 同一来源不可并发导入（409 提示）

### 内容无损
- [ ] 笔记内容无损存储（rawMarkdown 可还原原文）
- [ ] 全部 Obsidian 语法正确解析为对应块类型
- [ ] Callout 正确解析（type、title、foldable、嵌套）
- [ ] 任务列表正确解析（自定义状态 `[>]` `[-]`、嵌套、(@date) 提醒）
- [ ] 表格正确解析为结构化数据
- [ ] Mermaid 图表正确渲染
- [ ] 行内格式完整保留（`==高亮==`、`<mark>` 彩色高亮、`<u>` 下划线）

### 图片与附件
- [ ] 笔记中的图片正确上传至 MinIO 并可访问
- [ ] `![[img|400]]` 的尺寸约束在渲染时生效
- [ ] 同一图片被多笔记引用时只存储一份
- [ ] 外部 URL 图片正确渲染（不上传）
- [ ] Excalidraw 嵌入优先展示 SVG，降级显示文本

### 观点分析
- [ ] LLM 正确识别笔记中的观点
- [ ] Frontmatter tags 和路径信息辅助 LLM 判断
- [ ] 已有观点正确匹配，不重复创建
- [ ] 笔记-观点多对多关系正确建立

### 增量与清理
- [ ] 增量同步正确识别新增/修改的笔记
- [ ] 增量同步遵循全量成功/全量失败
- [ ] 删除来源时级联清理全部关联数据
- [ ] 删除来源时观点结构保留

### 安全
- [ ] 路径穿越攻击被正确拦截
- [ ] 图片访问接口校验用户归属

---

## 14. 后续演进

- **更多来源**：Notion（API 导出）、Logseq（本地目录）、Markdown 文件夹
- **双向同步**：Lumina 中编辑后写回 Vault
- **向量化匹配**：embedding 模型对观点标题/描述做向量化，提升匹配精度
- **Wikilink 图谱**：利用 Obsidian 双链关系增强观点关联图
- **自动定时同步**：监听文件系统变更或定时轮询
