/**
 * 文章正文提取测试
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import { extractFromHtml } from "@/src/server/services/scout/content-extractor"

test("extractFromHtml 保留正文中的图片并尽量维持原始位置", () => {
  const html = `
    <html>
      <body>
        <article>
          <h1>AI Revolution</h1>
          <p>第一段。</p>
          <p><img src="/images/ai.png" alt="AI 图示" /></p>
          <p>第二段。</p>
        </article>
      </body>
    </html>
  `

  const result = extractFromHtml(html, "https://waitbutwhy.com/post")

  assert.ok(result)
  assert.equal(result?.content[0]?.type, "heading")
  assert.equal(result?.content[1]?.type, "paragraph")
  assert.equal(result?.content[2]?.type, "image")
  assert.equal(result?.content[2]?.src, "https://waitbutwhy.com/images/ai.png")
  assert.equal(result?.content[3]?.type, "paragraph")
})

test("extractFromHtml 支持从 srcset 中提取图片地址", () => {
  const html = `
    <html>
      <body>
        <article>
          <p>开始。</p>
          <img
            srcset="https://cdn.example.com/small.png 300w, https://cdn.example.com/large.png 1200w"
            alt="图表"
          />
          <p>结束。</p>
        </article>
      </body>
    </html>
  `

  const result = extractFromHtml(html, "https://example.com/post")
  const image = result?.content.find((item) => item.type === "image")

  assert.ok(image)
  assert.equal(image?.src, "https://cdn.example.com/large.png")
})

test("extractFromHtml 解析网页发布时间元数据", () => {
  const html = `
    <html>
      <head>
        <meta property="article:published_time" content="2026-03-24T06:30:00Z" />
      </head>
      <body>
        <article>
          <h1>Why calm products matter</h1>
          <p>Thoughtful software needs rhythm.</p>
          <p>Second paragraph to satisfy readability threshold.</p>
          <p>Third paragraph to keep the article body intact.</p>
        </article>
      </body>
    </html>
  `

  const result = extractFromHtml(html, "https://example.com/post")

  assert.ok(result)
  assert.equal(result?.publishedAt, "2026-03-24T06:30:00.000Z")
})
