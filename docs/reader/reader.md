# 模块：阅读器（reader）

---

## 1. 模块职责

- PDF 阅读器（PDF.js Web Worker + 虚拟列表）
- EPUB 阅读器（epub.js + iframe 章节隔离）
- Web 文章阅读器（Readability 提取内容）
- 阅读进度自动记录
- 多色高亮划线（4 色）+ 操作菜单
- 侧边批注（不打断阅读流）
- 排版设置（字体大小、行距、主题）
- 键盘快捷键
- AI 辅助（读前/读中/读后三个时机）
- 跳回原文入口（从笔记页定位到原文位置）

---

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────┐
│  ← 返回   书名 / 文章标题              ⚙设置  ⛶全屏          │
├──────────────────────────────────────────────────────────────┤
│                                │                             │
│                                │   侧边批注区                 │
│         [渲染区域]              │   （高亮选中后浮现）          │
│   PDF: Canvas + TextLayer      │                             │
│   EPUB: iframe                 │   批注 1：...               │
│   Article: Prose               │   批注 2：...               │
│                                │                             │
├──────────────────────────────────────────────────────────────┤
│  第 N 页 / 共 M 页          进度滑块         章节名           │
└──────────────────────────────────────────────────────────────┘

选中文字时，文字上方浮出操作菜单：
┌────────────────────────────────────┐
│  🟡  🟢  🔵  🩷  │  ✏批注  │  🤖解释 │
└────────────────────────────────────┘
```

---

## 3. PDF 阅读器

### 渲染架构

每页三层叠加（z-index 递增）：
- **Canvas 层**：页面图像（PDF.js Web Worker 渲染）
- **TextLayer**：透明，用于文字选中
- **HighlightLayer**：SVG，绘制半透明高亮框

### 虚拟列表

仅渲染可视区域 ±2 页，滚动到某页时异步加载 Canvas。

### Web Worker

PDF.js 渲染在 Web Worker 中执行，主线程只处理交互和渲染结果。

---

## 4. EPUB 阅读器

- epub.js 加载文件，解析 spine（章节列表）
- 每章节在独立 `<iframe>` 中渲染（样式隔离）
- 向 iframe 注入自定义 CSS（排版设置）
- 向 iframe 注入划线脚本（监听 `mouseup`）

---

## 5. 高亮与批注

### 数据模型

```typescript
// PDF 高亮位置
interface PdfPosition {
  page: number
  rects: DOMRect[]
  paraOffsetStart: number
  paraOffsetEnd: number
}

// EPUB 高亮位置
interface EpubPosition {
  cfi: string
  chapterHref: string
}

// 文章高亮位置
interface ArticlePosition {
  offset: number
  length: number
}

type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'

interface Highlight {
  id: string
  sourceType: 'book' | 'article'
  sourceId: string
  content: string
  note?: string
  color: HighlightColor
  position: PdfPosition | EpubPosition | ArticlePosition
  createdAt: number
}
```

### 划线操作流程

```
用户选中文字（mouseup）
        │
        ▼
getSelection() → Range
        │
        ├─ PDF：TextLayer 计算 page + paraOffset + clientRects
        └─ EPUB：epub.js CFIGenerator.generate(range)
        │
        ▼
浮出操作菜单（跟随选区位置）
        │
        ├─ 点击颜色 → 立即渲染高亮 + invoke("create_highlight", data)
        ├─ 点击批注 → 侧边批注区展开内联输入框（不弹 Modal）
        └─ 点击解释 → invoke("stream_ai_explain") + listen("ai_chunk")
```

### 侧边批注

- 高亮创建后，侧边栏对应位置出现批注占位
- 点击占位 → 展开内联输入框，直接输入，失焦保存
- 批注与高亮关联，页面所有批注形成连续思考流
- 批注内容通过 `invoke("update_highlight", {id, note})` 保存

### 高亮渲染（PDF）

每页维护一个 `<svg>` 覆盖在 Canvas 上，从本地缓存读取该页所有高亮的 rects，渲染为半透明 `<rect>`（`fill-opacity: 0.35`）。

---

## 6. AI 功能

### 读前：章节摘要

进入阅读器或切换章节时，右上角提供「章节概览」按钮：

```
invoke("generate_chapter_summary", { sourceId, chapter })
  → Rust 调用 AI API
  → 返回：{outline: [...], keyPoints: [...], readTime: N}
  → 显示在侧边抽屉，可折叠
```

### 读中：即时解释（流式）

```
invoke("stream_ai_explain", { text, context })
  → Rust: POST /chat/completions (stream=true)
  → listen("ai_chunk") 逐步追加
  → listen("ai_done") 完成
```

context 包含：当前书名/文章标题、选中位置前后 200 字。

### 读中：跨笔记关联

选中文字后操作菜单中提供「关联笔记」选项：

```
invoke("search_related_highlights", { text, limit: 5 })
  → sqlite-vec 语义搜索
  → 返回相关高亮列表（含来源书名/文章）
  → 显示在侧边面板，点击可跳转
```

### 读后：论点卡片

阅读完成（进度 > 90%）或手动触发，生成本章/本篇的论点卡片：

```
invoke("generate_note_card", { sourceId, sourceType })
  → AI 综合该来源的所有高亮
  → 生成 NoteCard：{title, content (Markdown), sourceHighlightIds}
  → 存入 note_cards 表
  → 返回卡片，显示确认弹窗
```

---

## 7. 跳回原文

从笔记页点击某条高亮，进入阅读器并定位：

```typescript
// 笔记页跳转
invoke("open_reader", { sourceType, sourceId, highlightId })

// 阅读器初始化时检查 highlightId
// PDF:  scrollToPage(position.page) → 闪烁高亮
// EPUB: rendition.display(position.cfi)
// Article: scrollTo(position.offset) → 高亮文字
```

---

## 8. 阅读进度

```typescript
// 自动记录（防抖 2s）
invoke("update_reading_progress", {
  sourceId: string,
  sourceType: 'book' | 'article',
  progress: number,          // 0~1
  currentPageIndex?: number, // PDF
  currentCfi?: string,       // EPUB
})

// 打开书籍/文章时恢复进度
invoke("get_reading_progress", { sourceId, sourceType })
```

---

## 9. 排版设置

```typescript
interface ReaderSettings {
  fontSize: 14 | 16 | 18 | 20 | 22
  lineHeight: 1.5 | 1.65 | 1.75 | 2.0
  theme: 'day' | 'sepia' | 'night'
}
// day:   bg=#F8F7F4, text=#1A1A1A
// sepia: bg=#F0EBE0, text=#3C3C3C
// night: bg=#1A1A1A, text=#D4D4D4
```

设置存在 Tauri store（持久化），EPUB 通过注入 `<style>` 到 iframe 应用。

---

## 10. 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `→` / `Space` | 下一页 |
| `←` | 上一页 |
| `H` | 激活黄色高亮 |
| `G` | 激活绿色高亮 |
| `B` | 激活蓝色高亮 |
| `F` | 全屏切换 |
| `Esc` | 退出全屏 / 关闭面板 |

---

## 11. Tauri 命令清单

| 命令 | 说明 |
|------|------|
| `get_book_highlights(bookId)` | 获取书籍所有高亮 |
| `get_article_highlights(articleId)` | 获取文章所有高亮 |
| `create_highlight(data)` | 新建高亮 |
| `update_highlight(id, note?, color?)` | 更新批注/颜色 |
| `delete_highlight(id)` | 删除高亮 |
| `get_reading_progress(sourceId, sourceType)` | 获取阅读进度 |
| `update_reading_progress(data)` | 保存阅读进度 |
| `get_reader_settings()` | 获取排版设置 |
| `update_reader_settings(data)` | 保存排版设置 |
| `stream_ai_explain(text, context)` | 流式 AI 解释 |
| `search_related_highlights(text, limit)` | 跨笔记语义关联 |
| `generate_chapter_summary(sourceId, chapter)` | 读前章节摘要 |
| `generate_note_card(sourceId, sourceType)` | 读后论点卡片 |
| `open_reader(sourceType, sourceId, highlightId?)` | 打开阅读器并定位 |
