# Lumina PRD

---

## 一、产品定位

**一句话**：AI 时代个人阅读的基础设施层——统一管理你读的一切，通过 MCP 将阅读上下文开放给任何 AI 工具。

**核心理念**：

Lumina 是**读取层**，不是知识组织层。

阅读行为本身生成结构化、可查询的数据。MCP 让你的阅读记忆成为所有 AI 工具的上下文来源。你用什么工具组织知识是你的自由——Lumina 只确保阅读数据永远准备好被调用。

```
阅读 → 高亮 + 批注（Lumina 捕获）
              ↓ MCP
       Obsidian / Claude / Cursor（用户自己组织和使用）
```

**目标用户**：有系统阅读习惯、使用 AI 工具做知识工作的深度读者。

**核心原则**：

- **阅读体验第一**：PDF/EPUB/文章阅读体验做到极致，不因 AI 功能牺牲流畅性
- **AI 嵌入全程**：读前、读中、读后三个时机，而非事后批量处理
- **MCP 原生**：数据开放是设计核心，不是事后集成
- **自动化采集**：Scout 自动抓取，无审批环节
- **BYOK + 自部署**：数据和成本都在用户手里

---

## 二、整体页面结构

Web 端，左侧固定 Sidebar + 右侧主内容区，五个一级入口：

```
┌─────────┬──────────────────────────────────────────┐
│  Logo   │                                          │
├─────────┤                                          │
│  书库   │            主内容区                       │
│  文章   │                                          │
│  笔记   │                                          │
│  发布   │                                          │
├─────────┤                                          │
│  设置   │                                          │
└─────────┴──────────────────────────────────────────┘
```

阅读器从书库或文章点击进入，不作为独立导航入口。

---

## 三、功能模块详细设计

### 3.1 书库（Library）

管理用户上传的 PDF/EPUB 书籍。

- 封面网格视图，支持搜索、按分类/标签筛选
- 上传 PDF/EPUB，文件存入 MinIO，按用户隔离
- 书籍卡片：封面、书名、作者、阅读进度、最近阅读时间
- 新建分类/标签

---

### 3.2 阅读器（Reader）

PDF/EPUB/文章的统一沉浸式阅读体验，是 Lumina 的核心差异化。

| 功能 | 说明 |
|------|------|
| PDF | PDF.js，Canvas + TextLayer + HighlightLayer，虚拟列表渲染 |
| EPUB | epub.js，CFI 定位，章节 iframe 隔离 |
| Web 文章 | Mozilla Readability 提取正文，支持双语翻译对照 |
| 排版 | 字体大小、行距、日/夜/护眼背景 |
| 进度 | 自动保存，精确到页/CFI，多设备同步 |
| 键盘 | 翻页、高亮、全屏快捷键 |

#### 读前 AI

进入阅读前，针对当前章节或全文：

- 生成章节结构概览（可折叠的大纲视图）
- 提炼核心论点，帮助决策「从哪里开始读」
- 估算阅读时长

#### 读中 AI

不打断阅读流，按需触发：

- **即时解释**：选中文字 → 弹出解释/扩展，SSE 流式输出
- **跨笔记关联**：「这段话和我以前的笔记有什么关联？」语义检索历史高亮
- **智能标注建议**：AI 标注本页值得记录的段落（可选开启，不强制）

#### 读后 AI

完成一篇/一章后：

- 自动生成本次阅读的核心论点卡片（NoteCard）
- 卡片包含：核心主张 + 关键引用 + 来源信息
- 卡片进入笔记库，MCP 可查询

---

### 3.3 笔记捕获（Capture）

核心原则：**不打断阅读流**。

#### 高亮

- 4 色高亮（黄/绿/蓝/粉），不同颜色表达不同关注类型（用户自定义语义）
- 选中文字即触发，轻量操作栏浮现
- 精确位置记录（页码 + 段落偏移 + 字符位置 / EPUB CFI），支持一键跳回原文

#### 批注（侧边批注模式）

- 浮动侧边空白区，如同纸书页边的手写空间
- 批注文字直接内联可编辑，不弹 Modal，不跳出阅读视图
- 一个高亮对应一条批注，同一页面的批注形成连续的思考流

#### 笔记聚合视图

笔记页：跨全部来源（书籍 + 文章）的统一视图。

- 高亮 + 批注列表，按时间倒序
- 过滤：来源（书名/文章）、颜色、标签、时间范围
- 全文语义搜索（基于 pgvector 向量检索）
- 点击任意条目 → 跳回原文精确位置

---

### 3.4 文章（Articles）

统一管理网络文章：Scout 自动抓取 + 手动导入。

#### Scout 自动抓取

- 支持 RSS 订阅、网页监控、Newsletter 接入
- 定时抓取（用户配置频率），文章**直接进入阅读队列**，无需人工审批
- AI 自动提取摘要和关键标签，作为阅读前参考
- 支持内容去重

#### 手动导入

- URL 导入，Readability 提取正文，图片资源本地化存储（MinIO）
- 支持双语翻译视图

#### 文章管理

- 按信源/标签/时间筛选，搜索
- 未读 / 已读 / 收藏状态
- 文章内的阅读行为（高亮/批注）与书籍完全一致

---

### 3.5 MCP Server（核心出口）

这是 Lumina 最重要的对外接口，也是与所有竞品最本质的差异点。

配置完成后，任何支持 MCP 的 AI 工具（Claude Code、Cursor、本地 LLM 客户端等）都能访问用户的阅读上下文——Lumina 成为 AI 工具的「阅读记忆」。

#### 接口设计

**查询接口**

```
search_highlights(query, filters?)
  — 语义搜索全部高亮（跨书籍和文章）

get_book_highlights(book_id, chapter?)
  — 指定书籍/章节的所有高亮和批注

get_article_highlights(article_id)
  — 指定文章的所有高亮和批注

query_by_topic(topic, limit?)
  — 按主题跨来源语义查询，返回相关笔记

get_recent_captures(days?)
  — 最近 N 天的高亮和批注

get_reading_history(limit?)
  — 最近阅读记录（书名、文章标题、时间）
```

**内容摘要接口**

```
get_book_summary(book_id)
  — 基于该书所有高亮的 AI 综合摘要

get_article_summary(article_id)
  — 文章摘要（优先使用 Scout 预生成的）

get_note_cards(filters?)
  — 返回读后 AI 生成的论点卡片列表
```

**写入接口**

```
add_note(content, source_url?, tags?)
  — 向 Lumina 写入一条笔记（支持外部 AI 工具反向写入）

add_highlight(source_id, source_type, text, note?)
  — 添加高亮（用于外部工具标注后同步进来）
```

**元数据接口**

```
list_books(filters?)
list_articles(filters?)
list_sources()              — Scout 信源列表
get_stats()                 — 高亮总数、阅读量、最近活跃等
```

#### 认证

- API Key 认证（用户在设置中生成，支持多 Key）
- 每个 Key 可配置只读/读写权限
- MCP Server 与 Lumina 服务同进程，自部署时自动启用

---

### 3.6 发布（Publish）

将 Lumina 的阅读数据推送到外部系统。

| 配置项 | 说明 |
|--------|------|
| 目标 | Webhook / KMS / Obsidian Vault 目录同步 |
| 内容选择 | 按书籍、按文章、按标签批量导出 |
| 格式 | Markdown / HTML / JSON |
| 触发 | 手动 / 定时（cron） / 内容变更后延迟 N 分钟 |

**Obsidian 双向同步**：

- 指定本地 Obsidian Vault 目录路径
- 高亮和批注自动同步为 Markdown 文件（Callout/Quote 格式），保持来源信息
- 文件变更可回写更新 Lumina 中对应批注

---

### 3.7 设置（Settings）

| 模块 | 配置项 |
|------|--------|
| 模型配置 | Base URL、API Key、Model Name；分别配置即时解释 / 读前摘要 / 读后卡片 / 语义搜索；支持连通性测试 |
| Embedding | 向量化模型配置（语义搜索 + 跨笔记关联） |
| Scout | 信源管理（RSS/网页/Newsletter），抓取频率，协议和认证信息 |
| MCP | API Key 生成与管理，读/写权限配置 |
| 存储 | MinIO 连接配置 |
| 账户 | 基本信息、密码修改、数据导出/删除 |

---

## 四、数据模型

```
Book
  - id, user_id
  - title, author, format (PDF/EPUB)
  - minio_path, cover_image
  - categories, tags
  - reading_progress, last_read_at

Article
  - id, user_id
  - url, title, author
  - content_blocks (Readability 提取的结构化内容)
  - source_id (Scout 信源 ID，手动导入为 null)
  - published_at, fetched_at
  - is_read, is_favorite, tags

Highlight
  - id, source_type (book / article), source_id
  - content (高亮原文)
  - note (用户批注)
  - color (yellow / green / blue / pink)
  - position (精确位置，PDF: {page, rects} / EPUB: {cfi} / Article: {offset})
  - embedding_vector (pgvector，用于语义搜索)
  - tags, created_at

NoteCard
  - id, user_id
  - title, content (富文本)
  - source_highlight_ids (关联的高亮 ID 列表)
  - generated_by (ai / user)
  - tags, created_at

ScoutChannel
  - id, user_id
  - name, protocol (rss / webpage / newsletter)
  - endpoint, credentials
  - fetch_interval, last_fetched_at, is_active

McpApiKey
  - id, user_id
  - key_hash, label
  - permission (read / read_write)
  - last_used_at, created_at
```

---

## 五、技术栈

| 层级 | 方案 |
|------|------|
| 前端 | Next.js 14（App Router）+ shadcn/ui + Tailwind CSS |
| PDF 渲染 | PDF.js，Canvas + TextLayer + HighlightLayer，虚拟列表 |
| EPUB 渲染 | epub.js，CFI 定位，iframe 章节隔离 |
| 富文本 | TipTap 2.x |
| 后端 | Node.js + Hono，Hono RPC 类型安全接口 |
| 数据库 | PostgreSQL 16 + pgvector（HNSW 索引） |
| 缓存 | Redis + ioredis |
| 队列 | BullMQ（Scout 抓取任务，AI 异步任务） |
| 存储 | MinIO（书籍文件、文章图片） |
| AI 接入 | Vercel AI SDK，用户 BYOK，OpenAI 兼容接口 |
| MCP | @modelcontextprotocol/sdk |
| 认证 | JWT（RS256） |
| 部署 | Docker Compose（PostgreSQL + Redis + MinIO + App） |

---

## 六、MVP 范围

### MVP（核心链路）

| 模块 | 功能 |
|------|------|
| 书库 | 上传 PDF/EPUB、书架管理、分类 |
| 阅读器 | PDF/EPUB 渲染、高亮、侧边批注、进度保存 |
| 即时 AI | 选中文字即时解释（SSE 流式） |
| 笔记页 | 跨来源高亮聚合列表、跳回原文 |
| 设置 | 模型配置、MinIO 配置 |

### 二期

| 模块 | 功能 |
|------|------|
| Scout | RSS/网页自动抓取，无审批直入阅读队列 |
| 文章阅读 | 文章阅读器、双语翻译视图 |
| 笔记语义搜索 | pgvector 全库语义搜索 |
| 读前/读后 AI | 章节摘要、论点卡片生成 |
| MCP Server 基础版 | 只读查询接口（search / get / list） |

### 三期

| 模块 | 功能 |
|------|------|
| MCP 完整版 | 写入接口、多 Key 管理、权限配置 |
| Obsidian 双向同步 | 发布到 Vault，变更回写 |
| 读中关联 | 「这和我以前的笔记有什么关联」实时检索 |
| 读后卡片 | AI 生成论点卡片，进入笔记库 |
| 发布中心 | Webhook/KMS/定时推送 |
