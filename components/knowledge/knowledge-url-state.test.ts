/**
 * 知识库 URL 与笔记状态工具测试
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_KNOWLEDGE_NOTE_STATE,
  buildKnowledgeHref,
  buildKnowledgeSearch,
  readKnowledgeSelection
} from "@/components/knowledge/knowledge-url-state"

test("buildKnowledgeSearch 会写入 viewpoint 查询参数并清理 importedNote", () => {
  const params = new URLSearchParams("tab=chat&importedNote=note-1&block=block-1&highlight=hl-1")

  assert.equal(
    buildKnowledgeSearch(params, {
      viewpointId: "vp-1",
      blockId: "block-2",
      highlightId: "hl-2"
    }),
    "tab=chat&viewpoint=vp-1&block=block-2&highlight=hl-2"
  )
})

test("buildKnowledgeHref 会保留原有查询参数并输出完整地址", () => {
  const params = new URLSearchParams("tab=chat&importedNote=note-1")

  assert.equal(
    buildKnowledgeHref("/knowledge", params, {
      viewpointId: "vp-1",
      blockId: "block-1",
      highlightId: "hl-1"
    }),
    "/knowledge?tab=chat&viewpoint=vp-1&block=block-1&highlight=hl-1"
  )
})

test("readKnowledgeSelection 会读取查询参数中的笔记选择", () => {
  const params = new URLSearchParams("viewpoint=vp-1&block=block-1&highlight=hl-1")

  assert.deepEqual(readKnowledgeSelection(params), {
    viewpointId: "vp-1",
    importedNoteId: undefined,
    blockId: "block-1",
    highlightId: "hl-1"
  })
})

test("buildKnowledgeSearch 切换到 importedNote 时会清理定位参数", () => {
  const params = new URLSearchParams("viewpoint=vp-1&block=block-1&highlight=hl-1")

  assert.equal(
    buildKnowledgeSearch(params, { importedNoteId: "note-9" }),
    "importedNote=note-9"
  )
})

test("DEFAULT_KNOWLEDGE_NOTE_STATE 默认收起目录", () => {
  assert.equal(DEFAULT_KNOWLEDGE_NOTE_STATE.outlineCollapsed, true)
})
