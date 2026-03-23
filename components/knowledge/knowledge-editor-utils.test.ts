/**
 * 知识库笔记编辑器工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  applyInlineMarkdown,
  applyLinePrefixMarkdown,
  buildKnowledgeEditorStats,
  mapScrollTopByRatio
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
