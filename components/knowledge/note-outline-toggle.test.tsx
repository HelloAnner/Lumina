/**
 * 笔记目录切换按钮测试
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NoteOutlineToggle } from "@/components/knowledge/note-outline-toggle"

test("NoteOutlineToggle 在目录展开时只显示图标并保留收起语义", () => {
  const markup = renderToStaticMarkup(
    <NoteOutlineToggle collapsed={false} onToggle={() => undefined} />
  )

  assert.match(markup, /aria-label="收起目录"/)
  assert.match(markup, /title="收起目录"/)
  assert.doesNotMatch(markup, />收起目录</)
  assert.doesNotMatch(markup, />展开目录</)
})

test("NoteOutlineToggle 在目录收起时只显示图标并保留展开语义", () => {
  const markup = renderToStaticMarkup(
    <NoteOutlineToggle collapsed onToggle={() => undefined} />
  )

  assert.match(markup, /aria-label="展开目录"/)
  assert.match(markup, /title="展开目录"/)
  assert.doesNotMatch(markup, />收起目录</)
  assert.doesNotMatch(markup, />展开目录</)
})
