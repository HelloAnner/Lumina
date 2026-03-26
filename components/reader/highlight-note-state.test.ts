/**
 * 划线想法编辑态测试
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import type { Highlight } from "@/src/server/store/types"
import { buildHighlightNoteState } from "./highlight-note-state"

test("buildHighlightNoteState 将已有划线转换为想法弹窗默认态", () => {
  const highlight: Highlight = {
    id: "hl-1",
    userId: "user-1",
    bookId: "book-1",
    format: "EPUB",
    contentMode: "original",
    pageIndex: 1,
    content: "A calm sentence",
    note: "已有想法",
    color: "yellow",
    status: "PENDING",
    createdAt: "2026-03-26T00:00:00.000Z"
  }

  const state = buildHighlightNoteState(highlight)

  assert.equal(state.editingHighlightId, "hl-1")
  assert.equal(state.selectedText, "A calm sentence")
  assert.equal(state.noteDraft, "已有想法")
})
