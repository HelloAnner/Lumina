/**
 * 设置页提示文案工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import test from "node:test"
import assert from "node:assert/strict"
import { buildModelTestToast } from "./settings-client-utils"

test("buildModelTestToast 在失败时展示后端错误详情", () => {
  assert.deepEqual(
    buildModelTestToast(false, { error: "language test failed: empty response" }),
    {
      title: "测试失败",
      description: "language test failed: empty response",
      tone: "warning"
    }
  )
})

test("buildModelTestToast 在失败且无错误详情时回退默认提示", () => {
  assert.deepEqual(
    buildModelTestToast(false, {}),
    {
      title: "测试失败",
      description: "请检查配置",
      tone: "warning"
    }
  )
})

test("buildModelTestToast 在成功时返回成功提示", () => {
  assert.deepEqual(
    buildModelTestToast(true, {}),
    {
      title: "连通性测试成功 ✓",
      tone: "success"
    }
  )
})
