import { Hono } from "hono"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"

const app = new Hono<AppEnv>()

app.get("/", (c) => {
  return c.json(repository.getGraph(c.get("userId")))
})

export default app
