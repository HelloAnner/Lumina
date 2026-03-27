import test from "node:test"
import assert from "node:assert/strict"
import type { Database, NoteBlock, Viewpoint } from "@/src/server/store/types"
import {
  hydrateViewpointBlocks,
  splitViewpointBlocksFromDatabase
} from "@/src/server/store/db"

function createViewpoint(id: string, blocks?: NoteBlock[]): Viewpoint {
  return {
    id,
    userId: "user-1",
    title: `vp-${id}`,
    isFolder: false,
    isCandidate: false,
    sortOrder: 0,
    highlightCount: 0,
    articleContent: "",
    articleBlocks: blocks,
    relatedBookIds: [],
    createdAt: "2026-03-27T00:00:00.000Z"
  }
}

test("splitViewpointBlocksFromDatabase 会把 articleBlocks 拆出主数据库", () => {
  const blocks: NoteBlock[] = [
    { id: "b-1", type: "paragraph", text: "hello", sortOrder: 0 }
  ]
  const database = {
    viewpoints: [createViewpoint("vp-1", blocks)]
  } as Database

  const result = splitViewpointBlocksFromDatabase(database)

  assert.equal(result.database.viewpoints[0].articleBlocks, undefined)
  assert.deepEqual(result.blockEntries, [
    {
      userId: "user-1",
      viewpointId: "vp-1",
      blocks
    }
  ])
})

test("hydrateViewpointBlocks 会把拆出的块重新挂回对应 viewpoint", () => {
  const result = hydrateViewpointBlocks(
    {
      viewpoints: [createViewpoint("vp-1"), createViewpoint("vp-2")]
    } as Database,
    [
      {
        userId: "user-1",
        viewpointId: "vp-2",
        blocks: [{ id: "b-2", type: "paragraph", text: "world", sortOrder: 0 }]
      }
    ]
  )

  assert.equal(result.viewpoints[0].articleBlocks, undefined)
  assert.deepEqual(result.viewpoints[1].articleBlocks, [
    { id: "b-2", type: "paragraph", text: "world", sortOrder: 0 }
  ])
})
