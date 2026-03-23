/**
 * PDF 元数据解析测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import PDFDocument from "pdfkit"
import { Buffer } from "node:buffer"
import { extractPdfMetadataFromDocument } from "@/src/server/services/books/pdf-metadata"
import { extractPdfMetadata } from "@/src/server/services/books/pdf-metadata"

function createPdfBuffer(lines: string[]) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = []
    const document = new PDFDocument({ margin: 40 })
    document.on("data", (chunk) => chunks.push(chunk))
    document.on("end", () => resolve(Buffer.concat(chunks)))
    document.on("error", reject)
    lines.forEach((line, index) => {
      if (index > 0) {
        document.moveDown()
      }
      document.text(line)
    })
    document.end()
  })
}

test("extractPdfMetadataFromDocument 会提取页数、文本与目录层级", async () => {
  const result = await extractPdfMetadataFromDocument(
    {
      numPages: 3,
      async getMetadata() {
        return {
          info: {
            Title: "深入理解约束",
            Author: "Anner"
          }
        }
      },
      async getOutline() {
        return [
          {
            title: "第一部分",
            dest: "part-1",
            items: [
              {
                title: "第一章 先找约束",
                dest: "chapter-1",
                items: []
              }
            ]
          },
          {
            title: "第二章 拆解系统",
            dest: [{ num: 9, gen: 0 }],
            items: []
          }
        ]
      },
      async getDestination(name: string) {
        if (name === "part-1") {
          return [{ num: 3, gen: 0 }]
        }
        if (name === "chapter-1") {
          return [{ num: 5, gen: 0 }]
        }
        return null
      },
      async getPageIndex(ref: { num: number; gen: number }) {
        if (ref.num === 3) {
          return 0
        }
        if (ref.num === 5) {
          return 1
        }
        if (ref.num === 9) {
          return 2
        }
        return 0
      },
      async getPage(pageNumber: number) {
        return {
          async getTextContent() {
            if (pageNumber === 1) {
              return {
                items: [
                  { str: "第一性原理帮助我们回到真实约束。", hasEOL: true },
                  { str: "不要在未验证的假设上继续堆方案。", hasEOL: true }
                ]
              }
            }
            if (pageNumber === 2) {
              return {
                items: [
                  { str: "第二页继续讨论约束与变量。", hasEOL: true }
                ]
              }
            }
            return {
              items: [
                { str: "第三页讨论拆解系统。", hasEOL: true }
              ]
            }
          }
        }
      }
    },
    "constraints.pdf"
  )

  assert.equal(result.title, "深入理解约束")
  assert.equal(result.author, "Anner")
  assert.equal(result.totalPages, 3)
  assert.equal(result.toc.length, 3)
  assert.deepEqual(
    result.toc.map((item) => ({
      title: item.title,
      pageIndex: item.pageIndex,
      level: item.level
    })),
    [
      { title: "第一部分", pageIndex: 1, level: 0 },
      { title: "第一章 先找约束", pageIndex: 2, level: 1 },
      { title: "第二章 拆解系统", pageIndex: 3, level: 0 }
    ]
  )
  assert.equal(result.sections.length, 3)
  assert.match(result.sections[0].content, /第一性原理帮助我们回到真实约束/)
  assert.match(result.synopsis, /第一性原理帮助我们回到真实约束/)
})

test("extractPdfMetadata 会用真实 PDF.js 解析 PDF 文本", async () => {
  const buffer = await createPdfBuffer([
    "Real PDF parsing should keep native page semantics.",
    "Do not reuse the EPUB text fallback path."
  ])

  const result = await extractPdfMetadata(buffer, "reader.pdf")

  assert.equal(result.format, "PDF")
  assert.equal(result.totalPages, 1)
  assert.match(result.sections[0].content, /Real PDF parsing should keep native page semantics/)
  assert.match(result.synopsis, /Real PDF parsing should keep native page semantics/)
})
