# 模块 03：阅读器（reader）

> 阶段：001
> 对应 PRD：§三.1 阅读页（划线/高亮、批注、进度、排版设置、键盘快捷键）
> 对应 Tech：§二.2~2.4、§三划线与批注、§三.1~3.4

---

## 1. 模块职责

- PDF 阅读器（PDF.js Web Worker 模式 + 虚拟列表）
- EPUB 阅读器（epub.js + iframe 章节隔离）
- 阅读进度自动记录与同步
- 多色高亮划线（4 色）+ 操作菜单
- 划线批注（附加文字）
- 排版设置（字体大小、行距、背景色主题）
- 键盘快捷键
- IndexedDB 本地缓存（乐观写入，后台同步）
- 跳回原文入口（URL 参数定位）

---

## 2. 阅读器页面布局

```
┌──────────────────────────────────────────────────────────────┐
│  ← 返回书架   书名                    设置⚙  全屏⛶           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                   [渲染区域]                                  │
│                 PDF: Canvas + TextLayer                      │
│                 EPUB: iframe                                  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  第 N 页 / 共 M 页          进度滑块         章节名           │
└──────────────────────────────────────────────────────────────┘

右侧浮层（选中文字时出现）：
┌────────────────────────────────────┐
│  🟡  🟢  🔵  🩷  │  ✏️批注  │  🤖解释 │
└────────────────────────────────────┘

右侧面板（点击 AI 解释时展开）：
┌──────────────┐
│  AI 解释结果  │
│  流式输出...  │
└──────────────┘
```

---

## 3. PDF 阅读器

### 3.1 渲染架构

```
每页三层叠加（z-index 递增）：
- Canvas 层：页面图像（PDF.js 渲染）
- TextLayer：透明，用于文字选中
- HighlightLayer：SVG，绘制半透明高亮框
```

### 3.2 虚拟列表策略

- 仅渲染可视区域 ±2 页
- 滚动到某页时异步加载 Canvas
- 减少 DOM 节点数，保持流畅

### 3.3 Web Worker

PDF.js 渲染放在 Web Worker 中，主线程只负责接收渲染结果和处理交互。

---

## 4. EPUB 阅读器

- `epub.js` 加载文件，解析 spine（章节列表）
- 每章节在独立 `<iframe>` 中渲染（样式隔离）
- 向 iframe 注入自定义 CSS（排版设置）
- 向 iframe 注入划线脚本（监听 `mouseup` 事件）

---

## 5. 划线与批注

### 5.1 划线数据模型

```typescript
// PDF 划线
interface PdfHighlight {
  format: 'PDF'
  pageIndex: number
  paraOffsetStart: number
  paraOffsetEnd: number
  rects: DOMRect[]       // 用于渲染高亮框
  content: string
}

// EPUB 划线
interface EpubHighlight {
  format: 'EPUB'
  cfiRange: string       // epub.js CFI 精确定位
  chapterHref: string
  content: string
}

// 颜色
type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'
// 对应: #FBBF24 | #34D399 | #60A5FA | #F472B6
```

### 5.2 划线操作流程

```
用户选中文字（mouseup）
        │
        ▼
getSelection() → Range 对象
        │
        ├─ PDF：TextLayer 计算 pageIndex + paraOffset + clientRects
        └─ EPUB：epub.js CFIGenerator.generate(range)
        │
        ▼
弹出操作菜单（跟随选区位置的浮动 Popover）
        │
        ├─ 点击颜色 → 立即渲染高亮（IndexedDB 本地写入）
        │             异步 POST /api/highlights（不阻塞 UI）
        ├─ 点击批注 → 弹出文本输入框，输入后更新 note 字段
        └─ 点击解释 → 调用 AI 即时解释模块（SSE 流式）
```

### 5.3 高亮渲染（PDF）

- 每页维护一个 `<svg>` 覆盖在 Canvas 上
- 从 IndexedDB 读取该页所有划线的 rects
- 渲染为半透明 `<rect>`（`fill-opacity: 0.35`）

### 5.4 IndexedDB 本地缓存

划线数据同时写入 IndexedDB（`db: lumina`，`store: highlights`），避免：
- 网络延迟导致高亮消失
- 离线场景下划线丢失

后台定时同步未上传的划线。

---

## 6. 跳回原文

```typescript
// 知识库文章中引用块携带的定位数据
interface QuoteBlock {
  highlightId: string
  bookId: string
  format: 'PDF' | 'EPUB'
  pageIndex?: number      // PDF
  cfiRange?: string       // EPUB
}

// 跳转逻辑：新标签页打开阅读器，URL 携带定位参数
const url = `/reader/${bookId}?highlight=${highlightId}`

// 阅读器初始化时：
// PDF:  scrollToPage(pageIndex) + 闪烁高亮效果
// EPUB: book.rendition.display(cfiRange)
```

---

## 7. 阅读进度

```typescript
// 自动记录（防抖 2 秒）
PUT /api/books/:id/progress
Body: { progress: number }  // 0~1

// PDF: 当前页 / 总页数
// EPUB: 当前位置 / 总字数（epub.js locations）
```

---

## 8. 排版设置

```typescript
interface ReaderSettings {
  fontSize: 14 | 16 | 18 | 20 | 22  // px
  lineHeight: 1.5 | 1.6 | 1.75 | 2.0
  fontFamily: 'system' | 'serif' | 'sans'
  theme: 'day' | 'sepia' | 'night'
  // day:   bg=#FFFFFF, text=#1A1A1A
  // sepia: bg=#F5F0E8, text=#3C3C3C
  // night: bg=#1A1A1A, text=#D4D4D4
}
```

- 设置存 `localStorage`，同时同步到后端 `user_reader_settings` 表
- EPUB：注入 `<style>` 到 iframe
- PDF：Canvas 背景色 + CSS filter

---

## 9. 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `→` / `Space` | 下一页 |
| `←` | 上一页 |
| `H` | 激活黄色高亮 |
| `G` | 激活绿色高亮 |
| `B` | 激活蓝色高亮 |
| `F` | 全屏切换 |
| `Esc` | 退出全屏 / 关闭面板 |
| `/` | 搜索 |
| `Cmd+B` | 添加书签 |

实现：`useEffect` 中注册全局 `keydown` 监听，阅读器页面挂载时激活。

---

## 10. API 清单

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/books/:id/progress` | 获取阅读进度 |
| PUT | `/api/books/:id/progress` | 更新阅读进度 |
| GET | `/api/books/:id/highlights` | 获取该书所有划线 |
| POST | `/api/highlights` | 新建划线 |
| PUT | `/api/highlights/:id` | 更新批注/颜色 |
| DELETE | `/api/highlights/:id` | 删除划线 |
| GET | `/api/reader-settings` | 获取阅读设置 |
| PUT | `/api/reader-settings` | 保存阅读设置 |

---

## 11. 验收标准

- [ ] 打开 PDF，页面正常渲染，虚拟列表滚动流畅
- [ ] 打开 EPUB，章节切换正常
- [ ] 选中文字，操作菜单出现；点击颜色，高亮立即渲染
- [ ] 刷新页面，划线高亮持久化（IndexedDB + 后端均有记录）
- [ ] 批注保存后，悬浮高亮显示批注内容
- [ ] 排版设置变更后，阅读区立即响应
- [ ] 翻页快捷键正常；`F` 键全屏切换正常
- [ ] 从知识库引用块跳转，阅读器定位到指定位置并闪烁高亮
