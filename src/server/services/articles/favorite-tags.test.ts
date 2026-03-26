/**
 * 收藏自动标签测试
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import { applyFavoriteTopics } from "@/src/server/services/articles/favorite-tags"

test("applyFavoriteTopics 优先复用已有主题并补充新主题", () => {
  const result = applyFavoriteTopics(
    [
      { id: "t1", name: "人工智能" },
      { id: "t2", name: "产品策略" }
    ],
    ["人工智能", "长期主义", "产品策略"]
  )

  assert.deepEqual(result.topicIds, ["t1", "generated:长期主义", "t2"])
  assert.deepEqual(result.newTopics, ["长期主义"])
})
