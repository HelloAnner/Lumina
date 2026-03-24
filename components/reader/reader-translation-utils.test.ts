/**
 * 阅读器翻译预取工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import test from "node:test"
import assert from "node:assert/strict"
import { buildDisplayToc, buildTranslationPrefetchPlan } from "./reader-translation-utils"

test("buildTranslationPrefetchPlan 会优先翻译当前页并预取后续三页", () => {
  const plan = buildTranslationPrefetchPlan({
    currentIndex: 2,
    totalSections: 8,
    cachedIndexes: [],
    busyIndexes: []
  })

  assert.deepEqual(plan, {
    urgentSectionIndexes: [2],
    queuedSectionIndexes: [3, 4, 5],
    requestedSectionIndexes: [2, 3, 4, 5]
  })
})

test("buildTranslationPrefetchPlan 会跳过已缓存与请求中的页", () => {
  const plan = buildTranslationPrefetchPlan({
    currentIndex: 1,
    totalSections: 6,
    cachedIndexes: [1, 2],
    busyIndexes: [3]
  })

  assert.deepEqual(plan, {
    urgentSectionIndexes: [],
    queuedSectionIndexes: [4],
    requestedSectionIndexes: [4]
  })
})

test("buildTranslationPrefetchPlan 会在末尾页正确截断范围", () => {
  const plan = buildTranslationPrefetchPlan({
    currentIndex: 4,
    totalSections: 6,
    cachedIndexes: [],
    busyIndexes: []
  })

  assert.deepEqual(plan, {
    urgentSectionIndexes: [4],
    queuedSectionIndexes: [5],
    requestedSectionIndexes: [4, 5]
  })
})

test("buildDisplayToc 会在译文模式下优先展示目录译文", () => {
  const toc = [
    { id: "toc-1", title: "Chapter One", pageIndex: 1 },
    { id: "toc-2", title: "Chapter Two", pageIndex: 2 }
  ]

  const translated = buildDisplayToc(
    toc,
    {
      items: [
        { id: "toc-1", title: "第一章" },
        { id: "toc-2", title: "第二章" }
      ]
    },
    "translation"
  )

  assert.deepEqual(translated.map((item) => item.title), ["第一章", "第二章"])
})
