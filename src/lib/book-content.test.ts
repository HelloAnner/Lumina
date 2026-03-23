/**
 * 书籍内容规整工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import { decodeHtmlEntities } from "@/src/lib/html-entities"
import {
  extractReadableTextFromHtml,
  extractStructuredContentFromHtml,
  normalizeStoredSectionContent
} from "@/src/lib/book-content"

test("decodeHtmlEntities 能解码常见 HTML 实体", () => {
  assert.equal(
    decodeHtmlEntities("A&amp;B&nbsp;C&#39;D&lt;E&gt;&quot;F&quot;"),
    `A&B C'D<E>"F"`
  )
})

test("extractReadableTextFromHtml 保留块级结构并解码实体", () => {
  const text = extractReadableTextFromHtml(`
    <h1>运营之光</h1>
    <p>第一段。</p>
    <p>第二段 &amp; 第三段。</p>
    <ul>
      <li>其一</li>
      <li>其二</li>
    </ul>
  `)

  assert.ok(text.startsWith("运营之光\n\n第一段。\n\n第二段 & 第三段。"))
  assert.ok(text.includes("其一"))
  assert.ok(text.includes("其二"))
})

test("normalizeStoredSectionContent 会对中文长段做兜底分段", () => {
  const text = normalizeStoredSectionContent(
    "运营不是聊天。运营不是发帖。运营需要对目标负责。运营需要理解产品和用户。运营需要持续复盘。运营需要把动作沉淀成方法。"
  )

  assert.match(text, /\n\n/)
  assert.ok(text.includes("运营不是聊天。"))
  assert.ok(text.includes("运营需要把动作沉淀成方法。"))
})

test("extractStructuredContentFromHtml 会保留图片块与前后文本顺序", () => {
  const result = extractStructuredContentFromHtml(`
    <p>第一段</p>
    <figure>
      <img src="../images/demo.png" alt="示意图" width="640" height="360" />
      <figcaption>图 1 说明</figcaption>
    </figure>
    <p>第二段</p>
  `)

  assert.equal(result.content, "第一段\n\n图 1 说明\n\n第二段")
  assert.deepEqual(result.blocks, [
    {
      type: "paragraph",
      text: "第一段"
    },
    {
      type: "image",
      src: "../images/demo.png",
      alt: "示意图",
      width: 640,
      height: 360
    },
    {
      type: "paragraph",
      text: "图 1 说明"
    },
    {
      type: "paragraph",
      text: "第二段"
    }
  ])
})
