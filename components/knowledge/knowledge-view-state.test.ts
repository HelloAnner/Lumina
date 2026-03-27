/**
 * 知识库观点切换状态测试
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  buildViewpointPrefetchOrder,
  shouldBootstrapEmptyViewpoint,
  shouldRenderViewpointEditor
} from "@/components/knowledge/knowledge-view-state"
import type { Viewpoint } from "@/src/server/store/types"

test("切换到新观点但块数据尚未就绪时不渲染编辑器", () => {
  assert.equal(
    shouldRenderViewpointEditor({
      selectedId: "vp-2",
      readyViewpointId: "vp-1"
    }),
    false
  )
})

test("切换到新观点但块数据尚未就绪时不初始化空白段落", () => {
  assert.equal(
    shouldBootstrapEmptyViewpoint({
      selectedId: "vp-2",
      readyViewpointId: "vp-1",
      blockCount: 0
    }),
    false
  )
})

test("当前观点块数据已就绪且为空时才初始化空白段落", () => {
  assert.equal(
    shouldBootstrapEmptyViewpoint({
      selectedId: "vp-2",
      readyViewpointId: "vp-2",
      blockCount: 0
    }),
    true
  )
})

test("buildViewpointPrefetchOrder 会优先返回当前观点附近的非文件夹主题", () => {
  const viewpoints: Viewpoint[] = [
    { id: "a", userId: "u", title: "A", isFolder: false, isCandidate: false, sortOrder: 0, highlightCount: 0, articleContent: "", relatedBookIds: [], createdAt: "" },
    { id: "b", userId: "u", title: "B", isFolder: false, isCandidate: false, sortOrder: 1, highlightCount: 0, articleContent: "", relatedBookIds: [], createdAt: "" },
    { id: "folder", userId: "u", title: "Folder", isFolder: true, isCandidate: false, sortOrder: 2, highlightCount: 0, articleContent: "", relatedBookIds: [], createdAt: "" },
    { id: "c", userId: "u", title: "C", isFolder: false, isCandidate: false, sortOrder: 3, highlightCount: 0, articleContent: "", relatedBookIds: [], createdAt: "" },
    { id: "d", userId: "u", title: "D", isFolder: false, isCandidate: false, sortOrder: 4, highlightCount: 0, articleContent: "", relatedBookIds: [], createdAt: "" }
  ]

  assert.deepEqual(
    buildViewpointPrefetchOrder(viewpoints, "b", 3),
    ["c", "a", "d"]
  )
})
