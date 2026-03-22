import { repository } from "@/src/server/repositories"
import { runAggregation } from "@/src/server/services/aggregation/engine"

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

const demo = repository.getUserByEmail(
  process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local"
)

assert(demo, "缺少默认演示账号")

const books = repository.listBooks(demo!.id)
assert(books.length > 0, "书库为空")

const aggregate = runAggregation(demo!.id)
assert(aggregate?.status === "DONE", "聚合任务未完成")

const graph = repository.getGraph(demo!.id)
assert(graph.nodes.length > 0, "图谱节点为空")

console.log("Verification passed.")
