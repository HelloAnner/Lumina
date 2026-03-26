/**
 * 文章大纲工具测试
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import type { ArticleSection } from "@/src/server/store/types"
import { buildArticleOutlineEntries } from "@/components/articles/article-outline-utils"

test("buildArticleOutlineEntries 优先使用文章中的 heading 块", () => {
  const sections: ArticleSection[] = [
    { id: "h1", type: "heading", level: 1, text: "引言" },
    { id: "p1", type: "paragraph", text: "正文" },
    { id: "h2", type: "heading", level: 2, text: "为什么重要" }
  ]

  assert.deepEqual(buildArticleOutlineEntries(sections), [
    { index: 0, title: "引言", level: 1 },
    { index: 2, title: "为什么重要", level: 2 }
  ])
})

test("buildArticleOutlineEntries 在没有 heading 时从关键段落生成大纲", () => {
  const sections: ArticleSection[] = [
    { id: "p1", type: "paragraph", text: "人工智能革命不是某个单点突破，而是一系列能力叠加后进入拐点的结果。" },
    { id: "p2", type: "paragraph", text: "如果只盯着眼前的产品体验，很容易低估底层模型、算力和数据飞轮的共同作用。" },
    { id: "p3", type: "paragraph", text: "更重要的是，这种变化不是线性的，它会在相当长时间里表现得平静，然后突然加速。" }
  ]

  const result = buildArticleOutlineEntries(sections)

  assert.equal(result.length, 3)
  assert.equal(result[0]?.index, 0)
  assert.equal(result[0]?.level, 1)
  assert.match(result[0]?.title ?? "", /人工智能革命/)
})

test("buildArticleOutlineEntries 会裁剪过长标题并保留可读性", () => {
  const sections: ArticleSection[] = [
    {
      id: "p1",
      type: "paragraph",
      text: "这是一段非常长的说明文字，它会被当作大纲标题来源，但最终应该被裁剪成更容易浏览的短句，而不是整段原样塞进去。"
    }
  ]

  const result = buildArticleOutlineEntries(sections)

  assert.equal(result.length, 1)
  assert.ok((result[0]?.title.length ?? 0) <= 26)
})
