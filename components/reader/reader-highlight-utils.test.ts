/**
 * 阅读器高亮定位工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  buildTextHighlightPayload,
  buildParagraphLayouts,
  buildParagraphSegments,
  resolveBookHighlightAnchor
} from "@/components/reader/reader-highlight-utils"

test("resolveBookHighlightAnchor 优先使用已存储偏移量定位段落", () => {
  const anchor = resolveBookHighlightAnchor(
    [
      {
        pageIndex: 3,
        content: "第一段。\n\n第二段有重点句子。\n\n第三段。"
      }
    ],
    {
      content: "重点句子",
      pageIndex: 3,
      paraOffsetStart: 10,
      paraOffsetEnd: 14
    }
  )

  assert.deepEqual(anchor, {
    sectionIndex: 0,
    paragraphIndex: 1,
    start: 10,
    end: 14
  })
})

test("resolveBookHighlightAnchor 在缺少偏移量时回退到正文检索", () => {
  const anchor = resolveBookHighlightAnchor(
    [
      {
        pageIndex: 8,
        content: "先有一段铺垫。\n\n这里出现目标句子。\n\n收尾。"
      }
    ],
    {
      content: "目标句子",
      pageIndex: 8
    }
  )

  assert.deepEqual(anchor, {
    sectionIndex: 0,
    paragraphIndex: 1,
    start: 13,
    end: 17
  })
})

test("resolveBookHighlightAnchor 支持按 chapterHref 回退定位", () => {
  const anchor = resolveBookHighlightAnchor(
    [
      {
        pageIndex: 1,
        href: "chapter-1",
        content: "前言。"
      },
      {
        pageIndex: 2,
        href: "chapter-2",
        content: "这里是第二章正文。\n\n运营方法在这里展开。"
      }
    ],
    {
      content: "运营方法在这里展开。",
      chapterHref: "chapter-2"
    }
  )

  assert.deepEqual(anchor, {
    sectionIndex: 1,
    paragraphIndex: 1,
    start: 11,
    end: 21
  })
})

test("buildParagraphSegments 会把命中的正文切成高亮片段", () => {
  const [, secondParagraph] = buildParagraphLayouts("这是第一段。\n\n这里出现目标句子。")
  const segments = buildParagraphSegments(secondParagraph.text, secondParagraph.start, [
    {
      id: "h-1",
      color: "yellow",
      start: 12,
      end: 16
    }
  ])

  assert.deepEqual(segments, [
    { text: "这里出现", activeHighlightId: null, color: null },
    { text: "目标句子", activeHighlightId: "h-1", color: "yellow" },
    { text: "。", activeHighlightId: null, color: null }
  ])
})

test("buildTextHighlightPayload 为 EPUB 保留 chapterHref", () => {
  const payload = buildTextHighlightPayload({
    bookId: "book-1",
    format: "EPUB",
    sections: [
      { pageIndex: 3, href: "chapter-3", content: "第一段。\n\n第二段。" }
    ],
    selectedSectionIndex: 0,
    fallbackSection: { pageIndex: 3, href: "chapter-3", content: "第一段。\n\n第二段。" },
    selectedText: "第二段",
    selectedRange: { start: 5, end: 8 },
    color: "yellow",
    note: "记一下"
  })

  assert.deepEqual(payload, {
    bookId: "book-1",
    format: "EPUB",
    pageIndex: 3,
    chapterHref: "chapter-3",
    paraOffsetStart: 5,
    paraOffsetEnd: 8,
    content: "第二段",
    note: "记一下",
    color: "yellow"
  })
})

test("buildTextHighlightPayload 为 PDF 只保留文本锚点", () => {
  const payload = buildTextHighlightPayload({
    bookId: "book-2",
    format: "PDF",
    sections: [
      { pageIndex: 9, content: "第一页。\n\n第二页重点。" }
    ],
    selectedSectionIndex: 0,
    fallbackSection: { pageIndex: 9, content: "第一页。\n\n第二页重点。" },
    selectedText: "重点",
    selectedRange: { start: 8, end: 10 },
    color: "blue"
  })

  assert.deepEqual(payload, {
    bookId: "book-2",
    format: "PDF",
    pageIndex: 9,
    chapterHref: undefined,
    paraOffsetStart: 8,
    paraOffsetEnd: 10,
    content: "重点",
    note: undefined,
    color: "blue"
  })
})
