# Lumina 技术架构

---

## 零、技术栈

Lumina 是一个 **Tauri 桌面应用**：前端是现有的 React WebView，后端是 Rust。没有服务器，没有 Docker，单一可执行文件分发。

| 层级 | 选型 | 说明 |
|------|------|------|
| **桌面框架** | Tauri 2.x | WebView + Rust 后端，IPC 通信 |
| **前端** | React + shadcn/ui + Tailwind CSS | 现有代码，运行在 Tauri WebView 中 |
| **PDF 渲染** | PDF.js（Web Worker） | 现有实现，不动 |
| **EPUB 渲染** | epub.js | 现有实现，不动 |
| **富文本** | TipTap 2.x | 批注编辑器，现有实现 |
| **后端语言** | Rust（stable） | Tauri 命令层、所有业务逻辑 |
| **数据库** | SQLite（via sqlx） | 本地嵌入，compile-time 查询验证 |
| **向量检索** | sqlite-vec | SQLite 扩展，无额外进程 |
| **HTTP 客户端** | reqwest（async） | Scout 抓取、AI API 调用 |
| **MCP 服务** | axum | 内嵌 HTTP server，本地监听 |
| **任务调度** | tokio-cron-scheduler | Scout 定时抓取 |
| **异步运行时** | tokio | 全局 async runtime |
| **序列化** | serde + serde_json | 数据结构序列化 |
| **RSS 解析** | feed-rs | RSS/Atom 解析 |
| **构建工具** | Vite + tauri-cli | 前端构建 + 桌面打包 |

---

## 一、整体架构

```
┌───────────────────────────────────────────────────────────────┐
│                      Tauri 应用进程                            │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    WebView（前端）                        │  │
│  │  React + PDF.js + epub.js + TipTap                      │  │
│  │                                                          │  │
│  │  tauri::invoke("cmd", args)  ←→  #[tauri::command]      │  │
│  │  tauri::listen("event")      ←→  app.emit("event")      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                           ↕ IPC                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Rust 后端                              │  │
│  │                                                          │  │
│  │  commands/    db/    ai/    scout/    mcp/    storage/   │  │
│  │                                                          │  │
│  │  SQLite ──── sqlite-vec                                  │  │
│  │  LocalFS（书籍 / 图片文件）                               │  │
│  │  axum MCP Server（localhost:3721）                       │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘

外部：
  用户配置的 AI API（OpenAI 兼容）← reqwest ─ ai/client.rs
  RSS 源 / 网页               ← reqwest ─ scout/fetcher.rs
  其他 MCP 客户端（Claude 等） → axum   ─ mcp/server.rs
```

### IPC 通信模型

- **invoke（同步请求/响应）**：前端调用 Tauri 命令，等待 Rust 返回结果。用于 CRUD、查询。
- **emit/listen（事件流）**：Rust 向前端推送事件。用于 AI 流式输出、Scout 进度、后台任务状态。

```typescript
// 前端调用示例
const highlights = await invoke<Highlight[]>("get_book_highlights", { bookId })

// AI 流式输出
await invoke("stream_ai_explain", { text, context })
const unlisten = await listen<string>("ai_chunk", (e) => {
  setOutput(prev => prev + e.payload)
})
```

```rust
// Rust 命令示例
#[tauri::command]
async fn get_book_highlights(
    book_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Highlight>, AppError> {
    db::highlights::get_by_book(&state.db, &book_id).await
}
```

---

## 二、Rust 项目结构

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── capabilities/           # Tauri 权限声明
└── src/
    ├── main.rs             # 启动入口，初始化 AppState
    ├── lib.rs              # 注册所有 commands，启动 MCP server
    ├── error.rs            # 统一错误类型（thiserror）
    ├── state.rs            # AppState（db pool、settings、mcp handle）
    │
    ├── commands/           # Tauri IPC 命令（对应前端 invoke）
    │   ├── books.rs        # 书库 CRUD，文件导入
    │   ├── highlights.rs   # 高亮/批注 CRUD
    │   ├── reader.rs       # 阅读进度，排版设置
    │   ├── articles.rs     # 文章管理
    │   ├── scout.rs        # Scout 信源管理，手动触发
    │   ├── ai.rs           # AI 调用（explain / summary / embed）
    │   ├── notes.rs        # NoteCard CRUD，语义搜索
    │   ├── mcp.rs          # MCP API key 管理
    │   ├── publish.rs      # 发布/同步任务
    │   └── settings.rs     # 设置读写
    │
    ├── db/                 # 数据库层（sqlx + SQLite）
    │   ├── mod.rs          # 连接池初始化，migrations
    │   ├── schema.sql      # 完整 schema（单一来源）
    │   ├── books.rs
    │   ├── highlights.rs
    │   ├── articles.rs
    │   ├── notes.rs
    │   └── settings.rs
    │
    ├── ai/                 # AI 集成
    │   ├── mod.rs
    │   ├── client.rs       # reqwest HTTP client，OpenAI 兼容
    │   ├── streaming.rs    # SSE 解析，emit 到前端
    │   └── embed.rs        # 文本向量化，写入 sqlite-vec
    │
    ├── scout/              # 信息采集引擎
    │   ├── mod.rs
    │   ├── fetcher.rs      # HTTP 抓取，RSS/网页/Newsletter
    │   ├── extractor.rs    # 正文提取（Readability 算法移植）
    │   ├── scheduler.rs    # tokio-cron-scheduler
    │   └── pipeline.rs     # 抓取 → 提取 → 存储管道
    │
    ├── mcp/                # MCP Server（axum）
    │   ├── mod.rs
    │   ├── server.rs       # axum 路由，生命周期管理
    │   ├── tools.rs        # MCP tool 实现（查询/写入）
    │   └── auth.rs         # API key 验证中间件
    │
    └── storage/            # 文件管理
        ├── mod.rs
        └── books.rs        # 书籍文件读写（本地目录）
```

---

## 三、数据库

### 3.1 引擎选择

SQLite（sqlx，WAL 模式），理由：
- 无守护进程，嵌入应用
- WAL 支持并发读写
- sqlite-vec 扩展提供向量检索，无需 pgvector / 独立向量库
- 数据文件在用户 App Data 目录，备份和迁移直接拷贝文件

### 3.2 Schema

```sql
-- 书籍
CREATE TABLE books (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  author          TEXT,
  format          TEXT NOT NULL CHECK (format IN ('pdf', 'epub')),
  file_path       TEXT NOT NULL,   -- 本地绝对路径
  cover_path      TEXT,
  categories      TEXT,            -- JSON array
  tags            TEXT,            -- JSON array
  read_progress   REAL DEFAULT 0,
  last_read_at    INTEGER,         -- unix timestamp
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 文章（Scout 抓取 + 手动导入）
CREATE TABLE articles (
  id              TEXT PRIMARY KEY,
  url             TEXT NOT NULL UNIQUE,
  title           TEXT,
  author          TEXT,
  content         TEXT,            -- Readability 提取的 HTML/Markdown
  source_id       TEXT,            -- Scout channel id，NULL = 手动导入
  published_at    INTEGER,
  fetched_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  is_read         INTEGER DEFAULT 0,
  is_favorite     INTEGER DEFAULT 0,
  tags            TEXT,            -- JSON array
  summary         TEXT             -- AI 生成摘要
);

-- 高亮（书籍 + 文章统一表）
CREATE TABLE highlights (
  id              TEXT PRIMARY KEY,
  source_type     TEXT NOT NULL CHECK (source_type IN ('book', 'article')),
  source_id       TEXT NOT NULL,
  content         TEXT NOT NULL,
  note            TEXT,
  color           TEXT NOT NULL DEFAULT 'yellow'
                  CHECK (color IN ('yellow', 'green', 'blue', 'pink')),
  position        TEXT NOT NULL,   -- JSON: {pdf: {page, rects}} | {epub: {cfi}} | {article: {offset}}
  tags            TEXT,            -- JSON array
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 向量索引（sqlite-vec）
CREATE VIRTUAL TABLE highlight_embeddings USING vec0(
  highlight_id TEXT PRIMARY KEY,
  embedding FLOAT[1536]            -- 维度由 embedding 模型决定
);

-- 笔记卡片（AI 生成 + 用户手动）
CREATE TABLE note_cards (
  id              TEXT PRIMARY KEY,
  title           TEXT,
  content         TEXT NOT NULL,   -- Markdown
  source_ids      TEXT,            -- JSON array of highlight ids
  generated_by    TEXT DEFAULT 'user' CHECK (generated_by IN ('ai', 'user')),
  tags            TEXT,            -- JSON array
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Scout 信源
CREATE TABLE scout_channels (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  protocol        TEXT NOT NULL CHECK (protocol IN ('rss', 'webpage', 'newsletter')),
  endpoint        TEXT NOT NULL,
  fetch_interval  INTEGER DEFAULT 3600,  -- 秒
  last_fetched_at INTEGER,
  is_active       INTEGER DEFAULT 1,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- MCP API Keys
CREATE TABLE mcp_api_keys (
  id              TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  key_hash        TEXT NOT NULL UNIQUE,  -- SHA-256
  permission      TEXT DEFAULT 'read' CHECK (permission IN ('read', 'read_write')),
  last_used_at    INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 设置
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- 存储结构化 JSON：
-- key='ai_config'   → {"explain": {...}, "summary": {...}, "embed": {...}}
-- key='scout'       → {"auto_fetch": true, "default_interval": 3600}
-- key='reader'      → {"font_size": 16, "line_height": 1.65, "theme": "day"}
```

### 3.3 Migrations

使用 sqlx migrate，迁移文件存放在 `src-tauri/migrations/`，应用启动时自动执行。

---

## 四、AI 集成

### 4.1 架构

所有 AI 调用统一走 `ai/client.rs`，对 OpenAI-compatible API 做直接 HTTP 调用（reqwest）。不引入 AI SDK 依赖——Rust 生态下 reqwest 直接调用更轻量且可控。

用户的 API Key 加密存储在 SQLite settings 表中（AES-256-GCM，密钥派生自设备唯一标识）。

### 4.2 三个使用场景

**即时解释（读中，流式）**

```
前端 invoke("stream_ai_explain", {text, context})
  → Rust: reqwest POST /chat/completions (stream=true)
  → 逐 chunk 解析 SSE
  → app.emit("ai_chunk", chunk)
  → 前端 listen("ai_chunk") 追加渲染
  → Rust: app.emit("ai_done")
  → 前端 unlisten
```

**读前摘要 / 读后卡片（异步，非流式）**

```
前端 invoke("generate_chapter_summary", {bookId, chapter})
  → Rust: reqwest POST /chat/completions
  → 等待完整响应
  → 解析 → 存入 note_cards 表
  → 返回 NoteCard 给前端
```

**向量化（后台，批量）**

```
新 highlight 写入后：
  → tokio::spawn 异步任务
  → ai/embed.rs: POST /embeddings
  → 写入 highlight_embeddings 虚拟表
  → 语义搜索即可用
```

### 4.3 模型配置

每个场景独立配置 base_url / api_key / model，存在 settings 的 `ai_config` 键中：

```json
{
  "explain":  {"base_url": "...", "api_key": "...", "model": "gpt-4o-mini"},
  "summary":  {"base_url": "...", "api_key": "...", "model": "claude-sonnet-4-6"},
  "embed":    {"base_url": "...", "api_key": "...", "model": "text-embedding-3-small"}
}
```

---

## 五、MCP Server

### 5.1 架构

axum HTTP server 在 Tauri 启动时以 `tokio::spawn` 方式启动，监听 `127.0.0.1:3721`（端口可在设置中修改）。共享 AppState（db pool），可直接查询数据库。

```rust
// lib.rs 启动逻辑
tauri::Builder::default()
    .setup(|app| {
        let state = AppState::init(app).await?;
        let mcp_state = state.clone();
        tokio::spawn(async move {
            mcp::server::start(mcp_state, 3721).await;
        });
        app.manage(state);
        Ok(())
    })
```

### 5.2 接口

所有接口遵循 MCP 协议格式，API Key 通过 `Authorization: Bearer <key>` 认证。

**查询类**

| Method | Path | 说明 |
|--------|------|------|
| GET | `/mcp/highlights/search?q=&limit=` | 语义搜索高亮（sqlite-vec） |
| GET | `/mcp/highlights?source_type=&source_id=` | 按来源获取高亮 |
| GET | `/mcp/highlights/recent?days=` | 最近 N 天的高亮 |
| GET | `/mcp/highlights/topic?q=&limit=` | 按主题跨来源查询 |
| GET | `/mcp/books` | 书籍列表 |
| GET | `/mcp/books/:id/summary` | 书籍 AI 摘要（基于高亮） |
| GET | `/mcp/articles?source_id=&tag=` | 文章列表 |
| GET | `/mcp/articles/:id/summary` | 文章摘要 |
| GET | `/mcp/notes` | NoteCard 列表 |
| GET | `/mcp/reading/history?limit=` | 最近阅读记录 |
| GET | `/mcp/stats` | 总体统计（高亮数、书籍数等） |

**写入类**（需 read_write 权限）

| Method | Path | Body |
|--------|------|------|
| POST | `/mcp/notes` | `{title?, content, tags?}` |
| POST | `/mcp/highlights` | `{source_type, source_id, text, note?}` |

### 5.3 认证

```rust
// auth.rs
async fn auth_middleware(
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let key = extract_bearer(&req)?;
    let key_hash = sha256(key);
    if !db::mcp_keys::verify(&pool, &key_hash).await? {
        return Err(StatusCode::UNAUTHORIZED);
    }
    db::mcp_keys::update_last_used(&pool, &key_hash).await?;
    Ok(next.run(req).await)
}
```

---

## 六、Scout 引擎

### 6.1 管道

```
[scheduler] tokio-cron-scheduler 触发
     ↓
[fetcher]   reqwest 拉取 RSS/网页内容
     ↓
[extractor] 正文提取（Readability 逻辑移植到 Rust）
     ↓
[dedup]     URL 去重（articles 表 UNIQUE url）
     ↓
[storage]   写入 articles 表
     ↓
[ai]        异步生成摘要 + 标签（tokio::spawn，不阻塞管道）
     ↓
[emit]      app.emit("scout_new_article", article_id) → 前端更新列表
```

无审批环节。文章直接进入阅读队列。

### 6.2 协议支持

| 协议 | 实现 |
|------|------|
| RSS / Atom | feed-rs crate 解析 |
| 网页 | reqwest 抓取 HTML，scraper crate 提取正文 |
| Newsletter | webhook 端点接收 POST，解析 email body |

### 6.3 调度

每个 channel 有独立的 `fetch_interval`（秒）。scheduler 按各 channel 的间隔独立调度，互不影响。

---

## 七、存储

### 7.1 书籍文件

书籍不再上传到对象存储，用户通过系统文件选择器选择本地文件。有两种模式（设置中可选）：

- **引用模式（默认）**：记录文件原始路径，Tauri 通过 `tauri-plugin-fs` 读取
- **拷贝模式**：首次打开时拷贝到 App Data 目录（`{data_dir}/lumina/books/`），确保文件不会因原始路径变化而丢失

封面图片提取后存储在 `{data_dir}/lumina/covers/`。

### 7.2 App Data 目录

| 系统 | 路径 |
|------|------|
| macOS | `~/Library/Application Support/Lumina/` |
| Windows | `%APPDATA%\Lumina\` |
| Linux | `~/.local/share/lumina/` |

目录结构：
```
Lumina/
├── lumina.db           # SQLite 主数据库
├── books/              # 拷贝模式下的书籍文件
├── covers/             # 封面缩略图
└── articles/           # 文章附件（图片等）
```

---

## 八、前端与 Rust 的接口约定

前端通过 `@tauri-apps/api` 调用 Rust 命令，类型定义放在 `src/types/commands.ts`。

### 命令命名规范

- `get_*` — 查询
- `create_*` — 新建
- `update_*` — 更新
- `delete_*` — 删除
- `stream_*` — 流式 AI（配合 `listen("ai_chunk")`）
- `trigger_*` — 触发异步任务（Scout 抓取、AI 批量任务）

### 事件命名规范

- `ai_chunk` / `ai_done` / `ai_error` — AI 流式
- `scout_progress` / `scout_new_article` — Scout 状态
- `task_progress` / `task_done` — 通用后台任务

---

## 九、打包与分发

| 目标平台 | 产物 |
|----------|------|
| macOS | `.dmg`（含代码签名） |
| Windows | `.msi` / `.exe`（NSIS installer） |
| Linux | `.AppImage` / `.deb` |

```bash
# 开发模式
pnpm tauri dev

# 生产构建
pnpm tauri build
```

自动更新通过 `tauri-plugin-updater` 实现，更新包托管在 GitHub Releases。
