# 解析性能优化 & 阅读器 UX 快速提升

## 1. 目标

优化 PDF/EPUB 解析性能瓶颈，补全阅读器已定义但未实现的 UX 功能。

## 2. PDF 解析优化

### 2.1 页面提取并行化

`pdf-metadata.ts` 中逐页 `await extractPageContent` 改为 `Promise.all` 批量并行，按 pageNumber 排序组装 sections。

### 2.2 大纲解析并行化

`appendOutlineNodes` 对同级节点逐个 await，改为同级 `Promise.all`，维护插入顺序。

### 2.3 消除重复文档解析

`pdf-page-images.ts` 对同一 buffer 再次调用 `getDocument()`，改为接收已解析的 `PDFDocumentProxy` 参数。

### 2.4 页面图片渲染有限并发

逐页 render + upload 改为每批 4 页 `Promise.all`。

### 2.5 滚动定位优化

`findCurrentPdfPageIndex` 从 O(n) 全遍历改为从 currentIndex 附近 ±2 页探测。

### 2.6 pdfjs import 提升

`PdfPageView` 每次渲染都 dynamic import，提升到模块级别仅导入一次。

## 3. EPUB 优化（可选）

对超过 100KB 的图片上传 MinIO 替换为 URL 引用，小图保持 base64 内联，减少内存峰值。

## 4. 阅读器 UX 提升

### 4.1 高亮颜色选择器

划词工具栏从单色扩展为 4 色圆点 + 笔记按钮，`onHighlight` 签名改为接收 `HighlightColor`。

### 4.2 Sepia 阅读主题

`ReaderTheme` 已有 `"sepia"` 定义，补充 `.sepia` CSS 变量（暖黄调背景 + 深棕文字）。阅读器内部独立管理 reader theme class。

### 4.3 字体家族选择

字体面板增加 system / serif / sans 三选按钮，控制器暴露 `fontFamily` 状态，正文容器映射对应字体栈。

### 4.4 快捷键提示

按 `?` 键触发底部提示条，显示 1-4 高亮色 + N 笔记快捷键。

## 5. 涉及文件

| 文件 | 改动 |
|---|---|
| `src/server/services/books/pdf-metadata.ts` | 并行页面提取 + 并行大纲解析 |
| `src/server/services/books/pdf-page-images.ts` | 接收已解析 pdf 对象 + 有限并发渲染 |
| `components/reader/pdf-reader-utils.ts` | 滚动定位优化 |
| `components/reader/pdf-page-view.tsx` | import 提升 |
| `components/reader/reader-selection-toolbar.tsx` | 4 色高亮选择器 |
| `components/reader/reader-font-panel.tsx` | 字体家族选择 |
| `components/reader/use-reader-shortcuts.ts` | `?` 快捷键提示 |
| `components/articles/article-reader-client.tsx` | sepia class + 快捷键提示渲染 |
| `components/articles/use-article-reader-controller.tsx` | fontFamily + readerTheme 状态 |
| `components/articles/article-reader-content.tsx` | fontFamily style |
| `app/globals.css` | `.sepia` 主题变量 |
