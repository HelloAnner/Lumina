import { Hono } from "hono"
import JSZip from "jszip"
import { z } from "zod"
import { hashPassword, verifyPassword } from "@/src/server/lib/auth"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"

const app = new Hono<AppEnv>()

app.get("/profile", (c) => {
  return c.json({ user: c.get("user") })
})

app.put("/profile", async (c) => {
  const payload = z.object({ name: z.string().min(2) }).parse(await c.req.json())
  const user = repository.updateUser(c.get("userId"), { name: payload.name })
  return c.json({ user })
})

app.put("/password", async (c) => {
  const payload = z
    .object({
      currentPassword: z.string().min(6),
      nextPassword: z.string().min(6)
    })
    .parse(await c.req.json())
  const user = repository.getUserById(c.get("userId"))
  if (!user) {
    return c.json({ error: "用户不存在" }, 404)
  }
  const matched = await verifyPassword(payload.currentPassword, user.passwordHash)
  if (!matched) {
    return c.json({ error: "旧密码错误" }, 400)
  }
  await repository.updateUser(user.id, {
    passwordHash: await hashPassword(payload.nextPassword)
  })
  return c.json({ ok: true })
})

app.get("/export", async (c) => {
  const userId = c.get("userId")
  const zip = new JSZip()
  zip.file(
    "books.json",
    JSON.stringify(repository.listBooks(userId), null, 2)
  )
  zip.file(
    "viewpoints.json",
    JSON.stringify(repository.listViewpoints(userId), null, 2)
  )
  const buffer = await zip.generateAsync({ type: "nodebuffer" })
  c.header("Content-Type", "application/zip")
  c.header("Content-Disposition", "attachment; filename=lumina-export.zip")
  return c.body(new Uint8Array(buffer))
})

app.delete("/", (c) => {
  repository.updateUser(c.get("userId"), {
    deletedAt: new Date().toISOString()
  })
  return c.json({ ok: true })
})

export default app
