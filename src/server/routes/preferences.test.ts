import test from "node:test"
import assert from "node:assert/strict"
import { Hono } from "hono"
import type { AppEnv } from "@/src/server/lib/hono"
import preferenceRoutes from "@/src/server/routes/preferences"

function createApp() {
  const app = new Hono<AppEnv>()
  app.use("*", async (c, next) => {
    c.set("userId", "user-1")
    c.set("user", {
      id: "user-1",
      email: "user-1@example.com",
      name: "User 1",
      passwordHash: "",
      createdAt: "2026-04-01T00:00:00.000Z"
    })
    await next()
  })
  app.route("/api/preferences", preferenceRoutes)
  return app
}

test("GET /api/preferences/reader-layout 返回资源级阅读布局默认值", async () => {
  const app = createApp()

  const response = await app.request(
    "/api/preferences/reader-layout?resourceType=book&resourceId=book-1"
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    item: {
      outlineCollapsed: false,
      notesCollapsed: false
    }
  })
})

test("PUT /api/preferences/reader-layout 支持局部更新阅读布局偏好", async () => {
  const app = createApp()

  const response = await app.request("/api/preferences/reader-layout", {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      resourceType: "article",
      resourceId: "article-1",
      notesCollapsed: true
    })
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    item: {
      outlineCollapsed: false,
      notesCollapsed: true
    }
  })
})
