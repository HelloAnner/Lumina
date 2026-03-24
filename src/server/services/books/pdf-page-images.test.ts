/**
 * PDF 页图快照工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  buildPdfPageImageProxyPath,
  mergePdfPageImageBlock
} from "@/src/server/services/books/pdf-page-images"

test("buildPdfPageImageProxyPath 返回稳定的同源页图路径", () => {
  assert.equal(buildPdfPageImageProxyPath("book-1", 3), "/api/books/book-1/page-images/3")
})

test("mergePdfPageImageBlock 会保留段落并追加页图块", () => {
  const section = mergePdfPageImageBlock(
    {
      id: "section-1",
      title: "第 3 页",
      pageIndex: 3,
      content: "第一段。\n\n第二段。"
    },
    "book-1"
  )

  assert.deepEqual(section.blocks, [
    { type: "paragraph", text: "第一段。" },
    { type: "paragraph", text: "第二段。" },
    {
      type: "image",
      src: "/api/books/book-1/page-images/3",
      alt: "第 3 页版面图"
    }
  ])
})

test("mergePdfPageImageBlock 遇到已有同页快照时不会重复追加", () => {
  const section = mergePdfPageImageBlock(
    {
      id: "section-1",
      title: "第 3 页",
      pageIndex: 3,
      content: "第一段。",
      blocks: [
        { type: "paragraph", text: "第一段。" },
        {
          type: "image",
          src: "/api/books/book-1/page-images/3",
          alt: "第 3 页版面图"
        }
      ]
    },
    "book-1"
  )

  assert.equal(section.blocks?.length, 2)
})
