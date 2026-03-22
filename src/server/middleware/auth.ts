import { createMiddleware } from "hono/factory"
import { parse } from "cookie"
import { verifyToken } from "@/src/server/lib/auth"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authorization = c.req.header("authorization")
  const cookieHeader = c.req.header("cookie") ?? ""
  const cookies = parse(cookieHeader || "")
  const token =
    cookies.lumina_token ??
    (authorization?.startsWith("Bearer ") ? authorization.slice(7) : "")

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const payload = await verifyToken(token)
    const userId = payload.sub
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401)
    }
    const user = repository.getUserById(userId)
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401)
    }
    c.set("userId", user.id)
    c.set("user", user)
    await next()
  } catch {
    return c.json({ error: "Unauthorized" }, 401)
  }
})
