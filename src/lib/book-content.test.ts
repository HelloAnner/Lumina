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
  buildFallbackParagraphBlocksFromContent,
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

test("normalizeStoredSectionContent 保留完整段落不做句级拆分", () => {
  const text = normalizeStoredSectionContent(
    "运营不是聊天。运营不是发帖。运营需要对目标负责。运营需要理解产品和用户。运营需要持续复盘。运营需要把动作沉淀成方法。"
  )

  assert.equal(
    text,
    "运营不是聊天。运营不是发帖。运营需要对目标负责。运营需要理解产品和用户。运营需要持续复盘。运营需要把动作沉淀成方法。"
  )
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

test("normalizeStoredSectionContent 会把章节标题与正文拆开", () => {
  const input = [
    "第1章 运营是什么",
    "很多运营从业者之所以会迷茫的很大一个原因，就是互联网公司内的运营岗位和运营工作的职责是高度不标准的。",
    '在互联网行业中，\u201c运营\u201d这个职能的诞生，来源于互联网时代的产品价值构成发生的部分改变。',
    "产品负责界定和提供长期用户价值，运营负责创造短期用户价值+协助产品完善长期价值。"
  ].join(" ")
  const text = normalizeStoredSectionContent(input)

  assert.match(text, /第1章 运营是什么\n\n/)
  // 正文保持完整，不再按句拆分
  assert.ok(!text.includes("部分改变。\n\n产品负责界定"))
})

test("normalizeStoredSectionContent 会把版权元数据字段拆成多段", () => {
  const text = normalizeStoredSectionContent(
    "版权信息 书名：运营之光：我的互联网运营方法论与自白2.0 作者：黄有璨 出版社：电子工业出版社 ISBN：978-7-121-31154-3 定价：99.00 版权所有·侵权必究"
  )

  assert.match(text, /版权信息\n\n书名：运营之光：我的互联网运营方法论与自白2.0/)
  assert.match(text, /作者：黄有璨\n\n出版社：电子工业出版社/)
  assert.match(text, /ISBN：978-7-121-31154-3\n\n定价：99.00\n\n版权所有·侵权必究/)
})

test("buildFallbackParagraphBlocksFromContent 会为旧 EPUB 生成段落块", () => {
  const input = [
    "第1章 运营是什么",
    "很多运营从业者之所以会迷茫。",
    '在互联网行业中，\u201c运营\u201d这个职能的诞生。',
    "产品负责界定和提供长期用户价值。"
  ].join(" ")
  const blocks = buildFallbackParagraphBlocksFromContent(input)

  const first = blocks[0]
  const second = blocks[1]
  assert.equal(first.type, "paragraph")
  assert.equal(first.type === "paragraph" ? first.text : "", "第1章 运营是什么")
  assert.equal(blocks.length, 2)
  assert.ok(second.type === "paragraph" && second.text.startsWith("很多运营从业者"))
  assert.ok(second.type === "paragraph" && second.text.includes("产品负责界定和提供长期用户价值。"))
})
