# 模块 02：书库（library）

> 阶段：001
> 对应 PRD：§三.1 书库（Library）
> 对应 Tech：§二书籍上传流程、§二.2书籍内容读取、MinIO路径规范、书库API清单

---

## 1. 模块职责

- 书架页面：封面网格视图，支持标签筛选
- 书籍上传：前端直传 MinIO（预签名 URL 方案），支持 PDF/EPUB
- 异步解析：上传完成后通过 BullMQ Job 提取元数据、目录、生成封面缩略图
- 书籍管理：修改标签/分类、删除（含 MinIO 文件清理）
- 书籍访问：生成阅读用预签名 URL，供阅读器模块使用

---

## 2. 书架页面 UI

### 2.1 布局

```
┌─────────────────────────────────────────────────────────────┐
│  [上传书籍]  [新建分类]          搜索框    [标签筛选]         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │封面  │  │封面  │  │封面  │  │封面  │  │      │         │
│  │      │  │      │  │      │  │      │  │  +   │         │
│  │      │  │      │  │      │  │      │  │上传  │         │
│  │书名  │  │书名  │  │书名  │  │书名  │  │      │         │
│  │作者  │  │作者  │  │作者  │  │作者  │  │      │         │
│  │进度  │  │进度  │  │进度  │  │进度  │  │      │         │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 书籍卡片字段

| 字段 | 说明 |
|------|------|
| 封面 | 240×320px，来自 MinIO `cover.jpg`；无封面时显示书名首字占位 |
| 书名 | 最多 2 行，超出截断 |
| 作者 | 单行 |
| 阅读进度 | 进度条（`read_progress` 字段，0~1） |
| 最近阅读时间 | 相对时间（"3天前"） |

### 2.3 交互

- 点击卡片 → 进入阅读页（`/reader/[bookId]`）
- 右键 / 悬浮操作菜单：编辑标签、删除
- 上传按钮：打开文件选择器，接受 `.pdf` `.epub`

---

## 3. 书籍上传流程

```
前端                         API Server               MinIO         PostgreSQL
 │                               │                      │               │
 │ 1. 选择文件（≤500MB）           │                      │               │
 │──────────────────────────────→│                      │               │
 │                               │ 2. 校验格式（Magic Bytes）            │
 │                               │ 3. 生成 MinIO 预签名上传 URL          │
 │                               │─────────────────────→│               │
 │ 4. 返回预签名 URL              │                      │               │
 │←──────────────────────────────│                      │               │
 │ 5. 前端直传（带进度条）         │                      │               │
 │──────────────────────────────────────────────────────→│              │
 │ 6. 上传完成，调用 confirm API  │                      │               │
 │──────────────────────────────→│                      │               │
 │                               │ 7. 入库 books 表（status=PROCESSING）│
 │                               │ 8. 推送 BullMQ parse Job            │
 │                               │ 9. WebSocket 通知前端解析完成        │
 │←──────────────────────────────│                      │               │
```

### 3.1 MinIO 路径规范

```
books/{userId}/{bookId}/original.pdf   # 原始文件
books/{userId}/{bookId}/cover.jpg      # 封面缩略图（240×320）
books/{userId}/{bookId}/meta.json      # 提取的元数据
```

### 3.2 解析 Job（BullMQ）

**PDF 解析：**
- 使用 `pdfjs-dist`（Node.js 模式）提取：页数、目录（Outline）
- 渲染第 1 页为 JPEG 缩略图（240×320px），上传到 MinIO

**EPUB 解析：**
- 解析 OPF（`content.opf`）提取：书名、作者、spine（章节列表）、封面图
- 若无封面则渲染第 1 章第 1 页

解析完成后更新 `books` 表：`total_pages`、`cover_path`、`toc_json`（目录 JSON）

---

## 4. 书籍读取（供阅读器模块使用）

```typescript
// 获取书籍阅读凭证
GET /api/books/:id/access-url
Response: {
  fileUrl: string,      // MinIO 预签名 URL，15 分钟有效
  format: 'PDF' | 'EPUB',
  totalPages?: number,
  spine?: SpineItem[]   // EPUB 章节列表
  toc?: TocItem[]       // 目录
}
```

---

## 5. API 清单

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/books` | 书库列表（支持 tag/search 过滤、分页） |
| POST | `/api/books/presign` | 获取 MinIO 预签名上传 URL |
| POST | `/api/books/confirm-upload` | 上传完成，触发解析 Job |
| GET | `/api/books/:id` | 书籍详情 |
| GET | `/api/books/:id/access-url` | 获取阅读预签名 URL |
| GET | `/api/books/:id/toc` | 获取目录 |
| PUT | `/api/books/:id` | 修改标签/分类 |
| DELETE | `/api/books/:id` | 删除书籍（含 MinIO 文件） |

---

## 6. 数据模型

```typescript
interface Book {
  id: string
  userId: string
  title: string
  author?: string
  format: 'PDF' | 'EPUB'
  minioPath: string
  coverPath?: string
  totalPages?: number
  tocJson?: TocItem[]   // 目录
  readProgress: number  // 0~1
  lastReadAt?: Date
  tags: string[]
  createdAt: Date
}

interface TocItem {
  title: string
  pageIndex?: number  // PDF
  href?: string       // EPUB
  children?: TocItem[]
}
```

---

## 7. 验收标准

- [ ] 上传 PDF（≤500MB）成功，书架出现封面卡片
- [ ] 上传 EPUB 成功，封面从 OPF 中提取
- [ ] 上传非 PDF/EPUB 文件，后端返回 400 错误（Magic Bytes 校验）
- [ ] 删除书籍后，MinIO 中对应文件被清理
- [ ] 书架按标签筛选正常
- [ ] 书籍解析 Job 失败后，状态更新为 `PARSE_FAILED`，前端显示错误提示
