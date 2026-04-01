import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Database, NoteBlock, Viewpoint } from "@/src/server/store/types"
import {
  hydrateViewpointBlocks,
  readViewpointBlocks,
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

test("readViewpointBlocks 会优先读取独立块文件", async () => {
  const blocks: NoteBlock[] = [
    { id: "b-1", type: "paragraph", text: "hello", sortOrder: 0 }
  ]
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-db-test-"))
  process.env.DATA_DIR = dataDir
  try {
    mkdirSync(`${dataDir}/viewpoint-blocks/user-1`, { recursive: true })
    writeFileSync(`${dataDir}/lumina.json`, JSON.stringify({
      viewpoints: [createViewpoint("vp-1")]
    }), "utf-8")
    writeFileSync(
      `${dataDir}/viewpoint-blocks/user-1/vp-1.json`,
      JSON.stringify(blocks),
      "utf-8"
    )

    assert.deepEqual(readViewpointBlocks("user-1", "vp-1"), blocks)
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})
