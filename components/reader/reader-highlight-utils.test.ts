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
