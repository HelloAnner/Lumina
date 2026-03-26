/**
 * 文章翻译内容工具测试
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  buildArticleSourceHash,
  buildNormalizedTranslatedArticleSections
} from "@/src/server/services/translation/article-content"
import type { ArticleSection } from "@/src/server/store/types"

test("buildArticleSourceHash 在图片变更时应变化", () => {
  const base: ArticleSection[] = [
    { id: "p1", type: "paragraph", text: "A" }
  ]
  const withImage: ArticleSection[] = [
    { id: "p1", type: "paragraph", text: "A" },
    { id: "i1", type: "image", src: "/a.png", alt: "A" }
  ]

  assert.notEqual(buildArticleSourceHash(base), buildArticleSourceHash(withImage))
})

test("buildNormalizedTranslatedArticleSections 会把旧缓存译文重新贴回原文结构并保留图片", () => {
  const original: ArticleSection[] = [
    { id: "p1", type: "paragraph", text: "Hello" },
    { id: "i1", type: "image", src: "/a.png", alt: "A" },
    { id: "p2", type: "paragraph", text: "World" }
  ]
  const legacyTranslated: ArticleSection[] = [
    { id: "tp1", type: "paragraph", text: "你好" },
    { id: "tp2", type: "paragraph", text: "世界" }
  ]

  const result = buildNormalizedTranslatedArticleSections(original, legacyTranslated)

  assert.equal(result.length, 3)
  assert.equal(result[0]?.type, "paragraph")
  assert.equal(result[0]?.text, "你好")
  assert.equal(result[1]?.type, "image")
  assert.equal(result[1]?.src, "/a.png")
  assert.equal(result[2]?.type, "paragraph")
  assert.equal(result[2]?.text, "世界")
})
