/**
 * 本地仓库书籍创建测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
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

test("repository.createHighlight 默认原文模式，允许保存译文模式高亮", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-highlight-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const demo = repository.getUserByEmail(
      process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local"
    )

    assert.ok(demo, "应存在默认演示账号")

    const book = repository.listBooks(demo!.id)[0]
    assert.ok(book, "应存在默认演示书籍")
    const beforeCount = repository.listHighlightsByBook(demo!.id, book.id).length

    const originalHighlight = repository.createHighlight({
      userId: demo!.id,
      bookId: book.id,
      format: "EPUB",
      pageIndex: 1,
      content: "原文片段",
      color: "yellow"
    } as any)

    const translatedHighlight = repository.createHighlight({
      userId: demo!.id,
      bookId: book.id,
      format: "EPUB",
      pageIndex: 1,
      contentMode: "translation",
      targetLanguage: "zh-CN",
      content: "译文片段",
      counterpartContent: "Original snippet",
      counterpartParaOffsetStart: 3,
      counterpartParaOffsetEnd: 11,
      color: "blue"
    } as any)

    const items = repository.listHighlightsByBook(demo!.id, book.id)

    assert.equal(
      items.find((item) => item.id === originalHighlight.id)?.contentMode,
      "original"
    )
    assert.equal(
      items.find((item) => item.id === translatedHighlight.id)?.contentMode,
      "translation"
    )
    assert.equal(
      items.find((item) => item.id === translatedHighlight.id)?.content,
      "译文片段"
    )
    assert.equal(
      items.find((item) => item.id === translatedHighlight.id)?.counterpartContent,
      "Original snippet"
    )
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test("repository.createHighlight 对同一位置的重复文本划线去重并复用旧记录", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-highlight-dedupe-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const demo = repository.getUserByEmail(
      process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local"
    )

    assert.ok(demo, "应存在默认演示账号")

    const book = repository.listBooks(demo!.id)[0]
    assert.ok(book, "应存在默认演示书籍")
    const beforeCount = repository.listHighlightsByBook(demo!.id, book.id).length

    const first = repository.createHighlight({
      userId: demo!.id,
      bookId: book.id,
      format: "EPUB",
      pageIndex: 1,
      paraOffsetStart: 8,
      paraOffsetEnd: 16,
      content: "原文片段",
      color: "yellow"
    } as any)

    const duplicated = repository.createHighlight({
      userId: demo!.id,
      bookId: book.id,
      format: "EPUB",
      pageIndex: 1,
      paraOffsetStart: 8,
      paraOffsetEnd: 16,
      content: "原文片段",
      color: "blue",
      note: "不应覆盖旧划线"
    } as any)

    const items = repository.listHighlightsByBook(demo!.id, book.id)

    assert.equal(duplicated.id, first.id)
    assert.equal(items.length, beforeCount + 1)
    const reused = items.find((item) => item.id === first.id)
    assert.equal(reused?.color, "yellow")
    assert.equal(reused?.note, undefined)
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test("repository.deleteArticle 会一并删除文章关联数据", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-article-delete-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const articleOwner = repository.createUser({
      email: "article-delete@test.local",
      passwordHash: "hashed",
      name: "Article Delete"
    })

    const article = repository.createArticle({
      userId: articleOwner.id,
      entryId: "entry-1",
      sourceId: "manual",
      title: "文章 A",
      sourceUrl: "https://example.com/a",
      channelName: "Example",
      channelIcon: "",
      topics: [],
      summary: "summary",
      content: [{ id: "p1", type: "paragraph", text: "正文" }],
      readProgress: 0,
      highlightCount: 0,
      status: "ready"
    })

    repository.createHighlight({
      userId: articleOwner.id,
      bookId: article.id,
      articleId: article.id,
      sourceType: "article",
      format: "EPUB",
      pageIndex: 1,
      content: "正文",
      color: "yellow"
    } as any)
    repository.upsertArticleTranslation({
      userId: articleOwner.id,
      articleId: article.id,
      sourceHash: "hash-1",
      targetLanguage: "zh-CN",
      content: [{ id: "p1", type: "paragraph", text: "译文" }]
    })
    repository.createShareLink({
      token: "token-article-1",
      ownerUserId: articleOwner.id,
      resourceType: "article",
      resourceId: article.id,
      expiresAt: null
    })

    repository.deleteArticle(articleOwner.id, article.id)

    assert.equal(repository.getArticle(articleOwner.id, article.id), undefined)
    assert.equal(repository.listHighlightsByBook(articleOwner.id, article.id).length, 0)
    assert.equal(repository.listArticleTranslations(articleOwner.id, article.id).length, 0)
    assert.equal(repository.getShareLinkByToken("token-article-1"), null)
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test("repository.clearArticleDerivedData 在保留分享时不会删除分享链接", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-article-reset-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const articleOwner = repository.createUser({
      email: "article-reset@test.local",
      passwordHash: "hashed",
      name: "Article Reset"
    })

    const article = repository.createArticle({
      userId: articleOwner.id,
      entryId: "entry-1",
      sourceId: "manual",
      title: "文章 B",
      sourceUrl: "https://example.com/b",
      channelName: "Example",
      channelIcon: "",
      topics: [],
      summary: "summary",
      content: [{ id: "p1", type: "paragraph", text: "正文" }],
      readProgress: 0,
      highlightCount: 0,
      status: "ready"
    })

    repository.createHighlight({
      userId: articleOwner.id,
      bookId: article.id,
      articleId: article.id,
      sourceType: "article",
      format: "EPUB",
      pageIndex: 1,
      content: "正文",
      color: "yellow"
    } as any)
    repository.upsertArticleTranslation({
      userId: articleOwner.id,
      articleId: article.id,
      sourceHash: "hash-1",
      targetLanguage: "zh-CN",
      content: [{ id: "p1", type: "paragraph", text: "译文" }]
    })
    repository.createShareLink({
      token: "token-article-2",
      ownerUserId: articleOwner.id,
      resourceType: "article",
      resourceId: article.id,
      expiresAt: null
    })

    repository.clearArticleDerivedData(articleOwner.id, article.id, {
      keepShareLinks: true
    })

    assert.equal(repository.listHighlightsByBook(articleOwner.id, article.id).length, 0)
    assert.equal(repository.listArticleTranslations(articleOwner.id, article.id).length, 0)
    assert.ok(repository.getShareLinkByToken("token-article-2"))
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test("repository.deleteSource 会清理任务中的 source 引用并在无可用来源时暂停任务", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-scout-source-delete-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const owner = repository.createUser({
      email: "scout-source-delete@test.local",
      passwordHash: "hashed",
      name: "Scout Source Delete"
    })

    const sourceA = repository.createSource(owner.id, {
      name: "HN",
      channelId: "builtin-hn",
      protocol: "rss",
      endpoint: "https://hnrss.org/best",
      paramValues: {},
      status: "active",
      includeKeywords: [],
      excludeKeywords: []
    })
    const sourceB = repository.createSource(owner.id, {
      name: "arXiv",
      channelId: "builtin-arxiv",
      protocol: "rss",
      endpoint: "https://rss.arxiv.org/rss/cs.AI",
      paramValues: {},
      status: "active",
      includeKeywords: [],
      excludeKeywords: []
    })

    const task = repository.createTask(owner.id, {
      name: "AI 前沿追踪",
      status: "active",
      sourceIds: [sourceA.id, sourceB.id],
      scopeViewpointIds: [],
      relevanceThreshold: 0.6,
      maxPatchesPerRun: 20
    })

    repository.deleteSource(owner.id, sourceA.id)

    const updatedAfterFirstDelete = repository.getTask(owner.id, task.id)
    assert.deepEqual(updatedAfterFirstDelete?.sourceIds, [sourceB.id])
    assert.equal(updatedAfterFirstDelete?.status, "active")

    repository.deleteSource(owner.id, sourceB.id)

    const updatedAfterSecondDelete = repository.getTask(owner.id, task.id)
    assert.deepEqual(updatedAfterSecondDelete?.sourceIds, [])
    assert.equal(updatedAfterSecondDelete?.status, "paused")
    assert.equal(repository.listSources(owner.id).length, 0)
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test("repository.listArticleSourceFolders 会按来源生成文件夹并包含手动导入来源", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-article-folders-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const owner = repository.createUser({
      email: "article-folders@test.local",
      passwordHash: "hashed",
      name: "Article Folders"
    })

    const source = repository.createSource(owner.id, {
      name: "HN",
      channelId: "builtin-hn",
      protocol: "rss",
      endpoint: "https://hnrss.org/best",
      paramValues: {},
      status: "active",
      includeKeywords: [],
      excludeKeywords: []
    })

    repository.createArticle({
      userId: owner.id,
      entryId: "entry-1",
      sourceId: source.id,
      title: "HN A",
      sourceUrl: "https://example.com/hn-a",
      channelName: "HN",
      channelIcon: "",
      topics: [],
      summary: "summary",
      content: [],
      readProgress: 0,
      highlightCount: 0,
      status: "ready"
    })
    repository.createArticle({
      userId: owner.id,
      entryId: "entry-2",
      sourceId: "manual",
      title: "Manual A",
      sourceUrl: "https://example.com/manual-a",
      channelName: "Wait But Why",
      channelIcon: "",
      topics: [],
      summary: "summary",
      content: [],
      readProgress: 0,
      highlightCount: 0,
      status: "ready"
    })

    const folders = repository.listArticleSourceFolders(owner.id)

    assert.equal(folders.length, 2)
    assert.deepEqual(
      folders.map((item) => ({
        sourceId: item.sourceId,
        name: item.name,
        articleCount: item.articleCount
      })),
      [
        { sourceId: source.id, name: "HN", articleCount: 1 },
        { sourceId: "manual", name: "手动添加", articleCount: 1 }
      ]
    )
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test("repository.purgeExpiredArchives 不会清理已收藏文章", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-article-favorite-archive-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const articleOwner = repository.createUser({
      email: "article-favorite@test.local",
      passwordHash: "hashed",
      name: "Article Favorite"
    })

    const oldArchived = repository.createArticle({
      userId: articleOwner.id,
      entryId: "entry-1",
      sourceId: "manual",
      title: "文章 C",
      sourceUrl: "https://example.com/c",
      channelName: "Example",
      channelIcon: "",
      topics: [],
      summary: "summary",
      content: [{ id: "p1", type: "paragraph", text: "正文" }],
      readProgress: 0,
      highlightCount: 0,
      favorite: true,
      archived: true,
      archivedAt: "2025-01-01T00:00:00.000Z",
      status: "ready"
    })

    const purged = repository.purgeExpiredArchives(articleOwner.id, 30)

    assert.equal(purged.length, 0)
    assert.ok(repository.getArticle(articleOwner.id, oldArchived.id))
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test("repository.listViewpoints 在 metadataOnly 模式下不返回 articleBlocks", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-viewpoint-meta-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const demo = repository.getUserByEmail(
      process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local"
    )

    assert.ok(demo, "应存在默认演示账号")

    const items = repository.listViewpoints(demo!.id, { metadataOnly: true })

    assert.ok(items.length > 0)
    assert.equal(items.some((item) => item.articleBlocks !== undefined), false)
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test("repository.listHighlightReferences 返回高亮对应的观点块引用", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-highlight-references-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const user = repository.createUser({
      email: "highlight-ref@test.local",
      passwordHash: "hashed",
      name: "Highlight Ref"
    })

    const viewpoint = repository.createViewpoint({
      userId: user.id,
      title: "市场定义与叙事策略",
      isFolder: false,
      isCandidate: false,
      sortOrder: 1,
      articleContent: "",
      articleBlocks: [],
      relatedBookIds: []
    } as any)

    const highlight = repository.createHighlight({
      userId: user.id,
      bookId: "book-1",
      format: "EPUB",
      pageIndex: 2,
      content: "垄断常常伪装成更大的市场竞争。",
      color: "yellow"
    } as any)

    repository.updateViewpointBlocks(user.id, viewpoint.id, [
      {
        id: "block-quote-1",
        type: "quote",
        sortOrder: 1,
        text: "垄断常常伪装成更大的市场竞争。",
        sourceBookTitle: "Zero to One",
        sourceLocation: "第三章",
        highlightId: highlight.id
      }
    ])
    repository.upsertHighlightLink({
      highlightId: highlight.id,
      viewpointId: viewpoint.id,
      similarityScore: 0.92,
      confirmed: true
    })

    assert.deepEqual(repository.listHighlightReferences(user.id, highlight.id), [
      {
        viewpointId: viewpoint.id,
        viewpointTitle: "市场定义与叙事策略",
        blockId: "block-quote-1",
        blockType: "quote",
        blockText: "垄断常常伪装成更大的市场竞争。",
        sourceLocation: "第三章"
      }
    ])
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test("repository.deleteViewpoint 会持久删除主题并清理独立块文件", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-viewpoint-delete-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const demo = repository.getUserByEmail(
      process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local"
    )

    assert.ok(demo, "应存在默认演示账号")

    const created = repository.createViewpoint({
      userId: demo!.id,
      title: "待删除主题",
      isFolder: false,
      isCandidate: false,
      sortOrder: 999,
      articleContent: "",
      articleBlocks: [
        { id: "b-1", type: "paragraph", text: "temp", sortOrder: 0 }
      ],
      relatedBookIds: []
    } as any)

    const blocksPath = join(dataDir, "viewpoint-blocks", demo!.id, `${created.id}.json`)
    assert.equal(existsSync(blocksPath), true)

    repository.deleteViewpoint(demo!.id, created.id)

    assert.equal(repository.getViewpoint(demo!.id, created.id), undefined)
    assert.equal(
      repository.listViewpoints(demo!.id, { metadataOnly: true }).some((item) => item.id === created.id),
      false
    )
    assert.equal(existsSync(blocksPath), false)
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})
