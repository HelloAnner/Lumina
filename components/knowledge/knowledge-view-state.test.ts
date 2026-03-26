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
  shouldBootstrapEmptyViewpoint,
  shouldRenderViewpointEditor
} from "@/components/knowledge/knowledge-view-state"

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
