/**
 * PDF 高亮几何工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  normalizePdfSelectionRects,
  normalizePdfDragRect
} from "@/components/reader/pdf-highlight-utils"

test("normalizePdfSelectionRects 会裁剪并归一化选区矩形", () => {
  const rects = normalizePdfSelectionRects({
    pageRect: {
      left: 100,
      top: 200,
      width: 300,
      height: 400
    },
    clientRects: [
      {
        left: 120,
        top: 220,
        width: 80,
        height: 24
      },
      {
        left: 80,
        top: 210,
        width: 40,
        height: 20
      }
    ]
  })

  assert.deepEqual(rects, [
    {
      left: 0,
      top: 10,
      width: 20,
      height: 20
    },
    {
      left: 20,
      top: 20,
      width: 80,
      height: 24
    }
  ])
})

test("normalizePdfDragRect 会把拖拽框转换成页内坐标", () => {
  const rect = normalizePdfDragRect({
    pageRect: {
      left: 50,
      top: 80,
      width: 400,
      height: 500
    },
    dragRect: {
      left: 140,
      top: 230,
      width: 120,
      height: 90
    }
  })

  assert.deepEqual(rect, {
    left: 90,
    top: 150,
    width: 120,
    height: 90
  })
})
