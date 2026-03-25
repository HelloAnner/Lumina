# 高亮定位协议专题

> 来源：`docs/2026-03-23-lumina-enterprise-system-solution.md` 的定位专项拆分  
> 日期：2026-03-23

## 1. 目标

保证以下场景都能稳定定位到原文：

- 阅读器内点击右侧划线
- 知识库文章引用块回跳
- 刷新后恢复高亮位置
- 内容规整升级后尽量不丢失历史定位

## 2. 定位优先级

```text
L1 结构化强定位
  EPUB: cfiRange / chapterHref
  PDF: pageIndex / rects

L2 半结构定位
  paragraphIndex
  paraOffsetStart / paraOffsetEnd

L3 文本兜底
  contentSnapshot
  decodeHtmlEntities(contentSnapshot)
```

## 3. 当前统一模型

```ts
interface HighlightLocator {
  format: "PDF" | "EPUB"
  pageIndex?: number
  chapterHref?: string
  cfiRange?: string
  paraOffsetStart?: number
  paraOffsetEnd?: number
  content: string
}
```

## 4. 当前仓库已实现

- 高亮创建时记录 `pageIndex`
- EPUB 高亮创建时补存 `chapterHref`
- 定位时优先使用 `chapterHref`
- 偏移失败时回退到文本匹配
- 文本匹配前先做 HTML 实体解码

## 5. 后续演进

1. 加入 `paragraphIndex`
2. EPUB 接入 `cfiRange`
3. PDF 接入 text layer rects
4. 知识库引用块统一使用 Locator 对象
