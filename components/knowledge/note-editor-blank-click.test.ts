import test from "node:test"
import assert from "node:assert/strict"
import type { NoteBlock } from "@/src/server/store/types"
import {
  resolveBlankAreaClick,
  resolveBlankLineCountFromGap
} from "@/components/knowledge/note-editor-blank-click"

test("resolveBlankLineCountFromGap 会按点击高度换算出对应空行数", () => {
  assert.equal(resolveBlankLineCountFromGap(0), 0)
  assert.equal(resolveBlankLineCountFromGap(1), 1)
  assert.equal(resolveBlankLineCountFromGap(27), 1)
  assert.equal(resolveBlankLineCountFromGap(28), 2)
  assert.equal(resolveBlankLineCountFromGap(56), 3)
})

test("resolveBlankAreaClick 在未要求新增空行且末尾已有空段落时复用该段落", () => {
  const blocks: NoteBlock[] = [
    { id: "heading-1", type: "heading", level: 1, text: "定位", sortOrder: 0 },
    { id: "paragraph-1", type: "paragraph", text: "", sortOrder: 1 }
  ]

  const result = resolveBlankAreaClick(blocks, { blankLineCount: 0, createId: () => "new-paragraph" })

  assert.deepEqual(result, {
    type: "focus-existing",
    focusBlockId: "paragraph-1"
  })
})

test("resolveBlankAreaClick 会按点击高度追加对应数量的空段落", () => {
  const blocks: NoteBlock[] = [
    { id: "heading-1", type: "heading", level: 1, text: "定位", sortOrder: 0 },
    { id: "paragraph-1", type: "paragraph", text: "已有内容", sortOrder: 1 }
  ]

  let sequence = 0
  const result = resolveBlankAreaClick(blocks, {
    blankLineCount: 3,
    createId: () => `new-paragraph-${++sequence}`
  })

  assert.deepEqual(result, {
    type: "append-empty-paragraph",
    focusBlockId: "new-paragraph-3",
    nextBlocks: [
      { id: "heading-1", type: "heading", level: 1, text: "定位", sortOrder: 0 },
      { id: "paragraph-1", type: "paragraph", text: "已有内容", sortOrder: 1 },
      { id: "new-paragraph-1", type: "paragraph", text: "", sortOrder: 2 },
      { id: "new-paragraph-2", type: "paragraph", text: "", sortOrder: 3 },
      { id: "new-paragraph-3", type: "paragraph", text: "", sortOrder: 4 }
    ]
  })
})
