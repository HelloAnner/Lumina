/**
 * 书库进度工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  formatLibraryProgressText,
  normalizeLibraryProgress
} from "@/components/library/library-progress"

test("normalizeLibraryProgress 支持 0-1 小数进度", () => {
  assert.equal(normalizeLibraryProgress(0.64), 64)
})

test("normalizeLibraryProgress 支持已经是百分比的进度", () => {
  assert.equal(normalizeLibraryProgress(64), 64)
})

test("normalizeLibraryProgress 会裁剪异常范围", () => {
  assert.equal(normalizeLibraryProgress(-2), 0)
  assert.equal(normalizeLibraryProgress(188), 100)
})

test("formatLibraryProgressText 返回可展示百分比", () => {
  assert.equal(formatLibraryProgressText(0.36), "36%")
})
