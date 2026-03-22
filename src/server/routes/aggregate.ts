import { Hono } from "hono"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import { runAggregation } from "@/src/server/services/aggregation/engine"

const app = new Hono<AppEnv>()

app.post("/", (c) => {
  const current = repository.getAggregateJob(c.get("userId"))
  if (current?.status === "RUNNING") {
    return c.json({ error: "聚合任务正在运行中" }, 409)
  }
  const job = runAggregation(c.get("userId"))
  return c.json({ jobId: job?.id, status: job?.status ?? "DONE" })
})

app.get("/status", (c) => {
  const job = repository.getAggregateJob(c.get("userId"))
  return c.json({
    status: job?.status ?? "IDLE",
    progress: {
      stage: job?.stage ?? "idle",
      processed: job?.processed ?? 0,
      total: job?.total ?? 0
    }
  })
})

app.get("/history", (c) => {
  const job = repository.getAggregateJob(c.get("userId"))
  return c.json({ items: job ? [job] : [] })
})

export default app
