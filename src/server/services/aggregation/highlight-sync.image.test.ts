/**
 * 图片划线同步测试
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

test("syncPendingHighlights 会把图片划线写成知识库图片块", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-image-highlight-sync-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")
  const { syncPendingHighlights } = await import("./highlight-sync")

  try {
    const demo = repository.getUserByEmail(
      process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local"
    )
    assert.ok(demo)

    const article = repository.createArticle({
      userId: demo!.id,
      entryId: "entry-img",
      sourceId: "manual",
      title: "AI 图像文章",
      sourceUrl: "https://example.com/ai-image",
      channelName: "Example",
      channelIcon: "",
      topics: [],
      summary: "summary",
      content: [],
      readProgress: 0,
      highlightCount: 0,
      status: "ready"
    })

    const highlight = repository.createHighlight({
      userId: demo!.id,
      bookId: article.id,
      articleId: article.id,
      sourceType: "article",
      format: "EPUB",
      assetType: "image",
      sourceTitle: article.title,
      sourceSectionTitle: "模型结构",
      imageUrl: "/api/articles/article/assets/img-1",
      imageAlt: "模型结构图",
      content: "模型结构图",
      color: "yellow",
      contentMode: "original"
    } as any)

    await syncPendingHighlights(demo!.id)

    const viewpoints = repository.listViewpoints(demo!.id)
    const matched = viewpoints.find((item) =>
      item.articleBlocks?.some(
        (block) => block.type === "image" && "highlightId" in block && block.highlightId === highlight.id
      )
    )

    assert.ok(matched)
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})
