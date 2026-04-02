import test from "node:test"
import assert from "node:assert/strict"
import type { NoteBlock } from "@/src/server/store/types"
import { resolveJumpTargetBlockId } from "@/components/knowledge/knowledge-jump"

test("resolveJumpTargetBlockId 优先命中显式 blockId", () => {
  const blocks: NoteBlock[] = [
    {
      id: "block-1",
      type: "paragraph",
      sortOrder: 1,
      text: "正文"
    },
    {
      id: "block-2",
      type: "highlight",
      sortOrder: 2,
      text: "高亮",
      highlightId: "hl-1"
    }
  ]

  assert.equal(
    resolveJumpTargetBlockId(blocks, {
      blockId: "block-1",
      highlightId: "hl-1"
    }),
    "block-1"
  )
})

test("resolveJumpTargetBlockId 在 blockId 缺失时按 highlightId 兜底", () => {
  const blocks: NoteBlock[] = [
    {
      id: "block-1",
      type: "paragraph",
      sortOrder: 1,
      text: "正文"
    },
    {
      id: "block-2",
      type: "quote",
      sortOrder: 2,
      text: "引用",
      highlightId: "hl-1"
    }
  ]

  assert.equal(
    resolveJumpTargetBlockId(blocks, {
      blockId: "missing",
      highlightId: "hl-1"
    }),
    "block-2"
  )
})

test("resolveJumpTargetBlockId 支持在嵌套块中查找 highlightId", () => {
  const blocks: NoteBlock[] = [
    {
      id: "toggle-1",
      type: "toggle",
      sortOrder: 1,
      title: "折叠",
      children: [
        {
          id: "block-quote-1",
          type: "quote",
          sortOrder: 1,
          text: "嵌套引用",
          highlightId: "hl-2"
        }
      ]
    }
  ]

  assert.equal(
    resolveJumpTargetBlockId(blocks, {
      highlightId: "hl-2"
    }),
    "block-quote-1"
  )
})
