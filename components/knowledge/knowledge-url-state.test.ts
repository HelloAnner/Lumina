/**
 * 知识库 URL 状态工具测试
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  buildKnowledgeSearch,
  readKnowledgeSelection
} from "@/components/knowledge/knowledge-url-state"

test("buildKnowledgeSearch 会写入 viewpoint 查询参数并清理 importedNote", () => {
  const params = new URLSearchParams("tab=chat&importedNote=note-1")

  assert.equal(
    buildKnowledgeSearch(params, { viewpointId: "vp-1" }),
    "tab=chat&viewpoint=vp-1"
  )
})

test("readKnowledgeSelection 会读取查询参数中的笔记选择", () => {
  const params = new URLSearchParams("viewpoint=vp-1")
  assert.deepEqual(readKnowledgeSelection(params), {
    viewpointId: "vp-1",
    importedNoteId: undefined
  })
})
