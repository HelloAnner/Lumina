import test from "node:test"
import assert from "node:assert/strict"
import {
  formatServerTiming,
  parseServerTiming
} from "@/src/lib/timing"

test("formatServerTiming 会把指标格式化为 Server-Timing header", () => {
  assert.equal(
    formatServerTiming([
      { name: "meta", duration: 3.2, description: "viewpoint-meta" },
      { name: "blocks", duration: 12.67 }
    ]),
    'meta;dur=3.2;desc="viewpoint-meta", blocks;dur=12.67'
  )
})

test("parseServerTiming 会解析 Server-Timing header 为指标对象", () => {
  assert.deepEqual(
    parseServerTiming('meta;dur=3.2;desc="viewpoint-meta", blocks;dur=12.67'),
    [
      { name: "meta", duration: 3.2, description: "viewpoint-meta" },
      { name: "blocks", duration: 12.67 }
    ]
  )
})
