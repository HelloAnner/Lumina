/**
 * 笔记目录工具测试
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import type { NoteBlock } from "@/src/server/store/types"
import {
  buildHeadingOutlineItems,
  resolveActiveHeadingId
} from "@/components/knowledge/note-outline-utils"

test("buildHeadingOutlineItems 只收集标题块", () => {
  const blocks: NoteBlock[] = [
    { id: "p-1", type: "paragraph", text: "段落", sortOrder: 0 },
    { id: "h-1", type: "heading", level: 1, text: "总览", sortOrder: 1 },
    { id: "q-1", type: "quote", text: "引用", sortOrder: 2 },
    { id: "h-2", type: "heading", level: 3, text: "细节", sortOrder: 3 }
  ]

  assert.deepEqual(buildHeadingOutlineItems(blocks), [
    { blockId: "h-1", label: "总览", depth: 0 },
    { blockId: "h-2", label: "细节", depth: 2 }
  ])
})

test("resolveActiveHeadingId 会根据滚动位置返回当前标题", () => {
  assert.equal(
    resolveActiveHeadingId(
      [
        { blockId: "h-1", top: 20 },
        { blockId: "h-2", top: 320 },
        { blockId: "h-3", top: 760 }
      ],
      0
    ),
    "h-1"
  )

  assert.equal(
    resolveActiveHeadingId(
      [
        { blockId: "h-1", top: 20 },
        { blockId: "h-2", top: 320 },
        { blockId: "h-3", top: 760 }
      ],
      380
    ),
    "h-2"
  )
})
