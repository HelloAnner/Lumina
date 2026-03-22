import { Hono } from "hono"
import { serialize } from "cookie"
import { z } from "zod"
import {
  getTokenName,
  hashPassword,
  signToken,
  verifyPassword
} from "@/src/server/lib/auth"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).optional()
})

const app = new Hono<AppEnv>()

app.post("/register", async (c) => {
  const payload = authSchema.parse(await c.req.json())
  if (repository.getUserByEmail(payload.email)) {
    return c.json({ error: "邮箱已存在" }, 409)
  }
  const user = repository.createUser({
    email: payload.email,
    passwordHash: await hashPassword(payload.password),
    name: payload.name ?? payload.email.split("@")[0]
  })
  const token = await signToken(user)
  c.header(
    "Set-Cookie",
    serialize(getTokenName(), token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7
    })
  )
  return c.json({ user })
})

app.post("/login", async (c) => {
  const payload = authSchema.pick({ email: true, password: true }).parse(
    await c.req.json()
  )
  const user = repository.getUserByEmail(payload.email)
  if (!user) {
    return c.json({ error: "账号不存在" }, 404)
  }
  const matched = await verifyPassword(payload.password, user.passwordHash)
  if (!matched) {
    return c.json({ error: "密码错误" }, 401)
  }
  const token = await signToken(user)
  c.header(
    "Set-Cookie",
    serialize(getTokenName(), token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7
    })
  )
  return c.json({ user })
})

app.post("/refresh", async (c) => {
  return c.json({ ok: true })
})

app.post("/logout", async (c) => {
  c.header(
    "Set-Cookie",
    serialize(getTokenName(), "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
      sameSite: "lax"
    })
  )
  return c.json({ ok: true })
})

export default app
