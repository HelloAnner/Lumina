import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Hono } from "hono"
import type { AppEnv } from "@/src/server/lib/hono"
import type { NoteBlock } from "@/src/server/store/types"

async function createApp(dataDir: string) {
  process.env.DATA_DIR = dataDir
  const { repository } = await import("@/src/server/repositories")
  const { default: highlightRoutes } = await import("@/src/server/routes/highlights")

  const user = repository.createUser({
    email: "highlight-route@test.local",
    passwordHash: "hashed",
    name: "Highlight Route"
  })

  const viewpoint = repository.createViewpoint({
    userId: user.id,
    title: "定价权来源",
    isFolder: false,
    isCandidate: false,
    sortOrder: 1,
    articleContent: "",
    articleBlocks: [],
    relatedBookIds: []
  })

  const highlight = repository.createHighlight({
    userId: user.id,
    bookId: "book-1",
    format: "EPUB",
    pageIndex: 3,
    content: "定价权往往隐藏在市场定义里。",
    color: "blue"
  } as const)

  const blocks: NoteBlock[] = [
    {
      id: "block-highlight-1",
      type: "highlight",
      sortOrder: 1,
      text: "定价权往往隐藏在市场定义里。",
      sourceBookTitle: "Zero to One",
      sourceLocation: "第三章",
      highlightId: highlight.id
    }
  ]
  repository.updateViewpointBlocks(user.id, viewpoint.id, blocks)
  repository.upsertHighlightLink({
    highlightId: highlight.id,
    viewpointId: viewpoint.id,
    similarityScore: 0.91,
    confirmed: true
  })

  const app = new Hono<AppEnv>()
  app.use("*", async (c, next) => {
    c.set("userId", user.id)
    c.set("user", user)
    await next()
  })
  app.route("/api/highlights", highlightRoutes)

  return { app, highlight, viewpoint }
}

test("GET /api/highlights/:id/references 返回高亮及其观点块去向", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-highlight-route-test-"))

  try {
    const { app, highlight, viewpoint } = await createApp(dataDir)

    const response = await app.request(`/api/highlights/${highlight.id}/references`)

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      item: {
        ...highlight,
        contentMode: "original"
      },
      references: [
        {
          viewpointId: viewpoint.id,
          viewpointTitle: "定价权来源",
          blockId: "block-highlight-1",
          blockType: "highlight",
          blockText: "定价权往往隐藏在市场定义里。",
          sourceLocation: "第三章"
        }
      ]
    })
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})
