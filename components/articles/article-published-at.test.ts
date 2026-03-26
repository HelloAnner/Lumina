/**
 * 文章发布时间文案测试
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  formatArticlePublishedAt,
  formatArticlePublishedAtSummary
} from "./article-published-at"

test("formatArticlePublishedAt 将 ISO 时间格式化为阅读页标题文案", () => {
  assert.equal(
    formatArticlePublishedAt("2026-03-24T06:30:00.000Z"),
    "发布于 2026-03-24"
  )
})

test("formatArticlePublishedAt 遇到非法时间返回空串", () => {
  assert.equal(formatArticlePublishedAt("not-a-date"), "")
})

test("formatArticlePublishedAtSummary 在 7 天内显示相对时间", () => {
  assert.equal(
    formatArticlePublishedAtSummary(
      "2026-03-24T06:30:00.000Z",
      new Date("2026-03-24T08:00:00.000Z").getTime()
    ),
    "1h ago"
  )
})

test("formatArticlePublishedAtSummary 超过 7 天显示绝对日期", () => {
  assert.equal(
    formatArticlePublishedAtSummary(
      "2026-03-01T06:30:00.000Z",
      new Date("2026-03-24T08:00:00.000Z").getTime()
    ),
    "2026-03-01"
  )
})
