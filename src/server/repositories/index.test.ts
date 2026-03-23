/**
 * 本地仓库书籍创建测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

test("repository.createBook 保留传入的书籍 id", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-repo-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const demo = repository.getUserByEmail(
      process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local"
    )

    assert.ok(demo, "应存在默认演示账号")

    const created = repository.createBook({
      id: "book-fixed-id",
      userId: demo!.id,
      title: "封面流程测试",
      author: "Lumina",
      format: "EPUB",
      filePath: "minio://lumina-books/books/user-1/book-fixed-id/demo.epub",
      coverPath: "minio://lumina-covers/user-1/book-fixed-id.jpg",
      totalPages: 1,
      readProgress: 0,
      lastReadAt: new Date().toISOString(),
      tags: ["测试"],
      status: "READY",
      synopsis: "测试",
      toc: [],
      content: []
    } as any)

    assert.equal(created.id, "book-fixed-id")
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})
