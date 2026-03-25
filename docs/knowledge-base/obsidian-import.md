# 模块 06：知识库 — Obsidian 导入

> 阶段：002
> 依赖：001（知识库基础）、05（聚合引擎）
> 核心目标：从 Obsidian Vault 无损导入笔记，借助 LLM 自动拆分观点并归属到知识库观点树

---

## 1. 概述

用户选择一个 Obsidian Vault 目录后，系统扫描全部 `.md` 文件，将笔记内容无损转换为 NoteBlock 序列存储，
同时通过 LLM 对每篇笔记进行「观点拆分」——识别笔记中包含的核心观点，
将其匹配到已有观点或新建观点，建立笔记与观点之间的多对多关系。

一句话：**笔记是原料，观点是提炼物。一篇笔记可以喂养多个观点，一个观点可以汇聚多篇笔记的片段。**

---

## 2. 核心概念

### 2.1 ImportedNote（导入笔记）

从外部来源无损导入的原始笔记，保留完整内容，不做删减。
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
type ImportJobStatus = "scanning" | "parsing" | "analyzing" | "linking" | "done" | "failed"

interface ImportJob {
  id: string
  userId: string
  sourceId: string
  status: ImportJobStatus
  /** 当前阶段进度描述 */
  stage: string
  /** 文件总数 */
  totalFiles: number
  /** 已处理文件数 */
  processedFiles: number
  /** 新建观点数 */
  newViewpoints: number
  /** 关联到已有观点数 */
  linkedViewpoints: number
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
  /** Obsidian 标签（从 frontmatter.tags + 正文 #tag 提取） */
  tags: string[]
  /** Obsidian 双链引用（[[...]]） */
  wikilinks: string[]
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

### 3.5 Database 扩展

```typescript
// 在 Database interface 中新增：
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
用户选择 Vault 目录
       │
       ▼
  ┌─────────────┐
  │  1. 扫描     │  递归遍历 .md 文件，排除 .obsidian/ .trash/ 及用户自定义 glob
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │  2. 解析     │  逐文件：解析 frontmatter → Markdown AST → NoteBlock[]
  └──────┬──────┘  保留 rawMarkdown 原文，提取 tags / wikilinks
         ▼
  ┌─────────────┐
  │  3. 分析     │  LLM 对每篇笔记提取观点列表（批量调用，见 §5 Prompt）
  └──────┬──────┘  返回：观点标题 + 相关段落范围 + 置信度
         ▼
  ┌─────────────┐
  │  4. 匹配     │  将 LLM 提取的观点与已有观点匹配（标题相似度 + 可选向量）
  └──────┬──────┘  匹配成功 → 关联；无匹配 → 新建观点
         ▼
  ┌─────────────┐
  │  5. 关联     │  写入 NoteViewpointLink，更新观点的 articleBlocks
  └──────┬──────┘  在观点文章中插入引用块，指向导入笔记的相关段落
         ▼
       完成
```

### 4.2 扫描阶段

```typescript
async function scanVault(vaultPath: string, excludePatterns: string[]): Promise<string[]> {
  // 递归遍历 vaultPath 下所有 .md 文件
  // 排除匹配 excludePatterns 的路径
  // 默认排除：[".obsidian/**", ".trash/**", "node_modules/**"]
  // 返回相对路径列表
}
```

### 4.3 解析阶段

Markdown → NoteBlock 转换规则：

| Markdown 元素 | NoteBlock 类型 | 说明 |
|---------------|---------------|------|
| `# / ## / ###` | HeadingBlock | level 对应 1/2/3 |
| 普通段落 | ParagraphBlock | 保留行内格式（粗体/斜体/链接转为纯文本或 HTML 片段） |
| `> 引用` | QuoteBlock | text 取引用内容 |
| `` ```code``` `` | CodeBlock | language + code |
| `---` | DividerBlock | — |
| `- [ ] / - [x]` | ParagraphBlock | 任务列表转段落，保留原始格式 |
| `![[embed]]` | ParagraphBlock | 嵌入引用转为文本标注 `[嵌入: filename]` |
| `[[wikilink]]` | — | 提取到 ImportedNote.wikilinks，正文保留为文本 |
| `#tag` | — | 提取到 ImportedNote.tags |
| 图片 `![](...)` | ParagraphBlock | 保留为 `[图片: alt]` 文本标注（图片文件不导入） |
| 表格 | ParagraphBlock | 保留原始 Markdown 表格文本 |
| 数学公式 `$...$` | ParagraphBlock | 保留原始 LaTeX |

**原则：宁可保留原始文本，不可丢失内容。无法识别的元素一律作为 ParagraphBlock 保留原文。**

### 4.4 分析阶段（LLM 观点拆分）

见 §5 Prompt 设计。

### 4.5 匹配阶段

观点匹配策略（按优先级）：

1. **精确标题匹配**：LLM 返回的观点标题与已有观点标题完全相同 → 直接关联
2. **模糊标题匹配**：标题编辑距离 / 包含关系 → 置信度 > 0.8 时自动关联
3. **向量相似度**（可选，依赖 embedding 模型配置）：观点描述 embedding 与已有观点 embedding 余弦相似度 > 0.85 → 关联
4. **无匹配** → 新建观点节点，标记 `isCandidate: true`

### 4.6 关联阶段

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

**已有观点列表**（优先归属到这些观点，避免重复创建）：
{existingViewpoints}

**笔记内容**（每段前有 [B{index}] 标记）：
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

### 5.2 Prompt 调用策略

- **单文件调用**：每篇笔记独立调用一次 LLM，避免上下文过长
- **批量优化**：短笔记（< 500 字）可合并 3~5 篇一起分析，减少调用次数
- **模型绑定**：使用 `aggregation_analyze` 功能绑定的模型
- **失败重试**：JSON 解析失败时重试一次，仍失败则跳过该笔记，记录错误

---

## 6. 增量同步

### 6.1 变更检测

通过 `contentHash`（SHA-256）判断文件是否变更：

- **新文件**：Vault 中存在但 `importedNotes` 中无对应 `relativePath` → 按新文件处理
- **已修改**：`relativePath` 匹配但 `contentHash` 不同 → 重新解析 + 重新分析
- **已删除**：`importedNotes` 中存在但 Vault 中已无文件 → 标记但不删除（保留历史）
- **无变化**：跳过

### 6.2 重新分析时的关联保留

笔记内容变更后重新分析观点时：
- 保留用户已 `confirmed: true` 的关联
- 未确认的关联全部重建
- 新增的关联标记 `confirmed: false`

---

## 7. NoteBlock sourceRef 扩展

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

## 8. API 设计

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/import/sources` | 列出用户的导入来源 |
| POST | `/api/import/sources` | 新建导入来源（选择 Vault 目录） |
| PUT | `/api/import/sources/:id` | 更新来源配置（排除规则等） |
| DELETE | `/api/import/sources/:id` | 删除导入来源 |
| POST | `/api/import/sources/:id/sync` | 触发同步（全量或增量） |
| GET | `/api/import/jobs/:id` | 查询导入任务状态 |
| GET | `/api/import/notes` | 列出导入的笔记（支持分页、来源过滤） |
| GET | `/api/import/notes/:id` | 查看笔记详情（含块内容） |
| GET | `/api/import/notes/:id/viewpoints` | 查看笔记关联的观点列表 |
| PUT | `/api/import/links/:noteId/:viewpointId` | 确认/取消笔记-观点关联 |

---

## 9. UI 设计

### 9.1 入口

设置页面 → 新增「导入来源」分区（在现有设置页最下方）：

```
┌─────────────────────────────────────────────────┐
│  导入来源                                        │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  ◎ Obsidian                               │    │
│  │  ~/notes/MyVault                          │    │
│  │  上次同步：2026-03-25 14:30               │    │
│  │  已导入 128 篇笔记 · 关联 23 个观点        │    │
│  │                                           │    │
│  │  [同步]  [设置]  [移除]                    │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  [+ 添加来源]                                    │
└─────────────────────────────────────────────────┘
```

### 9.2 添加来源对话框

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
│  │  /Users/.../MyVault    [选择] │    │
│  └─────────────────────────────┘    │
│                                      │
│  排除目录（每行一个 glob）            │
│  ┌─────────────────────────────┐    │
│  │  .obsidian/**               │    │
│  │  .trash/**                  │    │
│  │  templates/**               │    │
│  └─────────────────────────────┘    │
│                                      │
│        [取消]  [添加并开始导入]       │
└─────────────────────────────────────┘
```

### 9.3 同步进度

触发同步后，来源卡片内显示进度条：

```
┌──────────────────────────────────────────┐
│  ◎ Obsidian · MyVault                     │
│                                           │
│  正在分析笔记中的观点...                   │
│  ████████████░░░░░░░░  62/128             │
│                                           │
│  新建观点 5 · 关联已有观点 12              │
└──────────────────────────────────────────┘
```

### 9.4 知识库侧边栏扩展

在观点树底部增加「导入笔记」折叠区域，展示按来源分组的笔记列表：

```
▼ 思维框架
  ├ 第一性原理
  └ 长期主义
▶ 商业洞察
▶ 投资哲学

──────────────────
▶ 导入笔记 (128)
  ▶ MyVault
    ├ 读书笔记-从0到1.md      → 第一性原理, 商业洞察
    ├ 周报-2026W12.md          → (无观点)
    └ ...
```

点击笔记 → 右侧以只读模式渲染笔记的 NoteBlock 内容，
右上角显示「关联观点」标签，点击可跳转对应观点。

---

## 10. 技术约束

### 10.1 文件系统访问

Lumina 运行在本地 Next.js 进程中，可通过 Node.js `fs` 模块直接读取本地文件系统。
前端通过 `<input type="file" webkitdirectory>` 或 Electron/Tauri 的目录选择器获取路径。

> **Web 环境限制**：纯浏览器环境无法直接读取本地目录。
> 本期假设 Lumina 以本地应用模式运行（`next dev` 或打包后运行），
> 后端可直接访问用户指定的 Vault 路径。

### 10.2 性能考量

- 单个 Vault 上限约 5000 篇笔记（超过后建议分批同步）
- LLM 调用并发限制：同时最多 5 个并发请求
- 大笔记（> 10000 字）截断至前 8000 字发送给 LLM（原文仍无损保存）
- 解析阶段纯本地计算，无性能瓶颈

### 10.3 错误处理

- 文件编码问题：默认 UTF-8，非 UTF-8 文件跳过并记录警告
- LLM 返回格式错误：重试一次，仍失败则该笔记标记为「分析失败」
- Vault 路径不存在/无权限：前端即时提示，不创建 ImportJob

---

## 11. 验收标准

- [ ] 用户可在设置页添加 Obsidian Vault 来源
- [ ] 选择目录后自动开始首次全量导入
- [ ] 导入进度实时更新，显示当前阶段和数量
- [ ] 笔记内容无损存储（rawMarkdown 可还原原文）
- [ ] NoteBlock 渲染结果与原始 Markdown 内容一致
- [ ] LLM 正确识别笔记中的观点并返回结构化结果
- [ ] 已有观点正确匹配，不重复创建
- [ ] 新建观点标记为 `isCandidate: true`
- [ ] 笔记-观点多对多关系正确建立
- [ ] 观点文章中出现导入笔记的引用块
- [ ] 增量同步正确识别新增/修改/删除的笔记
- [ ] 用户可手动确认/取消笔记-观点关联
- [ ] 导入笔记在知识库侧边栏可见可浏览

---

## 12. 后续演进

- **更多来源**：Notion（API 导出）、Logseq（本地目录）、Markdown 文件夹
- **双向同步**：Lumina 中编辑后写回 Vault
- **向量化匹配**：embedding 模型对观点标题/描述做向量化，提升匹配精度
- **Wikilink 图谱**：利用 Obsidian 双链关系增强观点关联图
- **自动定时同步**：监听文件系统变更或定时轮询
