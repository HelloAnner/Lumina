/**
 * 书籍默认封面图案测试
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  PatternBookCoverArt,
  buildBookCoverArtSpec
} from "@/components/library/book-cover-art"

test("buildBookCoverArtSpec 对相同标题与变体返回稳定图案", () => {
  const left = buildBookCoverArtSpec("第一性原理", 1)
  const right = buildBookCoverArtSpec("第一性原理", 1)

  assert.deepEqual(left, right)
  assert.ok(left.layers.length > 0)
})

test("PatternBookCoverArt 是纯图案封面，不渲染标题文字", () => {
  const markup = renderToStaticMarkup(
    <PatternBookCoverArt title="反脆弱" coverVariant={2} />
  )

  assert.match(markup, /data-cover-motif=/)
  assert.doesNotMatch(markup, /反脆弱/)
})
