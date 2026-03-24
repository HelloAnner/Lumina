/**
 * 知识库笔记编辑器工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  applyInlineMarkdown,
  applyLinePrefixMarkdown,
  buildKnowledgeSaveRequest,
  buildKnowledgeEditorStats,
  mapScrollTopByRatio,
  renderKnowledgeMarkdown
} from "@/components/knowledge/knowledge-editor-utils"

test("buildKnowledgeEditorStats 会统计字符数、行数与近似词数", () => {
  const stats = buildKnowledgeEditorStats("第一行内容\nsecond line words")

  assert.equal(stats.lines, 2)
  assert.equal(stats.characters, 23)
  assert.equal(stats.words, 4)
})

test("applyInlineMarkdown 会包裹选中文本", () => {
  const result = applyInlineMarkdown("hello world", 0, 5, "**", "**", "重点")

  assert.equal(result.text, "**hello** world")
  assert.equal(result.selectionStart, 2)
  assert.equal(result.selectionEnd, 7)
})

test("applyInlineMarkdown 在无选中时会插入占位文本", () => {
  const result = applyInlineMarkdown("", 0, 0, "`", "`", "代码")

  assert.equal(result.text, "`代码`")
  assert.equal(result.selectionStart, 1)
  assert.equal(result.selectionEnd, 3)
})

test("applyLinePrefixMarkdown 会给每一行增加前缀", () => {
  const result = applyLinePrefixMarkdown("一\n二", 0, 3, "- ", "列表项")

  assert.equal(result.text, "- 一\n- 二")
})

test("mapScrollTopByRatio 会按比例映射滚动位置", () => {
  const mapped = mapScrollTopByRatio({
    sourceScrollTop: 120,
    sourceScrollHeight: 600,
    sourceClientHeight: 300,
    targetScrollHeight: 1000,
    targetClientHeight: 400
  })

  assert.equal(mapped, 240)
})

test("renderKnowledgeMarkdown 会将连续列表渲染为单个列表容器", () => {
  const html = renderKnowledgeMarkdown("- 第一项\n- 第二项\n\n1. 有序一\n2. 有序二")

  assert.equal(
    html,
    "<ul><li>第一项</li><li>第二项</li></ul><p class=\"empty-paragraph\"><br></p><ol><li>有序一</li><li>有序二</li></ol>"
  )
})

test("renderKnowledgeMarkdown 会转义代码块与行内 HTML", () => {
  const html = renderKnowledgeMarkdown("```ts\nconst value = '<div>'\n```\n\n**强调** 与 `<script>`")

  assert.equal(
    html,
    "<pre class=\"code-block\" data-lang=\"ts\"><code>const value = &#39;&lt;div&gt;&#39;</code></pre><p class=\"empty-paragraph\"><br></p><p><strong>强调</strong> 与 <code>&lt;script&gt;</code></p>"
  )
})

test("buildKnowledgeSaveRequest 仅在内容变更时返回保存请求", () => {
  assert.equal(
    buildKnowledgeSaveRequest(undefined, "新内容", "旧内容"),
    null
  )

  assert.equal(
    buildKnowledgeSaveRequest("vp-1", "旧内容", "旧内容"),
    null
  )

  assert.deepEqual(
    buildKnowledgeSaveRequest("vp-1", "新内容", "旧内容"),
    {
      viewpointId: "vp-1",
      articleContent: "新内容"
    }
  )
})
