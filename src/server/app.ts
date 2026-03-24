import { Hono } from "hono"
import { handle } from "hono/vercel"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "@/src/server/lib/hono"
import authRoutes from "@/src/server/routes/auth"
import accountRoutes from "@/src/server/routes/account"
import booksRoutes from "@/src/server/routes/books"
import highlightsRoutes from "@/src/server/routes/highlights"
import aiRoutes from "@/src/server/routes/ai"
import viewpointsRoutes from "@/src/server/routes/viewpoints"
import aggregateRoutes from "@/src/server/routes/aggregate"
import graphRoutes from "@/src/server/routes/graph"
import publishRoutes from "@/src/server/routes/publish"
import settingsRoutes from "@/src/server/routes/settings"
import preferenceRoutes from "@/src/server/routes/preferences"
import translationRoutes from "@/src/server/routes/translations"
import annotationRoutes from "@/src/server/routes/annotations"
import { requireAuth } from "@/src/server/middleware/auth"

const app = new Hono<AppEnv>()

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return error.getResponse()
  }
  return c.json(
    {
      error: error instanceof Error ? error.message : "Internal server error"
    },
    500
  )
})

app.notFound((c) => c.json({ error: "Not found" }, 404))

app.route("/api/auth", authRoutes)
app.use("/api/account/*", requireAuth)
app.use("/api/books/*", requireAuth)
app.use("/api/highlights/*", requireAuth)
app.use("/api/ai/*", requireAuth)
app.use("/api/viewpoints/*", requireAuth)
app.use("/api/aggregate/*", requireAuth)
app.use("/api/graph/*", requireAuth)
app.use("/api/publish/*", requireAuth)
app.use("/api/settings/*", requireAuth)
app.use("/api/preferences/*", requireAuth)
app.use("/api/translations/*", requireAuth)
app.use("/api/annotations/*", requireAuth)

app.route("/api/account", accountRoutes)
app.route("/api/books", booksRoutes)
app.route("/api/highlights", highlightsRoutes)
app.route("/api/ai", aiRoutes)
app.route("/api/viewpoints", viewpointsRoutes)
app.route("/api/aggregate", aggregateRoutes)
app.route("/api/graph", graphRoutes)
app.route("/api/publish", publishRoutes)
app.route("/api/settings", settingsRoutes)
app.route("/api/preferences", preferenceRoutes)
app.route("/api/translations", translationRoutes)
app.route("/api/annotations", annotationRoutes)

export const GET = handle(app)
export const HEAD = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const PATCH = handle(app)
export const OPTIONS = handle(app)

export default app
