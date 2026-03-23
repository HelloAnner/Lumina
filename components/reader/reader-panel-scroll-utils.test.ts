/**
 * 阅读器侧栏滚动工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  computeCenteredScrollTop,
  pickCurrentHighlightId
} from "@/components/reader/reader-panel-scroll-utils"

test("computeCenteredScrollTop 会尽量让目标元素落在容器中间", () => {
  const top = computeCenteredScrollTop({
    containerHeight: 300,
    contentHeight: 1200,
    itemTop: 500,
    itemHeight: 40
  })

  assert.equal(top, 370)
})

test("computeCenteredScrollTop 会在顶部和底部边界做截断", () => {
  assert.equal(
    computeCenteredScrollTop({
      containerHeight: 300,
      contentHeight: 1200,
      itemTop: 20,
      itemHeight: 40
    }),
    0
  )

  assert.equal(
    computeCenteredScrollTop({
      containerHeight: 300,
      contentHeight: 1200,
      itemTop: 1160,
      itemHeight: 40
    }),
    900
  )
})

test("pickCurrentHighlightId 会优先选择当前章节中的最后一条划线", () => {
  const id = pickCurrentHighlightId(
    [
      { id: "a", pageIndex: 1 },
      { id: "b", pageIndex: 2 },
      { id: "c", pageIndex: 2 }
    ],
    2
  )

  assert.equal(id, "c")
})

test("pickCurrentHighlightId 在没有匹配章节时返回空值", () => {
  const id = pickCurrentHighlightId([{ id: "a", pageIndex: 1 }], 3)

  assert.equal(id, null)
})
