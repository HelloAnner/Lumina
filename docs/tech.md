# Lumina 技术架构详细设计

> 版本：v1.1
> 日期：2026-03-22
> 技术栈：前后端全栈 TypeScript（Next.js 14 + Hono）
> 目标：100% 覆盖 PRD 所有功能点，确保每条需求都有可落地的技术实现路径。

---

## 零、技术栈选定

### 全栈 TypeScript

| 层级           | 选型                                                    | 理由                                                         |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| 前端框架       | **Next.js 14**（App Router） + shadcn/ui + Tailwind CSS | SSR/CSR 混合，与后端同语言，无上下文切换                     |
| 后端框架       | **Node.js + Hono**                                      | 见下方框架选型说明                                           |
| PDF 渲染       | PDF.js（Web Worker 模式）                               | 官方标准方案，文本层提取精确，支持 Canvas+SVG 分层           |
| EPUB 渲染      | epub.js                                                 | CFI 精确定位，章节 iframe 隔离，生态成熟                     |
| 富文本编辑器   | TipTap 2.x                                              | 基于 ProseMirror，支持自定义节点扩展（QuoteBlock、段落标记） |
| 知识图谱可视化 | D3.js force-simulation                                  | 力导向图，节点/边完全自定义，细粒度控制                      |
| 数据库         | PostgreSQL 16 + pgvector                                | 一库搞定关系型数据 + HNSW 向量检索，无额外依赖               |
| 缓存           | Redis                                                   | 会话、阅读进度、聚合任务分布式锁                             |
| 对象存储       | MinIO                                                   | 书籍文件存储，用户隔离 Bucket，支持私有化部署                |
| 任务队列       | BullMQ（基于 Redis）                                    | 聚合 Job、发布 Job，支持延迟队列、重试、优先级               |
| 定时调度       | node-cron                                               | 用户自配定时聚合（daily/weekly），与 BullMQ 搭配             |
| LLM 接入       | **Vercel AI SDK**（`ai` 包，openai-compatible）         | 开箱即用流式输出，统一接口对接任意 OpenAI 兼容端点（BYOK）   |
| 邮件发送       | Nodemailer                                              | 文章邮件发送                                                 |
| 加密           | Node.js `crypto`（AES-256-GCM）                         | API Key 加密存储，无需额外依赖                               |

---

先帮我把文档写好。

### 框架选型：Hono vs NestJS

**选择：Hono**

| 维度               | Hono                                         | NestJS                                     |
| ------------------ | -------------------------------------------- | ------------------------------------------ |
| 启动性能           | 极快（< 10ms 启动，Cloudflare Workers 兼容） | 较慢（DI 容器初始化，100ms+）              |
| Bundle 体积        | < 20KB（zero-dependency）                    | 数十 MB（含 Reflect-metadata 等）          |
| 学习曲线           | 接近 Express，几乎无学习成本                 | 需理解 Module/Controller/Injectable 等概念 |
| TypeScript 体验    | 原生 TS，路由类型推导完整（Hono RPC）        | 装饰器依赖 `emitDecoratorMetadata`，略繁琐 |
| Vercel AI SDK 集成 | 直接返回 `Response` 对象，SSE 无需额外适配   | 需包装 StreamableResponse，稍繁琐          |
| 适合场景           | MVP 快速迭代、AI 流式密集型应用              | 大型企业项目、强分层规范要求               |

**Lumina 的选择理由：**

1. 核心 API 多为轻量 CRUD + AI 流式代理，不需要 NestJS 的重型 DI 体系
2. Hono RPC 模式可与 Next.js 前端共享类型，达到全栈端到端类型安全
3. Vercel AI SDK 的 `toTextStreamResponse()` 直接返回标准 `Response`，与 Hono 天然兼容
4. MVP 阶段优先速度，Hono 路由直白，团队上手无障碍

---

## 一、系统整体架构

### 1.1 部署架构

```
┌────────────────────────────────────────────────────────────────────┐
│                          用户浏览器                                  │
│                    Next.js（SSR + CSR）                              │
└───────────────────────────┬────────────────────────────────────────┘
                            │ HTTPS
                            ▼
                    ┌───────────────┐
                    │     Nginx     │  静态资源 CDN 加速
                    │  反向代理/SSL  │  Let's Encrypt
                    └───────┬───────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
        ┌──────────┐ ┌──────────┐  ┌────────────┐
        │ Next.js  │ │  API     │  │   MinIO    │
        │  Server  │ │  Server  │  │ 对象存储   │
        │ (SSR渲染) │ │ (Hono)  │  │            │
        └──────────┘ └────┬─────┘  └────────────┘
                          │
              ┌───────────┼────────────┐
              ▼           ▼            ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐
        │PostgreSQL│ │ Redis  │ │Bull Queue│
        │+pgvector │ │ 缓存   │ │ 任务队列 │
        └──────────┘ └────────┘ └──────────┘
```

### 1.2 后端模块划分（Hono 项目结构）

```
api-server/
├── src/
│   ├── index.ts            # Hono app 入口，挂载所有路由
│   ├── routes/
│   │   ├── auth.ts         # 认证路由（JWT）
│   │   ├── books.ts        # 书库：上传、解析、管理
│   │   ├── reader.ts       # 阅读器：进度、划线、批注
│   │   ├── ai.ts           # AI：即时解释（SSE流式）
│   │   ├── viewpoints.ts   # 知识库：观点、文章、引用
│   │   ├── aggregate.ts    # 聚合：手动触发、状态查询
│   │   ├── graph.ts        # 知识图谱：节点、边数据
│   │   ├── publish.ts      # 发布：任务、目标、调度
│   │   └── settings.ts     # 设置：模型配置、存储配置
│   ├── jobs/
│   │   ├── embedding.job.ts    # BullMQ：向量化 Worker
│   │   ├── aggregation.job.ts  # BullMQ：聚合引擎 Worker
│   │   └── publish.job.ts      # BullMQ：定时发布 Worker
│   ├── lib/
│   │   ├── llm.ts          # Vercel AI SDK 封装（BYOK 透传）
│   │   ├── embedding.ts    # Embedding 客户端封装
│   │   ├── minio.ts        # MinIO 客户端封装
│   │   ├── pgvector.ts     # pgvector HNSW 查询封装
│   │   ├── crypto.ts       # AES-256-GCM 加解密（API Key）
│   │   └── redis.ts        # Redis 客户端 + 分布式锁
│   └── db/
│       ├── schema.sql      # 完整建表语句
│       ├── client.ts       # postgres 客户端（pg 驱动）
│       └── migrations/     # 数据迁移脚本
├── package.json
└── tsconfig.json
```

### 1.3 Hono 路由示例（类型安全 RPC 模式）

```typescript
// src/index.ts — 主入口
import { Hono } from "hono";
import { jwt } from "hono/jwt";
import { cors } from "hono/cors";
import { rateLimiter } from "./middleware/rate-limit";
import books from "./routes/books";
import ai from "./routes/ai";
import viewpoints from "./routes/viewpoints";

const app = new Hono();

app.use("*", cors());
app.use("/api/*", jwt({ secret: process.env.JWT_SECRET! }));
app.use("/api/ai/*", rateLimiter({ max: 30, window: "1m" }));

app.route("/api/books", books);
app.route("/api/ai", ai);
app.route("/api/viewpoints", viewpoints);

export default app;

// src/routes/ai.ts — AI 即时解释（流式 SSE）
import { Hono } from "hono";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getUserModelConfig } from "../lib/llm";

const ai = new Hono();

ai.post("/explain", async (c) => {
  const userId = c.get("jwtPayload").sub;
  const { content, context } = await c.req.json();
  const config = await getUserModelConfig(userId, "explain");

  const result = streamText({
    model: createOpenAI({
      baseURL: config.baseUrl,
      apiKey: decrypt(config.apiKey),
    })(config.modelName),
    messages: [
      { role: "user", content: `解析："${content}"\n上下文：${context}` },
    ],
  });

  return result.toTextStreamResponse(); // 直接返回 SSE Response
});

export default ai;
```

### 2.1 书籍上传流程

**PRD 要求：** 上传 PDF/EPUB，文件存入 MinIO，提取元数据，封面。

```
前端                          API Server                  MinIO        PostgreSQL
 │                                │                         │               │
 │ 1. 选择文件（≤ 500MB）          │                         │               │
 │───────────────────────────────→│                         │               │
 │                                │ 2. 校验格式（PDF/EPUB）  │               │
 │                                │ 3. 生成 MinIO 预签名 URL │               │
 │                                │────────────────────────→│               │
 │ 4. 返回预签名 URL               │                         │               │
 │←───────────────────────────────│                         │               │
 │ 5. 前端直传 MinIO（断点续传）   │                         │               │
 │─────────────────────────────────────────────────────────→│               │
 │ 6. 上传完成回调 API             │                         │               │
 │───────────────────────────────→│                         │               │
 │                                │ 7. 异步解析（Bull Job）  │               │
 │                                │   PDF: 提取页数/目录     │               │
 │                                │   EPUB: 解析 spine/toc   │               │
 │                                │   生成封面缩略图（第1页） │               │
 │                                │ 8. 写入 books 表          │               │
 │                                │──────────────────────────────────────────→│
 │ 9. 通知前端解析完成（WebSocket）│                         │               │
 │←───────────────────────────────│                         │               │
```

**封面生成策略：**

- PDF：使用 `pdf-lib` 或 `pdfjs-dist` 渲染第 1 页为 JPEG 缩略图（240×320px），存入 MinIO
- EPUB：解析 OPF 中的 `cover-image` 元素，若无则渲染第 1 页

**MinIO 路径规范：**

```
books/{userId}/{bookId}/original.pdf        # 原始文件
books/{userId}/{bookId}/cover.jpg           # 封面
books/{userId}/{bookId}/meta.json           # 提取的元数据
```

### 2.2 书籍内容读取

**PRD 要求：** 阅读器中渲染 PDF 和 EPUB，按需加载。

```typescript
// API：获取书籍访问凭证（MinIO 预签名 URL，15分钟有效）
GET /api/books/:id/access-url
Response: {
  fileUrl: string,      // 预签名 URL，前端直接拉取
  format: 'PDF'|'EPUB',
  totalPages?: number,
  spine?: SpineItem[]   // EPUB 章节列表
}
```

**前端加载策略：**

```
PDF：
  - 使用 PDF.js getDocument(url) 加载
  - 虚拟列表：仅渲染可视区域 ±2 页
  - 每页独立 Canvas + 透明文本层（用于划线）
  - Web Worker 中处理渲染，主线程保持流畅

EPUB：
  - epub.js Book.open(url) → 解析 spine
  - 每章节在独立 iframe 中渲染（样式隔离）
  - 注入自定义 CSS（阅读设置）+ 划线脚本
```

### 2.3 阅读设置

**PRD 要求：** 字体大小、行距、背景色（日/夜/护眼）。

```typescript
// 存储在 localStorage + 同步到后端 user_preferences
interface ReaderSettings {
  fontSize: 14 | 16 | 18 | 20 | 22; // px
  lineHeight: 1.5 | 1.6 | 1.75 | 2.0;
  fontFamily: "system" | "serif" | "sans";
  theme: "day" | "sepia" | "night";
  // 对应背景色
  // day:    bg=#FFFFFF, text=#1A1A1A
  // sepia:  bg=#F5F0E8, text=#3C3C3C
  // night:  bg=#1A1A1A, text=#D4D4D4
}
```

EPUB 实现：将设置注入 iframe 的 `<style>` 标签
PDF 实现：Canvas 背景色 + 文本层颜色通过 CSS filter 控制

### 2.4 键盘快捷键

**PRD 要求：** 翻页、高亮、全屏（电脑端优先）。

| 快捷键        | 功能                |
| ------------- | ------------------- |
| `→` / `Space` | 下一页 / 下翻       |
| `←`           | 上一页 / 上翻       |
| `H`           | 激活黄色高亮模式    |
| `G`           | 激活绿色高亮模式    |
| `B`           | 激活蓝色高亮模式    |
| `F`           | 全屏切换            |
| `Esc`         | 退出全屏 / 关闭面板 |
| `/`           | 搜索                |
| `Cmd+B`       | 添加书签            |

实现：`useEffect` 中注册全局 `keydown` 监听，阅读器页面挂载时激活。

---

## 三、阅读器核心：划线与批注

**PRD 要求：** 多色高亮，选中文字后弹出操作菜单，批注可附加文字，支持通过位置信息跳回原文。

### 3.1 划线位置数据模型

```typescript
// PDF 划线（基于文本层 offset）
interface PdfHighlight {
  format: "PDF";
  pageIndex: number; // 页码（0-based）
  chapterIndex?: number; // 章节（若有目录）
  rects: DOMRect[]; // 高亮矩形（用于渲染）
  paraOffsetStart: number; // 文本层字符偏移（起）
  paraOffsetEnd: number; // 文本层字符偏移（止）
  content: string; // 划线原文
}

// EPUB 划线（基于 CFI）
interface EpubHighlight {
  format: "EPUB";
  cfiRange: string; // e.g. "epubcfi(/6/4!/4/2/1:0,/1:22)"
  chapterHref: string; // 章节 href
  content: string; // 划线原文
}

// 数据库存储（统一表）
interface Highlight {
  id: string;
  bookId: string;
  userId: string;
  format: "PDF" | "EPUB";
  // PDF 字段
  pageIndex?: number;
  paraOffsetStart?: number;
  paraOffsetEnd?: number;
  rectsJson?: string; // JSON: DOMRect[]
  // EPUB 字段
  cfiRange?: string;
  chapterHref?: string;
  // 通用
  content: string;
  note?: string; // 用户批注
  color: "yellow" | "green" | "blue" | "pink";
  embedding?: number[]; // pgvector
  status: "PENDING" | "VECTORIZED" | "PROCESSED";
  createdAt: Date;
}
```

### 3.2 划线操作完整流程

```
用户选中文字（mouseup）
        │
        ▼
getSelection() → 获取 Range 对象
        │
        ├─ PDF：
        │    TextLayer 中查找 offset
        │    计算 pageIndex + paraOffsetStart/End
        │    收集 clientRects（用于绘制高亮框）
        │
        └─ EPUB（iframe 内）：
             epub.js CFIGenerator.generate(range)
             得到 cfiRange
        │
        ▼
弹出操作菜单（浮动 Popover，跟随选区位置）
  ┌──────────────────────────────────┐
  │  🟡  🟢  🔵  🩷  │  ✏️批注  │  🤖解释  │
  └──────────────────────────────────┘
        │
        ├─ 点击颜色 → 立即渲染高亮
        │    IndexedDB 本地写入（< 10ms，乐观）
        │    异步 POST /api/highlights（不阻塞 UI）
        │
        ├─ 点击批注 → 弹出文本输入框
        │    输入后保存，补充 note 字段
        │
        └─ 点击解释 → 触发 AI 即时解释
             调用 POST /api/ai/explain（流式响应）
             侧边面板展示流式输出
```

### 3.3 高亮渲染（PDF）

```
PDF.js 渲染每页时：
  Canvas 层（底层）：页面图像
  TextLayer（中层）：透明，用于文字选中
  HighlightLayer（顶层）：SVG，绘制高亮框

HighlightLayer 实现：
  - 每页维护一个 <svg> 覆盖在 Canvas 上
  - 从 IndexedDB 读取该页所有划线的 rects
  - 渲染为半透明 <rect> 元素（fill-opacity: 0.35）
  - 颜色映射：yellow=#FBBF24, green=#34D399, blue=#60A5FA, pink=#F472B6
```

### 3.4 跳回原文实现

**PRD 要求：** 所有引用块支持点击跳转原文（精确到段落位置）。

```typescript
// 知识库文章中的引用块数据
interface QuoteBlock {
  highlightId: string;
  bookId: string;
  bookTitle: string;
  chapterName: string;
  content: string;
  // 定位数据
  format: "PDF" | "EPUB";
  pageIndex?: number; // PDF：跳转到对应页
  cfiRange?: string; // EPUB：epub.js.display(cfiRange)
  paraOffsetStart?: number;
}

// 跳转逻辑
function jumpToSource(quote: QuoteBlock) {
  // 1. 在新标签页打开阅读器
  // 2. URL 携带定位参数
  const url = `/reader/${quote.bookId}?highlight=${quote.highlightId}`;
  window.open(url, "_blank");

  // 3. 阅读器初始化时读取 URL 参数
  // PDF: scrollToPage(pageIndex) + 闪烁高亮
  // EPUB: book.rendition.display(cfiRange)
}
```

---

## 四、AI 即时解释（流式）

**PRD 要求：** 选中文字后可触发 AI 解释/扩展，调用用户配置的模型。

### 4.1 流式响应架构

```
前端                      API Server              用户配置的 LLM
 │                            │                        │
 │ POST /api/ai/explain       │                        │
 │ { content, context }       │                        │
 │──────────────────────────→│                        │
 │                            │ 读取用户模型配置        │
 │                            │ （Base URL/Key/Model）  │
 │                            │ Vercel AI SDK           │
 │                            │ streamText(...)         │
 │                            │───────────────────────→│
 │                            │ ←─────────── SSE 流 ───│
 │ ←─ text/event-stream ─────│                        │
 │ 逐 token 渲染到侧边面板    │                        │
```

```typescript
// 后端实现（Hono + Vercel AI SDK）
app.post("/api/ai/explain", async (c) => {
  const { content, context } = await c.req.json();
  const userConfig = await getUserModelConfig(c.userId, "explain");

  const result = streamText({
    model: createOpenAI({
      baseURL: userConfig.baseUrl,
      apiKey: decrypt(userConfig.apiKey),
    })(userConfig.modelName),
    messages: [
      {
        role: "user",
        content: `请对以下文字进行深度解析和扩展：\n\n"${content}"\n\n上下文：${context}`,
      },
    ],
  });

  return result.toTextStreamResponse(); // SSE
});
```

---

## 五、知识库模块

### 5.1 观点树数据结构

**PRD 要求：** 树形结构，类似 Notion 的文档树，按观点/主题组织（非书籍）。

```typescript
// 观点树节点（支持嵌套）
interface ViewpointNode {
  id: string
  userId: string
  title: string
  parentId?: string           // 支持嵌套分组
  sortOrder: number
  highlightCount: number      // 划线数量（影响图谱节点大小）
  isFolder: boolean           // 是否是分组节点
  summaryEmbedding?: number[] // pgvector，观点语义中心
  lastSynthesizedAt?: Date
  articleContent?: string     // 合成文章（TipTap JSON）
}

// API
GET /api/viewpoints/tree
Response: ViewpointNode[]   // 扁平列表，前端构建树（by parentId）
```

### 5.2 文章编辑器：用户编辑保护机制

**PRD 要求：** AI 重新合成时保留用户手动编辑的段落，不覆盖。

#### 标记法设计

```typescript
// TipTap 文档结构（JSON）
interface ArticleDoc {
  type: "doc";
  content: ArticleNode[];
}

interface ArticleNode {
  type: "paragraph" | "heading" | "blockquote" | "quote_block";
  attrs: {
    id: string; // 段落唯一 ID
    isUserEdited: boolean; // 用户编辑标记
    sourceType: "ai" | "user";
    // quote_block 专属
    highlightId?: string;
    bookTitle?: string;
    chapterName?: string;
    jumpUrl?: string;
  };
  content: any[];
}
```

#### 合成时的段落合并逻辑

```typescript
async function mergeArticle(
  existingDoc: ArticleDoc | null,
  newAiContent: ArticleNode[],
): Promise<ArticleDoc> {
  if (!existingDoc) {
    return { type: "doc", content: newAiContent };
  }

  // 提取用户手动编辑的段落（按 ID 保存）
  const userEditedNodes = new Map<string, ArticleNode>();
  for (const node of existingDoc.content) {
    if (node.attrs.isUserEdited) {
      userEditedNodes.set(node.attrs.id, node);
    }
  }

  // 新 AI 内容中，检查是否有对应 ID 的用户编辑段落
  const merged = newAiContent.map((node) => {
    const userEdited = userEditedNodes.get(node.attrs.id);
    if (userEdited) {
      return userEdited; // 保留用户版本
    }
    return node;
  });

  return { type: "doc", content: merged };
}
```

#### 前端编辑触发标记

```typescript
// TipTap 扩展：监听编辑事件，自动打标
const UserEditExtension = Extension.create({
  name: "userEditTracker",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, oldState, newState) {
          // 检测哪些段落被修改
          const tr = newState.tr;
          transactions.forEach((transaction) => {
            if (!transaction.docChanged) return;
            transaction.steps.forEach((step) => {
              // 找到被修改的段落节点，打上 isUserEdited = true
              markAffectedNodes(tr, step, newState.doc);
            });
          });
          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});
```

### 5.3 引用块（QuoteBlock）TipTap 扩展

**PRD 要求：** 引用块支持点击跳转原文。

```typescript
// 自定义 TipTap 节点
const QuoteBlock = Node.create({
  name: "quoteBlock",
  group: "block",
  atom: true, // 不可分割

  addAttributes() {
    return {
      highlightId: { default: null },
      bookTitle: { default: "" },
      chapterName: { default: "" },
      originalText: { default: "" },
      userNote: { default: "" },
      jumpUrl: { default: "" },
    };
  },

  renderHTML({ node }) {
    return [
      "div",
      {
        class: "quote-block",
        "data-highlight-id": node.attrs.highlightId,
      },
      [
        [
          "div",
          { class: "quote-meta" },
          `《${node.attrs.bookTitle}》${node.attrs.chapterName}`,
        ],
        ["blockquote", {}, node.attrs.originalText],
        node.attrs.userNote
          ? ["div", { class: "quote-note" }, `我的批注：${node.attrs.userNote}`]
          : "",
        ["a", { href: node.attrs.jumpUrl, target: "_blank" }, "跳转原文 ↗"],
      ],
    ];
  },
});
```

### 5.4 关联观点

**PRD 要求：** 文章末尾展示关联观点（链接到其他观点文章）。

```sql
-- 关联观点查询：找出与当前观点共享划线的其他观点
SELECT
    v.id,
    v.title,
    vr.weight,
    COUNT(hv.highlight_id) AS shared_highlights
FROM viewpoint_relations vr
JOIN viewpoints v ON v.id = vr.target_id
LEFT JOIN highlight_viewpoints hv
    ON hv.viewpoint_id = vr.target_id
WHERE vr.source_id = $1
  AND vr.weight > 0.1
ORDER BY vr.weight DESC
LIMIT 5;
```

---

## 六、核心算法：划线聚合引擎（完整设计）

### 6.1 聚合任务状态机

```
                    ┌─────────────────────────────────┐
                    │         聚合任务                  │
                    │  IDLE → RUNNING → DONE / FAILED  │
                    └─────────────────────────────────┘

每个用户同一时间只允许一个聚合任务运行（Redis 分布式锁）：
  key: aggregate:lock:{userId}
  ttl: 30 分钟（超时自动释放）
```

### 6.2 完整聚合算法（伪代码）

```typescript
async function runAggregation(userId: string) {
  // === 阶段 1：获取待处理划线 ===
  const pendingHighlights = await db.query(
    `
    SELECT * FROM highlights
    WHERE user_id = $1 AND status = 'PENDING'
    ORDER BY created_at ASC
    LIMIT 500
  `,
    [userId],
  );

  if (pendingHighlights.length === 0) return;

  // === 阶段 2：批量向量化 ===
  // 并发批次处理，每批 50 条
  const BATCH_SIZE = 50;
  const batches = chunk(pendingHighlights, BATCH_SIZE);

  for (const batch of batches) {
    const inputs = batch.map((h) =>
      h.note ? `${h.content}\n\n用户思考：${h.note}` : h.content,
    );

    const embeddings = await embeddingClient.embed(inputs, userId);
    // 写入 embedding 字段，更新 status=VECTORIZED
    await db.batchUpdateEmbeddings(batch, embeddings);
  }

  // === 阶段 3：相似度匹配 ===
  // 对每条已向量化的划线，检索现有观点
  const affectedViewpoints = new Set<string>();

  for (const highlight of pendingHighlights) {
    const matches = await pgvector.search(
      `
      SELECT id, title,
        1 - (summary_embedding <=> $1::vector) AS similarity
      FROM viewpoints
      WHERE user_id = $2
        AND summary_embedding IS NOT NULL
      ORDER BY summary_embedding <=> $1::vector
      LIMIT 10
    `,
      [highlight.embedding, userId],
    );

    const strongMatches = matches.filter((m) => m.similarity > 0.85);
    const weakMatches = matches.filter(
      (m) => m.similarity >= 0.7 && m.similarity <= 0.85,
    );

    // 强关联：直接归属
    for (const match of strongMatches) {
      await db.upsert("highlight_viewpoints", {
        highlightId: highlight.id,
        viewpointId: match.id,
        similarityScore: match.similarity,
        confirmed: true,
      });
      affectedViewpoints.add(match.id);
    }

    // 弱关联：归属 + 待确认
    for (const match of weakMatches) {
      await db.upsert("highlight_viewpoints", {
        highlightId: highlight.id,
        viewpointId: match.id,
        similarityScore: match.similarity,
        confirmed: false, // 用户可在知识库中审核
      });
      affectedViewpoints.add(match.id);
    }

    // 无匹配：创建候选观点
    if (strongMatches.length === 0 && weakMatches.length === 0) {
      await createCandidateViewpoint(highlight, userId);
    }

    await db.updateHighlightStatus(highlight.id, "PROCESSED");
  }

  // === 阶段 4：候选观点升级检查 ===
  // 积累 >= 3 条划线的候选观点，正式生成文章
  const candidates = await db.query(
    `
    SELECT vp.id, COUNT(hv.highlight_id) as cnt
    FROM viewpoints vp
    JOIN highlight_viewpoints hv ON hv.viewpoint_id = vp.id
    WHERE vp.user_id = $1 AND vp.is_candidate = true
    GROUP BY vp.id
    HAVING COUNT(hv.highlight_id) >= 3
  `,
    [userId],
  );

  for (const c of candidates) {
    // 检查是否与现有观点相似（避免重复建观点）
    const existingMatch = await findSimilarViewpoint(c.id, userId, 0.8);
    if (existingMatch) {
      await mergeViewpoints(c.id, existingMatch.id);
    } else {
      await db.update("viewpoints", c.id, { isCandidate: false });
      affectedViewpoints.add(c.id);
    }
  }

  // === 阶段 5：文章重新合成 ===
  for (const viewpointId of affectedViewpoints) {
    await synthesizeArticle(viewpointId, userId);
  }

  // === 阶段 6：更新知识图谱权重 ===
  await rebuildGraphEdges(userId, [...affectedViewpoints]);
}
```

### 6.3 文章合成详细实现

```typescript
async function synthesizeArticle(viewpointId: string, userId: string) {
  const viewpoint = await db.findViewpoint(viewpointId);

  // 获取该观点所有划线（强关联 + 已确认弱关联）
  const highlights = await db.query(
    `
    SELECT h.*, b.title AS book_title, b.author
    FROM highlights h
    JOIN highlight_viewpoints hv ON hv.highlight_id = h.id
    JOIN books b ON b.id = h.book_id
    WHERE hv.viewpoint_id = $1
      AND (hv.similarity_score > 0.85 OR hv.confirmed = true)
    ORDER BY b.title, h.created_at
  `,
    [viewpointId],
  );

  // 构建 Prompt 输入（按书籍分组）
  const highlightsByBook = groupBy(highlights, "book_title");
  const highlightsText = Object.entries(highlightsByBook)
    .map(([bookTitle, hs]) => {
      const items = hs
        .map(
          (h) =>
            `  - 原文："${h.content}"${h.note ? `\n    用户批注：${h.note}` : ""}`,
        )
        .join("\n");
      return `【${bookTitle}】\n${items}`;
    })
    .join("\n\n");

  // 获取用户配置的合成模型
  const modelConfig = await getUserModelConfig(userId, "synthesis");

  // 流式合成（存储时合并为完整文本）
  const { text: newArticleMarkdown } = await generateText({
    model: createOpenAI({
      baseURL: modelConfig.baseUrl,
      apiKey: decrypt(modelConfig.apiKey),
    })(modelConfig.modelName),
    messages: [
      {
        role: "system",
        content: SYNTHESIS_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildSynthesisPrompt(viewpoint.title, highlightsText),
      },
    ],
    maxTokens: 4000,
  });

  // Markdown → TipTap JSON
  const newDoc = markdownToTipTap(newArticleMarkdown, highlights);

  // 与现有文章合并（保护用户编辑段落）
  const existingDoc = viewpoint.articleContent
    ? JSON.parse(viewpoint.articleContent)
    : null;
  const mergedDoc = mergeArticle(existingDoc, newDoc.content);

  // 更新观点的 summary_embedding（用观点标题 + 核心论点前500字）
  const summaryText = `${viewpoint.title}\n\n${extractCoreSummary(newArticleMarkdown)}`;
  const summaryEmbedding = await embeddingClient.embedSingle(
    summaryText,
    userId,
  );

  await db.update("viewpoints", viewpointId, {
    articleContent: JSON.stringify(mergedDoc),
    summaryEmbedding,
    lastSynthesizedAt: new Date(),
    highlightCount: highlights.length,
  });
}
```

### 6.4 文章合成 Prompt（完整版）

```typescript
const SYNTHESIS_SYSTEM_PROMPT = `
你是用户的个人知识助手，专门帮助用户将阅读中的划线整合为个人认知文章。

你的工作原则：
1. 忠实呈现：所有内容必须来源于用户的划线和批注，不编造、不推断
2. 逻辑连贯：在引用之间提供流畅的衔接语言，形成完整论述
3. 结构清晰：按照指定的文章结构输出
4. 第一人称：以"我"的视角撰写，这是用户的个人认知
5. 引用保留：每条引用必须标注书名和章节
`;

function buildSynthesisPrompt(title: string, highlightsText: string) {
  return `
请将以下关于「${title}」的划线和批注整合为一篇认知文章。

划线来源：
${highlightsText}

输出格式（严格按此 Markdown 结构）：

# ${title}

## 核心论点
（用 2-3 句话提炼这个观点的核心主张，基于以上划线）

## 论据与展开

（对每条关键划线，按以下格式呈现：）
（衔接语言...）

> 引用：《书名》
> "原文引用..."
> 我的批注：（如有批注则填入，否则省略此行）

（继续下一条引用...）

## 我的理解
（汇总用户批注中体现的个人思考，若批注为空则写"（待补充）"）

## 关联思考
（基于以上内容，指出可以延伸思考的方向，用简短的 1-2 条）
`;
}
```

### 6.5 图谱边权重计算

**PRD 要求：** 两个观点被同一批划线同时引用，则产生关联边。节点大小 = 划线数量权重。

```sql
-- 重建指定观点的图谱边
-- 逻辑：找出与其共享至少 1 条划线的其他观点，计算 Jaccard 相似系数
WITH shared AS (
  SELECT
    hv2.viewpoint_id AS target_id,
    COUNT(DISTINCT hv1.highlight_id) AS shared_count
  FROM highlight_viewpoints hv1
  JOIN highlight_viewpoints hv2
    ON hv1.highlight_id = hv2.highlight_id
    AND hv2.viewpoint_id != $1
  WHERE hv1.viewpoint_id = $1
  GROUP BY hv2.viewpoint_id
),
totals AS (
  SELECT viewpoint_id, COUNT(DISTINCT highlight_id) AS total
  FROM highlight_viewpoints
  WHERE viewpoint_id IN (SELECT target_id FROM shared)
     OR viewpoint_id = $1
  GROUP BY viewpoint_id
)
INSERT INTO viewpoint_relations (source_id, target_id, weight, updated_at)
SELECT
  $1,
  s.target_id,
  -- Jaccard = 交集 / 并集
  s.shared_count::float /
    (t_src.total + t_tgt.total - s.shared_count) AS weight,
  NOW()
FROM shared s
JOIN totals t_src ON t_src.viewpoint_id = $1
JOIN totals t_tgt ON t_tgt.viewpoint_id = s.target_id
ON CONFLICT (source_id, target_id)
DO UPDATE SET weight = EXCLUDED.weight, updated_at = NOW();
```

---

## 七、知识图谱（D3.js）

**PRD 要求：** 只读，节点大小=划线数量，边=共享划线，缩放/拖拽，点击跳转，按书/标签/时间筛选，聚焦模式。

### 7.1 数据接口

```typescript
// API
GET /api/graph?bookId=&startDate=&endDate=
Response: {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface GraphNode {
  id: string
  title: string
  highlightCount: number   // 影响节点半径：r = 8 + count * 1.5（max 40）
  bookIds: string[]        // 来源书籍（用于筛选）
  lastSynthesizedAt: string
}

interface GraphLink {
  source: string
  target: string
  weight: number           // 影响边宽度：strokeWidth = 1 + weight * 5
}
```

### 7.2 D3 力导向图实现要点

```typescript
// 力导向配置
const simulation = d3
  .forceSimulation(nodes)
  .force(
    "link",
    d3
      .forceLink(links)
      .id((d) => d.id)
      .distance((d) => 150 / (d.weight + 0.1)), // 权重越大，距离越近
  )
  .force("charge", d3.forceManyBody().strength(-300))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force(
    "collision",
    d3.forceCollide().radius((d) => d.r + 10),
  );

// 聚焦模式：点击节点
function focusNode(nodeId: string) {
  const connected = getConnectedIds(nodeId, links); // 一二级关联

  // 非关联节点：opacity → 0.1
  node.attr("opacity", (d) => (connected.has(d.id) ? 1 : 0.1));
  link.attr("opacity", (d) =>
    connected.has(d.source.id) && connected.has(d.target.id) ? 0.8 : 0.05,
  );
}

// 缩放（SVG transform）
const zoom = d3
  .zoom()
  .scaleExtent([0.2, 5])
  .on("zoom", (event) => {
    g.attr("transform", event.transform);
  });
svg.call(zoom);
```

---

## 八、发布模块

**PRD 要求：** 任务列表 + 配置面板，支持 KMS/Webhook，手动/定时/内容变更触发，Markdown/PDF 导出，邮件发送，文章右上角快捷操作。

### 8.1 数据模型

```sql
-- 发布目标（用户配置的平台）
CREATE TABLE publish_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  name          VARCHAR(200),           -- 目标名称（如"公司 KMS"）
  type          VARCHAR(50),            -- 'webhook' | 'kms' | 'notion'
  endpoint_url  TEXT,                   -- KMS 页面 URL / Webhook URL
  auth_header   TEXT,                   -- Authorization header（加密存储）
  extra_config  JSONB,                  -- 各平台特有配置
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 发布任务
CREATE TABLE publish_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  name            VARCHAR(200),
  -- 来源：一篇或多篇观点文章
  viewpoint_ids   UUID[],
  target_id       UUID REFERENCES publish_targets(id),
  format          VARCHAR(20),   -- 'markdown' | 'pdf' | 'html'
  -- 触发方式
  trigger_type    VARCHAR(20),   -- 'manual' | 'cron' | 'on_change'
  cron_expr       VARCHAR(100),  -- 仅 cron 时填写，如 '0 9 * * 1'
  on_change_delay INT,           -- 内容变更后延迟 N 分钟触发（分钟）
  enabled         BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 发布记录
CREATE TABLE publish_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES publish_tasks(id),
  triggered_by    VARCHAR(20),   -- 'manual' | 'cron' | 'on_change'
  status          VARCHAR(20),   -- 'SUCCESS' | 'FAILED' | 'RUNNING'
  error_msg       TEXT,
  article_version TEXT,          -- 发布时文章内容的 hash（用于对比版本）
  executed_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.2 定时发布（cron）

```typescript
// 系统启动时，加载所有用户的 cron 任务
async function initPublishScheduler() {
  const tasks = await db.query(`
    SELECT * FROM publish_tasks
    WHERE trigger_type = 'cron' AND enabled = true
  `);

  for (const task of tasks) {
    addCronJob(task.id, task.cronExpr, async () => {
      await executePublishTask(task.id, "cron");
    });
  }
}

// 内容变更触发
// 在 synthesizeArticle 完成后：
async function onArticleSynthesized(viewpointId: string) {
  const tasks = await db.query(
    `
    SELECT * FROM publish_tasks
    WHERE $1 = ANY(viewpoint_ids)
      AND trigger_type = 'on_change'
      AND enabled = true
  `,
    [viewpointId],
  );

  for (const task of tasks) {
    // 延迟 N 分钟加入队列
    await publishQueue.add(
      "publish",
      { taskId: task.id },
      {
        delay: task.onChangeDelay * 60 * 1000,
      },
    );
  }
}
```

### 8.3 Webhook 发布实现

```typescript
async function executeWebhookPublish(task: PublishTask) {
  // 1. 获取文章内容
  const articles = await getViewpointsContent(task.viewpointIds);

  // 2. 格式转换
  let payload: string;
  if (task.format === "markdown") {
    payload = articles
      .map((a) => tipTapToMarkdown(a.articleContent))
      .join("\n\n---\n\n");
  } else if (task.format === "html") {
    payload = articles.map((a) => tipTapToHtml(a.articleContent)).join("");
  } else if (task.format === "pdf") {
    payload = await generatePdf(articles); // 返回 base64
  }

  // 3. 发送 Webhook
  const target = await db.findPublishTarget(task.targetId);
  const response = await fetch(target.endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: decrypt(target.authHeader),
    },
    body: JSON.stringify({
      title: articles.map((a) => a.title).join(" + "),
      content: payload,
      format: task.format,
      publishedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);
}
```

### 8.4 文章页快捷操作

**PRD 要求：** 发送到邮件、一键导出 Markdown/PDF、手动推送已配置目标。

```typescript
// 邮件发送
POST /api/articles/:viewpointId/send-email
Body: { email: string }

// 后端：用 Nodemailer
async function sendArticleByEmail(viewpointId: string, email: string) {
  const article = await getViewpointWithContent(viewpointId)
  const html = tipTapToHtml(article.articleContent)

  await transporter.sendMail({
    to: email,
    subject: `[Lumina] ${article.title}`,
    html: wrapEmailTemplate(html, article.title),
  })
}

// Markdown 导出（前端直接触发，无需后端）
function exportMarkdown(viewpointId: string) {
  const content = editor.storage.markdown.getMarkdown()
  const blob = new Blob([content], { type: 'text/markdown' })
  downloadFile(blob, `${title}.md`)
}

// PDF 导出
POST /api/articles/:viewpointId/export-pdf
Response: PDF 文件流（Content-Type: application/pdf）

// 后端：用 Puppeteer 或 @react-pdf/renderer
```

---

## 九、设置模块（完整覆盖）

### 9.1 多模型配置

**PRD 要求：** 支持配置多个模型分别用于：聚合分析 / 文章生成 / 即时解释。

```sql
CREATE TABLE user_model_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  usage       VARCHAR(50) NOT NULL,
  -- 'aggregation'（聚合分析）
  -- 'synthesis'（文章生成）
  -- 'explain'（即时解释）
  -- 'embedding'（向量化，单独配置）
  base_url    TEXT NOT NULL,
  api_key     TEXT NOT NULL,  -- AES-256-GCM 加密存储
  model_name  VARCHAR(200) NOT NULL,
  UNIQUE (user_id, usage)
);
```

```typescript
// 连通性测试
POST / api / settings / model / test;
Body: {
  (baseUrl, apiKey, modelName, usage);
}

async function testModelConnection(config) {
  try {
    const result = await generateText({
      model: createOpenAI({
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
      })(config.modelName),
      messages: [{ role: "user", content: "Hi" }],
      maxTokens: 5,
    });
    return { success: true, latencyMs: result.usage?.latencyMs };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
```

### 9.2 MinIO 配置

```sql
CREATE TABLE user_storage_configs (
  user_id     UUID PRIMARY KEY REFERENCES users(id),
  use_custom  BOOLEAN DEFAULT false,
  endpoint    TEXT,    -- 自定义 MinIO 地址
  access_key  TEXT,
  secret_key  TEXT,    -- AES 加密
  bucket      TEXT,
  region      VARCHAR(50) DEFAULT 'us-east-1'
);
```

### 9.3 聚合频率配置

```sql
ALTER TABLE users ADD COLUMN
  aggregate_schedule VARCHAR(20) DEFAULT 'manual';
  -- 'manual' | 'daily' | 'weekly'
ALTER TABLE users ADD COLUMN
  aggregate_cron VARCHAR(100);
  -- daily: '0 2 * * *'（每天凌晨2点）
  -- weekly: '0 2 * * 0'（每周日凌晨2点）
```

### 9.4 账户：数据导出

**PRD 要求：** 数据导出/删除。

```typescript
// 全量数据导出（ZIP）
GET /api/account/export
Response: application/zip

// 包含：
// - books_metadata.json（书籍信息，不含文件）
// - highlights.json（所有划线和批注）
// - viewpoints/（每个观点一个 .md 文件）
// - settings.json（配置信息，不含 API Key）

// 账户注销
DELETE /api/account
// 1. 删除 MinIO 中该用户的所有文件
// 2. CASCADE 删除数据库所有关联数据
// 3. 软删除 users 记录（保留30天用于申诉）
```

---

## 十、完整数据库 Schema

```sql
-- 启用 pgvector
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  aggregate_schedule VARCHAR(20) DEFAULT 'manual',
  aggregate_cron  VARCHAR(100),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 书籍
CREATE TABLE books (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  author          VARCHAR(255),
  format          VARCHAR(10) NOT NULL CHECK (format IN ('PDF', 'EPUB')),
  minio_path      VARCHAR(1000) NOT NULL,
  cover_path      VARCHAR(1000),
  total_pages     INT,
  read_progress   FLOAT DEFAULT 0 CHECK (read_progress BETWEEN 0 AND 1),
  last_read_at    TIMESTAMPTZ,
  tags            TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 划线（核心表）
CREATE TABLE highlights (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id             UUID REFERENCES books(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  format              VARCHAR(10) NOT NULL,
  -- PDF
  page_index          INT,
  para_offset_start   INT,
  para_offset_end     INT,
  rects_json          TEXT,
  -- EPUB
  cfi_range           TEXT,
  chapter_href        TEXT,
  -- 通用
  content             TEXT NOT NULL,
  note                TEXT,
  color               VARCHAR(20) DEFAULT 'yellow',
  embedding           vector(1536),
  status              VARCHAR(20) DEFAULT 'PENDING',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 观点（知识库节点）
CREATE TABLE viewpoints (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_id           UUID REFERENCES viewpoints(id),  -- 支持嵌套分组
  title               VARCHAR(500) NOT NULL,
  is_folder           BOOLEAN DEFAULT false,
  is_candidate        BOOLEAN DEFAULT false,   -- 候选观点，待积累至3条划线
  sort_order          INT DEFAULT 0,
  highlight_count     INT DEFAULT 0,
  summary_embedding   vector(1536),
  article_content     TEXT,                    -- TipTap JSON
  last_synthesized_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 划线-观点 多对多
CREATE TABLE highlight_viewpoints (
  highlight_id      UUID REFERENCES highlights(id) ON DELETE CASCADE,
  viewpoint_id      UUID REFERENCES viewpoints(id) ON DELETE CASCADE,
  similarity_score  FLOAT,
  confirmed         BOOLEAN DEFAULT false,
  PRIMARY KEY (highlight_id, viewpoint_id)
);

-- 观点关系（图谱边）
CREATE TABLE viewpoint_relations (
  source_id   UUID REFERENCES viewpoints(id) ON DELETE CASCADE,
  target_id   UUID REFERENCES viewpoints(id) ON DELETE CASCADE,
  weight      FLOAT DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (source_id, target_id)
);

-- 模型配置
CREATE TABLE user_model_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  usage       VARCHAR(50) NOT NULL,
  base_url    TEXT NOT NULL,
  api_key     TEXT NOT NULL,
  model_name  VARCHAR(200) NOT NULL,
  UNIQUE (user_id, usage)
);

-- 存储配置
CREATE TABLE user_storage_configs (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  use_custom  BOOLEAN DEFAULT false,
  endpoint    TEXT,
  access_key  TEXT,
  secret_key  TEXT,
  bucket      TEXT,
  region      VARCHAR(50) DEFAULT 'us-east-1'
);

-- 发布目标
CREATE TABLE publish_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(200),
  type          VARCHAR(50),
  endpoint_url  TEXT,
  auth_header   TEXT,
  extra_config  JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 发布任务
CREATE TABLE publish_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(200),
  viewpoint_ids   UUID[],
  target_id       UUID REFERENCES publish_targets(id),
  format          VARCHAR(20),
  trigger_type    VARCHAR(20),
  cron_expr       VARCHAR(100),
  on_change_delay INT,
  enabled         BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 发布记录
CREATE TABLE publish_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES publish_tasks(id) ON DELETE CASCADE,
  triggered_by    VARCHAR(20),
  status          VARCHAR(20),
  error_msg       TEXT,
  article_version VARCHAR(64),
  executed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_highlight_user_status ON highlights (user_id, status);
CREATE INDEX idx_highlight_book ON highlights (book_id, created_at DESC);
CREATE INDEX idx_viewpoint_user ON viewpoints (user_id, sort_order);
CREATE INDEX idx_hv_viewpoint ON highlight_viewpoints (viewpoint_id);
CREATE INDEX idx_hv_highlight ON highlight_viewpoints (highlight_id);
CREATE INDEX idx_vr_source ON viewpoint_relations (source_id, weight DESC);
CREATE INDEX idx_publish_task_user ON publish_tasks (user_id, enabled);

-- pgvector HNSW 索引
CREATE INDEX idx_highlight_embedding ON highlights
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_viewpoint_embedding ON viewpoints
  USING hnsw (summary_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## 十一、完整 API 清单

### 认证

| Method | Path                 | 说明           |
| ------ | -------------------- | -------------- |
| POST   | `/api/auth/register` | 注册           |
| POST   | `/api/auth/login`    | 登录，返回 JWT |
| POST   | `/api/auth/refresh`  | 刷新 Token     |
| POST   | `/api/auth/logout`   | 登出           |

### 书库

| Method | Path                        | 说明                             |
| ------ | --------------------------- | -------------------------------- |
| GET    | `/api/books`                | 书库列表（支持 tag/search 过滤） |
| POST   | `/api/books/presign`        | 获取 MinIO 预签名上传 URL        |
| POST   | `/api/books/confirm-upload` | 上传完成，触发解析 Job           |
| GET    | `/api/books/:id`            | 书籍详情                         |
| GET    | `/api/books/:id/access-url` | 获取阅读预签名 URL               |
| PUT    | `/api/books/:id`            | 修改标签/分类                    |
| DELETE | `/api/books/:id`            | 删除书籍（含 MinIO 文件）        |
| GET    | `/api/books/:id/toc`        | 获取目录                         |

### 阅读器

| Method | Path                        | 说明             |
| ------ | --------------------------- | ---------------- |
| GET    | `/api/books/:id/progress`   | 获取阅读进度     |
| PUT    | `/api/books/:id/progress`   | 更新阅读进度     |
| GET    | `/api/books/:id/highlights` | 获取该书所有划线 |
| POST   | `/api/highlights`           | 新建划线         |
| PUT    | `/api/highlights/:id`       | 更新批注/颜色    |
| DELETE | `/api/highlights/:id`       | 删除划线         |
| GET    | `/api/reader-settings`      | 获取阅读设置     |
| PUT    | `/api/reader-settings`      | 保存阅读设置     |

### AI

| Method | Path              | 说明                 |
| ------ | ----------------- | -------------------- |
| POST   | `/api/ai/explain` | 即时解释（SSE 流式） |

### 知识库

| Method | Path                                  | 说明                          |
| ------ | ------------------------------------- | ----------------------------- |
| GET    | `/api/viewpoints/tree`                | 获取观点树                    |
| POST   | `/api/viewpoints`                     | 新建观点/分组                 |
| GET    | `/api/viewpoints/:id`                 | 观点详情（含文章）            |
| PUT    | `/api/viewpoints/:id`                 | 更新观点标题/位置             |
| DELETE | `/api/viewpoints/:id`                 | 删除观点                      |
| PUT    | `/api/viewpoints/:id/article`         | 保存文章（用户编辑）          |
| GET    | `/api/viewpoints/:id/highlights`      | 观点下所有划线                |
| GET    | `/api/viewpoints/:id/related`         | 关联观点                      |
| POST   | `/api/viewpoints/:id/send-email`      | 发送文章到邮件                |
| GET    | `/api/viewpoints/:id/export`          | 导出（?format=markdown\|pdf） |
| GET    | `/api/highlights/:id/unconfirmed`     | 获取待确认弱关联划线          |
| PUT    | `/api/highlight-viewpoints/:hId/:vId` | 确认/取消划线归属             |

### 聚合

| Method | Path                     | 说明         |
| ------ | ------------------------ | ------------ |
| POST   | `/api/aggregate`         | 手动触发聚合 |
| GET    | `/api/aggregate/status`  | 聚合任务状态 |
| GET    | `/api/aggregate/history` | 聚合历史记录 |

### 知识图谱

| Method | Path         | 说明                     |
| ------ | ------------ | ------------------------ |
| GET    | `/api/graph` | 图谱数据（支持筛选参数） |

### 发布

| Method | Path                             | 说明         |
| ------ | -------------------------------- | ------------ |
| GET    | `/api/publish/targets`           | 发布目标列表 |
| POST   | `/api/publish/targets`           | 新建发布目标 |
| PUT    | `/api/publish/targets/:id`       | 修改发布目标 |
| DELETE | `/api/publish/targets/:id`       | 删除发布目标 |
| GET    | `/api/publish/tasks`             | 发布任务列表 |
| POST   | `/api/publish/tasks`             | 新建发布任务 |
| PUT    | `/api/publish/tasks/:id`         | 修改任务配置 |
| DELETE | `/api/publish/tasks/:id`         | 删除任务     |
| POST   | `/api/publish/tasks/:id/trigger` | 手动触发一次 |
| GET    | `/api/publish/tasks/:id/records` | 发布历史     |

### 设置

| Method | Path                          | 说明                 |
| ------ | ----------------------------- | -------------------- |
| GET    | `/api/settings/models`        | 获取所有模型配置     |
| PUT    | `/api/settings/models/:usage` | 保存某用途的模型配置 |
| POST   | `/api/settings/models/test`   | 连通性测试           |
| GET    | `/api/settings/storage`       | 存储配置             |
| PUT    | `/api/settings/storage`       | 保存存储配置         |
| GET    | `/api/settings/schedule`      | 聚合频率配置         |
| PUT    | `/api/settings/schedule`      | 保存聚合频率         |

### 账户

| Method | Path                    | 说明                |
| ------ | ----------------------- | ------------------- |
| GET    | `/api/account/profile`  | 个人信息            |
| PUT    | `/api/account/profile`  | 修改信息            |
| PUT    | `/api/account/password` | 修改密码            |
| GET    | `/api/account/export`   | 全量数据导出（ZIP） |
| DELETE | `/api/account`          | 注销账户            |

---

## 十二、安全设计

| 安全点       | 实现方式                                                                    |
| ------------ | --------------------------------------------------------------------------- |
| API Key 存储 | AES-256-GCM 加密，密钥由服务端环境变量 `ENCRYPTION_KEY` 管理，绝不明文入库  |
| 用户数据隔离 | 所有 DB 查询强制 `WHERE user_id = $currentUserId`，中间件注入               |
| JWT 策略     | RS256 非对称签名，Access Token 1小时，Refresh Token 7天，存 httpOnly Cookie |
| MinIO 访问   | 预签名 URL，15分钟有效；Bucket 策略设为私有，禁止公开读                     |
| 文件类型校验 | 后端校验 Magic Bytes（不信任 Content-Type），只接受 PDF/EPUB                |
| 文件大小限制 | 单文件 500MB 上限，Nginx 层配置 `client_max_body_size`                      |
| XSS 防护     | TipTap 输出内容用 DOMPurify 净化后再渲染                                    |
| SQL 注入     | 全部使用参数化查询（pg 驱动），禁止字符串拼接 SQL                           |
| 速率限制     | 认证接口 5次/分钟，AI 接口 30次/分钟（Redis 计数）                          |

---

## 十三、MVP 交付计划（7 周）

| 周次   | 交付内容                                                        | 覆盖 PRD             |
| ------ | --------------------------------------------------------------- | -------------------- |
| Week 1 | 项目脚手架 + 认证 + 书籍上传（MinIO）+ 基础书库页               | §3.1书架页           |
| Week 2 | PDF 阅读器（PDF.js + 文本层）+ EPUB 阅读器（epub.js）+ 阅读进度 | §3.1阅读页 格式/进度 |
| Week 3 | 划线/高亮（4色）+ 批注 + IndexedDB 本地缓存 + 跳回原文          | §3.1 划线/批注       |
| Week 4 | Embedding 生成 + pgvector 检索 + 聚合算法 + 手动触发聚合        | §4 全部              |
| Week 5 | 知识库三栏 + TipTap 编辑器 + 用户编辑保护 + 引用块              | §3.2 全部            |
| Week 6 | 设置页（多模型配置 + Embedding + 存储 + 频率）+ 连通性测试      | §3.5 全部            |
| Week 7 | 联调测试 + 阅读设置（字体/背景色）+ 键盘快捷键 + AI即时解释     | §3.1排版/快捷键      |

**二期（Week 8-12）：**

- 知识图谱（D3.js）
- 定时聚合（cron）
- 发布模块（KMS/Webhook/邮件/PDF导出）
- 账户数据导出/注销
