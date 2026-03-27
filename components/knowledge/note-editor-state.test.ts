/**
 * 笔记编辑器状态工具测试
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/27
 */
import test from "node:test"
import assert from "node:assert/strict"
import type { NoteBlock } from "@/src/server/store/types"
import {
  buildNoteEditorStats,
  resolveSlashCommandState
} from "@/components/knowledge/note-editor-state"

test("buildNoteEditorStats 会统计块数与字符数", () => {
  const blocks: NoteBlock[] = [
    { id: "p-1", type: "paragraph", text: "abcd", sortOrder: 0 },
    { id: "c-1", type: "code", code: "const x = 1", language: "ts", sortOrder: 1 },
    { id: "d-1", type: "divider", sortOrder: 2 }
  ]

  assert.deepEqual(buildNoteEditorStats(blocks), {
    blockCount: 3,
    charCount: 15
  })
})

test("resolveSlashCommandState 只在当前文本块以 / 开头时返回查询", () => {
  const blocks: NoteBlock[] = [
    { id: "h-1", type: "heading", level: 2, text: "/quo", sortOrder: 0 },
    { id: "p-1", type: "paragraph", text: "普通段落", sortOrder: 1 },
    { id: "q-1", type: "quote", text: "/quote", sortOrder: 2 }
  ]

  assert.deepEqual(resolveSlashCommandState(blocks, "h-1"), {
    blockId: "h-1",
    query: "quo"
  })

  assert.equal(resolveSlashCommandState(blocks, "p-1"), null)
  assert.deepEqual(resolveSlashCommandState(blocks, "q-1"), {
    blockId: "q-1",
    query: "quote"
  })
})
