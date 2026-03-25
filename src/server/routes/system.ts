/**
 * 系统工具 API
 * 提供目录浏览等本机文件系统操作
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
import { Hono } from "hono"
import { readdirSync, statSync } from "fs"
import { join, resolve } from "path"
import { homedir } from "os"
import type { AppEnv } from "@/src/server/lib/hono"

const app = new Hono<AppEnv>()

/** 列出指定路径下的子目录 */
app.get("/browse", (c) => {
  const raw = c.req.query("path") ?? homedir()
  const target = resolve(raw)

  try {
    const stat = statSync(target)
    if (!stat.isDirectory()) {
      return c.json({ error: "不是有效的目录" }, 400)
    }
  } catch {
    return c.json({ error: "路径不存在" }, 400)
  }

  const entries: { name: string; path: string }[] = []
  try {
    const items = readdirSync(target, { withFileTypes: true })
    for (const item of items) {
      if (!item.isDirectory()) {
        continue
      }
      // 跳过隐藏目录和系统目录
      if (item.name.startsWith(".") || item.name === "node_modules") {
        continue
      }
      entries.push({
        name: item.name,
        path: join(target, item.name)
      })
    }
  } catch {
    return c.json({ error: "无法读取目录" }, 403)
  }

  entries.sort((a, b) => a.name.localeCompare(b.name))

  return c.json({
    current: target,
    parent: resolve(target, ".."),
    entries
  })
})

export default app
