/**
 * 笔记块悬浮操作测试
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NoteBlockHoverActions } from "@/components/knowledge/note-block-hover-actions"

test("NoteBlockHoverActions 会渲染删除按钮", () => {
  const markup = renderToStaticMarkup(
    <NoteBlockHoverActions
      top={18}
      onOpenInsert={() => undefined}
      onOpenMenu={() => undefined}
      onDelete={() => undefined}
      onDragStart={() => undefined}
    />
  )

  assert.match(markup, /title="删除块"/)
})
