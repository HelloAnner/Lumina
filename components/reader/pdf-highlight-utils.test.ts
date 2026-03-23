/**
 * PDF 高亮几何工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import { normalizePdfSelectionRects } from "@/components/reader/pdf-highlight-utils"

test("normalizePdfSelectionRects 会把选区 rect 转成页内坐标", () => {
  const result = normalizePdfSelectionRects({
    pageRect: {
      left: 100,
      top: 200,
      width: 600,
      height: 800
    },
    clientRects: [
      {
        left: 140,
        top: 250,
        width: 180,
        height: 24
      },
      {
        left: 140,
        top: 282,
        width: 120,
        height: 24
      }
    ]
  })

  assert.deepEqual(result, [
    {
      left: 40,
      top: 50,
      width: 180,
      height: 24
    },
    {
      left: 40,
      top: 82,
      width: 120,
      height: 24
    }
  ])
})

test("normalizePdfSelectionRects 会过滤零宽高和页外无效块", () => {
  const result = normalizePdfSelectionRects({
    pageRect: {
      left: 100,
      top: 200,
      width: 600,
      height: 800
    },
    clientRects: [
      {
        left: 140,
        top: 250,
        width: 0,
        height: 24
      },
      {
        left: 80,
        top: 250,
        width: 10,
        height: 24
      },
      {
        left: 140,
        top: 250,
        width: 180,
        height: 24
      }
    ]
  })

  assert.deepEqual(result, [
    {
      left: 40,
      top: 50,
      width: 180,
      height: 24
    }
  ])
})
