import { randomUUID, createHash } from "node:crypto"
import { readDatabase, mutateDatabase } from "@/src/server/store/db"
import {
  DEFAULT_APP_KEYBOARD_SHORTCUTS,
  getEffectiveKeyboardShortcuts
} from "@/src/lib/keyboard-shortcuts"
import { encryptValue } from "@/src/server/lib/crypto"
import {
  getDefaultShareEndpointConfig,
  shareLinkExpired
} from "@/src/server/services/share/share-links"
import { normalizeUrl } from "@/src/server/services/scout/url-utils"
import type {
  AggregateJob,
  Annotation,
  AnnotationConfig,
  ArticleTranslation,
  ArticleTopic,
  Book,
  BookTocTranslation,
  BookTranslation,
  Highlight,
  HighlightViewpoint,
  ImportedNote,
  ImportJob,
  ImportSource,
  ModelBinding,
  ModelConfig,
  NoteBlock,
  NoteViewpointLink,
  PublishRecord,
  PublishTarget,
  PublishTask,
  ReaderSettings,
  ScoutArticle,
  ScoutChannel,
  ScoutConfig,
  ScoutCredential,
  ScoutEntry,
  ScoutJob,
  ScoutPatch,
  ScoutSource,
  ScoutTask,
  ShareEndpointConfig,
  ShareLink,
  StorageConfig,
  User,
  Viewpoint,
  ViewpointRelation
} from "@/src/server/store/types"

function now() {
  return new Date().toISOString()
}

function normalizeHighlight<T extends Partial<Highlight>>(highlight: T): T & Pick<Highlight, "contentMode"> {
  return {
    ...highlight,
    contentMode: highlight.contentMode ?? "original"
  }
}

function samePdfRects(left?: Highlight["pdfRects"], right?: Highlight["pdfRects"]) {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? [])
}

function isSameHighlightIdentity(
  current: Highlight,
  incoming: Omit<Highlight, "id" | "createdAt" | "status">
) {
  return (
    current.userId === incoming.userId &&
    current.bookId === incoming.bookId &&
    (current.sourceType ?? "book") === (incoming.sourceType ?? "book") &&
    (current.articleId ?? "") === (incoming.articleId ?? "") &&
    current.format === incoming.format &&
    current.contentMode === (incoming.contentMode ?? "original") &&
    (current.targetLanguage ?? "") === (incoming.targetLanguage ?? "") &&
    (current.pageIndex ?? -1) === (incoming.pageIndex ?? -1) &&
    (current.chapterHref ?? "") === (incoming.chapterHref ?? "") &&
    (current.cfiRange ?? "") === (incoming.cfiRange ?? "") &&
    (current.paraOffsetStart ?? -1) === (incoming.paraOffsetStart ?? -1) &&
    (current.paraOffsetEnd ?? -1) === (incoming.paraOffsetEnd ?? -1) &&
    (current.counterpartParaOffsetStart ?? -1) === (incoming.counterpartParaOffsetStart ?? -1) &&
    (current.counterpartParaOffsetEnd ?? -1) === (incoming.counterpartParaOffsetEnd ?? -1) &&
    (current.content ?? "") === incoming.content &&
    (current.counterpartContent ?? "") === (incoming.counterpartContent ?? "") &&
    (current.imageUrl ?? "") === (incoming.imageUrl ?? "") &&
    (current.imageObjectKey ?? "") === (incoming.imageObjectKey ?? "") &&
    samePdfRects(current.pdfRects, incoming.pdfRects)
  )
}

function sortByDate<T>(
  items: T[],
  ...dateFields: string[]
): T[] {
  const fields = dateFields.length > 0
    ? dateFields
    : ["updatedAt", "executedAt", "createdAt"]
  return [...items].sort((left, right) => {
    const l = left as Record<string, unknown>
    const r = right as Record<string, unknown>
    const rVal = fields.reduce<string>((acc, f) => acc || (r[f] as string) || "", "")
    const lVal = fields.reduce<string>((acc, f) => acc || (l[f] as string) || "", "")
    return rVal.localeCompare(lVal)
  })
}

function pruneArticleAssociatedRecords(
  database: ReturnType<typeof readDatabase>,
  userId: string,
  articleIds: string[],
  options: {
    keepShareLinks?: boolean
  } = {}
) {
  if (articleIds.length === 0) {
    return
  }
  const articleIdSet = new Set(articleIds)
  database.highlights = database.highlights.filter((item) => {
    if (item.userId !== userId) {
      return true
    }
    return !(
      item.articleId && articleIdSet.has(item.articleId)
    ) && !(
      item.sourceType === "article" && articleIdSet.has(item.bookId)
    )
  })
  database.articleTranslations = (database.articleTranslations || []).filter(
    (item) => !(item.userId === userId && articleIdSet.has(item.articleId))
  )
  if (!options.keepShareLinks) {
    database.shareLinks = (database.shareLinks || []).filter(
      (item) =>
        !(
          item.ownerUserId === userId &&
          item.resourceType === "article" &&
          articleIdSet.has(item.resourceId)
        )
    )
  }
}

export const repository = {
  getUserByEmail(email: string) {
    return readDatabase().users.find((item) => item.email === email && !item.deletedAt)
  },
  getUserById(userId: string) {
    return readDatabase().users.find((item) => item.id === userId && !item.deletedAt)
  },
  createUser(input: Pick<User, "email" | "passwordHash" | "name">) {
    return mutateDatabase((database) => {
      const user: User = {
        id: randomUUID(),
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
        aggregateSchedule: "manual",
        createdAt: now()
      }
      database.users.push(user)
      database.readerSettings.push({
        userId: user.id,
        fontSize: 16,
        lineHeight: 1.75,
        fontFamily: "serif",
        theme: "night",
        navigationMode: "horizontal",
        translationView: "original",
        highlightShortcuts: DEFAULT_APP_KEYBOARD_SHORTCUTS.reader,
        keyboardShortcuts: DEFAULT_APP_KEYBOARD_SHORTCUTS
      })
      database.storageConfigs.push({
        userId: user.id,
        useCustom: false,
        region: "local"
      })
      database.aggregateJobs.push({
        id: randomUUID(),
        userId: user.id,
        status: "IDLE",
        stage: "idle",
        processed: 0,
        total: 0,
        updatedAt: now()
      })
      return user
    })
  },
  updateUser(userId: string, updates: Partial<User>) {
    return mutateDatabase((database) => {
      const user = database.users.find((item) => item.id === userId)
      if (!user) {
        return null
      }
      Object.assign(user, updates)
      return user
    })
  },
  listBooks(userId: string, search?: string, tag?: string) {
    return sortByDate(
      readDatabase().books.filter((item) => {
        if (item.userId !== userId) {
          return false
        }
        if (search && !`${item.title} ${item.author ?? ""}`.includes(search)) {
          return false
        }
        if (tag && !item.tags.includes(tag)) {
          return false
        }
        return true
      })
    )
  },
  getBook(userId: string, bookId: string) {
    return readDatabase().books.find(
      (item) => item.userId === userId && item.id === bookId
    )
  },
  createBook(book: Omit<Book, "createdAt"> & { createdAt?: string }) {
    return mutateDatabase((database) => {
      const entry: Book = {
        ...book,
        id: book.id || randomUUID(),
        createdAt: book.createdAt ?? now()
      }
      database.books.push(entry)
      return entry
    })
  },
  updateBook(userId: string, bookId: string, updates: Partial<Book>) {
    return mutateDatabase((database) => {
      const book = database.books.find(
        (item) => item.id === bookId && item.userId === userId
      )
      if (!book) {
        return null
      }
      Object.assign(book, updates)
      return book
    })
  },
  deleteBook(userId: string, bookId: string) {
    return mutateDatabase((database) => {
      database.books = database.books.filter(
        (item) => !(item.userId === userId && item.id === bookId)
      )
      database.highlights = database.highlights.filter(
        (item) => !(item.userId === userId && item.bookId === bookId)
      )
      database.translations = (database.translations || []).filter(
        (item) => !(item.userId === userId && item.bookId === bookId)
      )
      database.tocTranslations = (database.tocTranslations || []).filter(
        (item) => !(item.userId === userId && item.bookId === bookId)
      )
    })
  },
  listHighlightsByBook(userId: string, bookId: string) {
    return sortByDate(
      readDatabase().highlights.filter(
        (item) => item.userId === userId && item.bookId === bookId
      )
    ).map((item) => normalizeHighlight(item))
  },
  /** 按状态查询用户的所有划线（不依赖 bookId） */
  listHighlightsByStatus(userId: string, status: Highlight["status"]) {
    return sortByDate(
      readDatabase().highlights.filter(
        (item) => item.userId === userId && item.status === status
      )
    ).map((item) => normalizeHighlight(item))
  },
  listUnconfirmedHighlights(userId: string, viewpointId: string) {
    const database = readDatabase()
    const linkMap = database.highlightViewpoints.filter(
      (item) => item.viewpointId === viewpointId && !item.confirmed
    )
    return linkMap
      .map((link) => {
        const highlight = database.highlights.find((item) => item.id === link.highlightId)
        if (!highlight) {
          return null
        }
        return {
          ...normalizeHighlight(highlight),
          similarityScore: link.similarityScore
        }
      })
      .filter(Boolean)
  },
  createHighlight(input: Omit<Highlight, "id" | "createdAt" | "status">) {
    return mutateDatabase((database) => {
      const normalized = normalizeHighlight(input)
      const existing = database.highlights.find((item) =>
        isSameHighlightIdentity(item, normalized)
      )
      if (existing) {
        return normalizeHighlight(existing)
      }
      const highlight: Highlight = {
        ...normalized,
        id: randomUUID(),
        createdAt: now(),
        status: "PENDING"
      }
      database.highlights.push(highlight)
      if (highlight.sourceType === "article" && highlight.articleId) {
        const article = database.scoutArticles.find(
          (item) => item.id === highlight.articleId && item.userId === highlight.userId
        )
        if (article) {
          article.highlightCount += 1
        }
      }
      return highlight
    })
  },
  updateHighlight(userId: string, highlightId: string, updates: Partial<Highlight>) {
    return mutateDatabase((database) => {
      const highlight = database.highlights.find(
        (item) => item.id === highlightId && item.userId === userId
      )
      if (!highlight) {
        return null
      }
      Object.assign(highlight, updates)
      return highlight
    })
  },
  deleteHighlight(userId: string, highlightId: string) {
    return mutateDatabase((database) => {
      const highlight = database.highlights.find(
        (item) => item.userId === userId && item.id === highlightId
      )
      if (!highlight) {
        return
      }

      // 找到关联的主题 ID
      const linkedViewpointIds = database.highlightViewpoints
        .filter((item) => item.highlightId === highlightId)
        .map((item) => item.viewpointId)

      // 从主题的 articleBlocks 中移除引用此划线的块（quote/highlight）及其紧跟的 insight 批注块
      for (const vpId of linkedViewpointIds) {
        const viewpoint = database.viewpoints.find(
          (item) => item.id === vpId && item.userId === userId
        )
        if (!viewpoint?.articleBlocks) {
          continue
        }

        const removedIds = new Set<string>()
      // 标记引用此划线的块
      for (const block of viewpoint.articleBlocks) {
        if (
          (block.type === "quote" || block.type === "highlight" || block.type === "image") &&
          "highlightId" in block &&
          block.highlightId === highlightId
        ) {
          removedIds.add(block.id)
        }
        }

        // 同时移除紧跟在引用块后面的 insight 批注块
        const sorted = [...viewpoint.articleBlocks].sort((a, b) => a.sortOrder - b.sortOrder)
        for (let i = 0; i < sorted.length; i++) {
          if (removedIds.has(sorted[i].id) && sorted[i + 1]?.type === "insight") {
            removedIds.add(sorted[i + 1].id)
          }
        }

        viewpoint.articleBlocks = viewpoint.articleBlocks.filter(
          (block) => !removedIds.has(block.id)
        )
        viewpoint.highlightCount = Math.max(0, viewpoint.highlightCount - 1)

        // 重算 relatedBookIds：只保留仍有关联划线的 bookId
        const remainingBookIds = new Set(
          database.highlightViewpoints
            .filter((hv) => hv.viewpointId === vpId && hv.highlightId !== highlightId)
            .map((hv) => database.highlights.find((h) => h.id === hv.highlightId)?.bookId)
            .filter(Boolean) as string[]
        )
        viewpoint.relatedBookIds = viewpoint.relatedBookIds.filter(
          (bookId) => remainingBookIds.has(bookId)
        )
      }

      // 文章划线计数递减
      if (highlight.sourceType === "article" && highlight.articleId) {
        const article = database.scoutArticles.find(
          (a) => a.id === highlight.articleId && a.userId === userId
        )
        if (article) {
          article.highlightCount = Math.max(0, article.highlightCount - 1)
        }
      }

      // 删除划线本体和关联记录
      database.highlights = database.highlights.filter(
        (item) => !(item.userId === userId && item.id === highlightId)
      )
      database.highlightViewpoints = database.highlightViewpoints.filter(
        (item) => item.highlightId !== highlightId
      )
    })
  },
  listViewpoints(userId: string, options: {
    metadataOnly?: boolean
  } = {}) {
    const database = readDatabase({
      hydrateViewpointBlocks: !options.metadataOnly
    })
    const viewpoints = database.viewpoints
      .filter((item) => item.userId === userId)
      .sort((left, right) => left.sortOrder - right.sortOrder)
    if (!options.metadataOnly) {
      return viewpoints
    }
    return viewpoints.map(({ articleBlocks: _articleBlocks, ...viewpoint }) => viewpoint)
  },
  getViewpoint(userId: string, viewpointId: string) {
    return readDatabase().viewpoints.find(
      (item) => item.userId === userId && item.id === viewpointId
    )
  },
  createViewpoint(input: Omit<Viewpoint, "id" | "createdAt" | "highlightCount">) {
    return mutateDatabase((database) => {
      const viewpoint: Viewpoint = {
        ...input,
        id: randomUUID(),
        highlightCount: 0,
        createdAt: now()
      }
      database.viewpoints.push(viewpoint)
      return viewpoint
    })
  },
  updateViewpoint(userId: string, viewpointId: string, updates: Partial<Viewpoint>) {
    return mutateDatabase((database) => {
      const viewpoint = database.viewpoints.find(
        (item) => item.id === viewpointId && item.userId === userId
      )
      if (!viewpoint) {
        return null
      }
      Object.assign(viewpoint, updates)
      return viewpoint
    })
  },
  deleteViewpoint(userId: string, viewpointId: string) {
    return mutateDatabase((database) => {
      // 收集即将断开关联的高亮 ID
      const affectedHighlightIds = database.highlightViewpoints
        .filter((item) => item.viewpointId === viewpointId)
        .map((item) => item.highlightId)

      database.viewpoints = database.viewpoints.filter(
        (item) => !(item.id === viewpointId && item.userId === userId)
      )
      database.highlightViewpoints = database.highlightViewpoints.filter(
        (item) => item.viewpointId !== viewpointId
      )
      database.relations = database.relations.filter(
        (item) => item.sourceId !== viewpointId && item.targetId !== viewpointId
      )

      // 清理孤立高亮：全部关联观点都已删除时，删除高亮本身
      const orphanIds = affectedHighlightIds.filter(
        (hId) => !database.highlightViewpoints.some((hv) => hv.highlightId === hId)
      )
      if (orphanIds.length > 0) {
        const orphanSet = new Set(orphanIds)
        database.highlights = database.highlights.filter(
          (item) => !orphanSet.has(item.id)
        )
      }
    })
  },
  listRelatedViewpoints(userId: string, viewpointId: string) {
    const database = readDatabase()
    return database.relations
      .filter((item) => item.sourceId === viewpointId)
      .map((item) => ({
        ...database.viewpoints.find(
          (viewpoint) => viewpoint.id === item.targetId && viewpoint.userId === userId
        ),
        weight: item.weight
      }))
      .filter(Boolean)
      .slice(0, 5)
  },
  getGraph(userId: string) {
    const database = readDatabase()
    return {
      nodes: database.viewpoints
        .filter((item) => item.userId === userId && !item.isFolder)
        .map((item) => ({
          id: item.id,
          title: item.title,
          highlightCount: item.highlightCount,
          bookIds: item.relatedBookIds,
          lastSynthesizedAt: item.lastSynthesizedAt ?? item.createdAt
        })),
      links: database.relations
        .filter((item) => {
          const source = database.viewpoints.find((viewpoint) => viewpoint.id === item.sourceId)
          return source?.userId === userId
        })
        .map((item) => ({
          source: item.sourceId,
          target: item.targetId,
          weight: item.weight
        }))
    }
  },
  getReaderSettings(userId: string) {
    const settings = readDatabase().readerSettings.find((item) => item.userId === userId)
    if (!settings) {
      return settings
    }
    return {
      ...settings,
      highlightShortcuts: getEffectiveKeyboardShortcuts(
        settings.keyboardShortcuts,
        settings.highlightShortcuts
      ).reader,
      keyboardShortcuts: getEffectiveKeyboardShortcuts(
        settings.keyboardShortcuts,
        settings.highlightShortcuts
      )
    }
  },
  updateReaderSettings(userId: string, updates: Partial<ReaderSettings>) {
    return mutateDatabase((database) => {
      const settings = database.readerSettings.find((item) => item.userId === userId)
      if (!settings) {
        return null
      }
      Object.assign(settings, updates)
      const shortcuts = getEffectiveKeyboardShortcuts(
        settings.keyboardShortcuts,
        settings.highlightShortcuts
      )
      settings.keyboardShortcuts = shortcuts
      settings.highlightShortcuts = shortcuts.reader
      return settings
    })
  },
  listBookTranslations(userId: string, bookId: string): BookTranslation[] {
    return sortByDate(
      (readDatabase().translations || []).filter(
        (item) => item.userId === userId && item.bookId === bookId
      )
    ) as BookTranslation[]
  },
  listBookTocTranslations(userId: string, bookId: string): BookTocTranslation[] {
    return sortByDate(
      (readDatabase().tocTranslations || []).filter(
        (item) => item.userId === userId && item.bookId === bookId
      )
    ) as BookTocTranslation[]
  },
  upsertBookTranslation(
    input: Omit<BookTranslation, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ) {
    return mutateDatabase((database) => {
      if (!database.translations) {
        database.translations = []
      }
      const existing = database.translations.find((item) =>
        item.userId === input.userId &&
        item.bookId === input.bookId &&
        item.sectionId === input.sectionId &&
        item.sourceHash === input.sourceHash &&
        item.targetLanguage === input.targetLanguage
      )
      if (existing) {
        Object.assign(existing, input, {
          updatedAt: now()
        })
        return existing
      }
      const entry: BookTranslation = {
        ...input,
        id: input.id || randomUUID(),
        createdAt: now(),
        updatedAt: now()
      }
      database.translations.push(entry)
      return entry
    })
  },
  upsertBookTocTranslation(
    input: Omit<BookTocTranslation, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ) {
    return mutateDatabase((database) => {
      if (!database.tocTranslations) {
        database.tocTranslations = []
      }
      const existing = database.tocTranslations.find((item) =>
        item.userId === input.userId &&
        item.bookId === input.bookId &&
        item.sourceHash === input.sourceHash &&
        item.targetLanguage === input.targetLanguage
      )
      if (existing) {
        Object.assign(existing, input, {
          updatedAt: now()
        })
        return existing
      }
      const entry: BookTocTranslation = {
        ...input,
        id: input.id || randomUUID(),
        createdAt: now(),
        updatedAt: now()
      }
      database.tocTranslations.push(entry)
      return entry
    })
  },
  listArticleTranslations(userId: string, articleId: string): ArticleTranslation[] {
    return (readDatabase().articleTranslations || []).filter(
      (item) => item.userId === userId && item.articleId === articleId
    )
  },
  upsertArticleTranslation(
    input: Omit<ArticleTranslation, "id" | "createdAt" | "updatedAt">
  ): ArticleTranslation {
    return mutateDatabase((database) => {
      if (!database.articleTranslations) {
        database.articleTranslations = []
      }
      const existing = database.articleTranslations.find((item) =>
        item.userId === input.userId &&
        item.articleId === input.articleId &&
        item.sourceHash === input.sourceHash &&
        item.targetLanguage === input.targetLanguage
      )
      if (existing) {
        Object.assign(existing, input, { updatedAt: now() })
        return existing
      }
      const entry: ArticleTranslation = {
        ...input,
        id: randomUUID(),
        createdAt: now(),
        updatedAt: now()
      }
      database.articleTranslations.push(entry)
      return entry
    })
  },
  listModelConfigs(userId: string) {
    return readDatabase().modelConfigs
      .filter((item) => item.userId === userId)
      .map((item) => ({
        ...item,
        category:
          (item as ModelConfig).category ||
          ((item as any).usage === "embedding" ? "embedding" : "language"),
        name: (item as ModelConfig).name || (item as any).modelName || "未命名模型"
      }))
  },
  saveModelConfig(
    userId: string,
    input: Omit<ModelConfig, "userId" | "id"> & { id?: string; apiKey?: string }
  ) {
    return mutateDatabase((database) => {
      const existing = database.modelConfigs.find(
        (item) => item.userId === userId && item.id === input.id
      )
      if (existing) {
        existing.category = input.category
        existing.name = input.name
        existing.baseUrl = input.baseUrl
        existing.modelName = input.modelName
        existing.apiKey = input.apiKey ? encryptValue(input.apiKey) : existing.apiKey
        return existing
      }
      const entry: ModelConfig = {
        id: input.id || randomUUID(),
        userId,
        category: input.category,
        name: input.name,
        baseUrl: input.baseUrl,
        apiKey: input.apiKey ? encryptValue(input.apiKey) : "",
        modelName: input.modelName
      }
      database.modelConfigs.push(entry)
      return entry
    })
  },
  deleteModelConfig(userId: string, modelId: string) {
    return mutateDatabase((database) => {
      database.modelConfigs = database.modelConfigs.filter(
        (item) => !(item.userId === userId && item.id === modelId)
      )
      database.modelBindings = (database.modelBindings || []).filter(
        (item) => !(item.userId === userId && item.modelId === modelId)
      )
    })
  },
  listModelBindings(userId: string): ModelBinding[] {
    return (readDatabase().modelBindings || []).filter((item) => item.userId === userId)
  },
  saveModelBinding(
    userId: string,
    input: Omit<ModelBinding, "id" | "userId">
  ) {
    return mutateDatabase((database) => {
      if (!database.modelBindings) {
        database.modelBindings = []
      }
      const existing = database.modelBindings.find(
        (item) => item.userId === userId && item.feature === input.feature
      )
      if (existing) {
        existing.modelId = input.modelId
        return existing
      }
      const entry: ModelBinding = {
        id: randomUUID(),
        userId,
        feature: input.feature,
        modelId: input.modelId
      }
      database.modelBindings.push(entry)
      return entry
    })
  },
  getModelByFeature(userId: string, feature: ModelBinding["feature"]) {
    const database = readDatabase()
    const binding = (database.modelBindings || []).find(
      (item) => item.userId === userId && item.feature === feature
    )
    if (!binding) {
      return null
    }
    return database.modelConfigs.find(
      (item) => item.userId === userId && item.id === binding.modelId
    ) || null
  },
  getStorageConfig(userId: string) {
    return readDatabase().storageConfigs.find((item) => item.userId === userId)
  },
  saveStorageConfig(userId: string, input: StorageConfig) {
    return mutateDatabase((database) => {
      const existing = database.storageConfigs.find((item) => item.userId === userId)
      if (existing) {
        Object.assign(existing, {
          ...input,
          secretKey: input.secretKey ? encryptValue(input.secretKey) : existing.secretKey
        })
        return existing
      }
      database.storageConfigs.push({
        ...input,
        secretKey: input.secretKey ? encryptValue(input.secretKey) : ""
      })
      return input
    })
  },
  getShareEndpointConfig() {
    return readDatabase().shareEndpointConfig ?? getDefaultShareEndpointConfig()
  },
  saveShareEndpointConfig(input: ShareEndpointConfig) {
    return mutateDatabase((database) => {
      database.shareEndpointConfig = {
        host: input.host.trim(),
        port: input.port
      }
      return database.shareEndpointConfig
    })
  },
  createShareLink(input: Omit<ShareLink, "id" | "createdAt" | "lastAccessedAt" | "revokedAt">) {
    return mutateDatabase((database) => {
      const item: ShareLink = {
        id: randomUUID(),
        token: input.token,
        ownerUserId: input.ownerUserId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        expiresAt: input.expiresAt ?? null,
        createdAt: now()
      }
      database.shareLinks.push(item)
      return item
    })
  },
  getShareLinkByToken(token: string) {
    return readDatabase().shareLinks.find((item) => item.token === token) ?? null
  },
  getActiveShareLinkByToken(token: string) {
    const item = readDatabase().shareLinks.find((entry) => entry.token === token)
    if (!item) {
      return null
    }
    if (item.revokedAt || shareLinkExpired(item.expiresAt)) {
      return null
    }
    return item
  },
  touchShareLink(token: string) {
    return mutateDatabase((database) => {
      const item = database.shareLinks.find((entry) => entry.token === token)
      if (!item) {
        return null
      }
      item.lastAccessedAt = now()
      return item
    })
  },
  listPublishTargets(userId: string) {
    return sortByDate(
      readDatabase().publishTargets.filter((item) => item.userId === userId)
    )
  },
  createPublishTarget(userId: string, input: Omit<PublishTarget, "id" | "userId" | "createdAt">) {
    return mutateDatabase((database) => {
      const target: PublishTarget = {
        id: randomUUID(),
        userId,
        name: input.name,
        type: input.type,
        endpointUrl: input.endpointUrl,
        authHeader: input.authHeader ? encryptValue(input.authHeader) : "",
        extraConfig: input.extraConfig,
        createdAt: now()
      }
      database.publishTargets.push(target)
      return target
    })
  },
  updatePublishTarget(userId: string, targetId: string, updates: Partial<PublishTarget>) {
    return mutateDatabase((database) => {
      const target = database.publishTargets.find(
        (item) => item.id === targetId && item.userId === userId
      )
      if (!target) {
        return null
      }
      Object.assign(target, {
        ...updates,
        authHeader: updates.authHeader ? encryptValue(updates.authHeader) : target.authHeader
      })
      return target
    })
  },
  deletePublishTarget(userId: string, targetId: string) {
    return mutateDatabase((database) => {
      database.publishTargets = database.publishTargets.filter(
        (item) => !(item.userId === userId && item.id === targetId)
      )
    })
  },
  listPublishTasks(userId: string) {
    return sortByDate(
      readDatabase().publishTasks.filter((item) => item.userId === userId)
    )
  },
  createPublishTask(userId: string, input: Omit<PublishTask, "id" | "userId" | "createdAt">) {
    return mutateDatabase((database) => {
      const task: PublishTask = {
        ...input,
        id: randomUUID(),
        userId,
        createdAt: now()
      }
      database.publishTasks.push(task)
      return task
    })
  },
  updatePublishTask(userId: string, taskId: string, updates: Partial<PublishTask>) {
    return mutateDatabase((database) => {
      const task = database.publishTasks.find(
        (item) => item.id === taskId && item.userId === userId
      )
      if (!task) {
        return null
      }
      Object.assign(task, updates)
      return task
    })
  },
  deletePublishTask(userId: string, taskId: string) {
    return mutateDatabase((database) => {
      database.publishTasks = database.publishTasks.filter(
        (item) => !(item.userId === userId && item.id === taskId)
      )
      database.publishRecords = database.publishRecords.filter(
        (item) => item.taskId !== taskId
      )
    })
  },
  createPublishRecord(input: Omit<PublishRecord, "id" | "executedAt" | "articleVersion"> & { content: string }) {
    return mutateDatabase((database) => {
      const record: PublishRecord = {
        id: randomUUID(),
        taskId: input.taskId,
        triggeredBy: input.triggeredBy,
        status: input.status,
        errorMsg: input.errorMsg,
        articleVersion: createHash("sha1").update(input.content).digest("hex"),
        executedAt: now()
      }
      database.publishRecords.push(record)
      return record
    })
  },
  listPublishRecords(taskId: string): PublishRecord[] {
    return sortByDate(
      readDatabase().publishRecords.filter((item) => item.taskId === taskId)
    ) as PublishRecord[]
  },
  getAggregateJob(userId: string) {
    return readDatabase().aggregateJobs.find((item) => item.userId === userId)
  },
  updateAggregateJob(userId: string, updates: Partial<AggregateJob>) {
    return mutateDatabase((database) => {
      const job = database.aggregateJobs.find((item) => item.userId === userId)
      if (!job) {
        return null
      }
      Object.assign(job, updates, {
        updatedAt: now()
      })
      return job
    })
  },
  upsertHighlightLink(entry: HighlightViewpoint) {
    return mutateDatabase((database) => {
      const existing = database.highlightViewpoints.find(
        (item) =>
          item.highlightId === entry.highlightId &&
          item.viewpointId === entry.viewpointId
      )
      if (existing) {
        existing.similarityScore = entry.similarityScore
        existing.confirmed = entry.confirmed
        return existing
      }
      database.highlightViewpoints.push(entry)
      return entry
    })
  },
  replaceRelations(userId: string, relations: ViewpointRelation[]) {
    return mutateDatabase((database) => {
      const viewpointIds = new Set(
        database.viewpoints
          .filter((item) => item.userId === userId)
          .map((item) => item.id)
      )
      database.relations = database.relations.filter(
        (item) => !viewpointIds.has(item.sourceId) && !viewpointIds.has(item.targetId)
      )
      database.relations.push(...relations)
    })
  },

  // ---- 批注相关 ----

  listAnnotations(userId: string, viewpointId: string) {
    return sortByDate(
      (readDatabase().annotations || []).filter(
        (item) => item.userId === userId && item.viewpointId === viewpointId
      )
    ) as Annotation[]
  },
  createAnnotation(input: Omit<Annotation, "id" | "createdAt" | "status">) {
    return mutateDatabase((database) => {
      if (!database.annotations) {
        database.annotations = []
      }
      const annotation: Annotation = {
        ...input,
        id: randomUUID(),
        status: "pending",
        createdAt: now()
      }
      database.annotations.push(annotation)
      return annotation
    })
  },
  updateAnnotation(userId: string, annotationId: string, updates: Partial<Annotation>) {
    return mutateDatabase((database) => {
      const annotation = (database.annotations || []).find(
        (item) => item.id === annotationId && item.userId === userId
      )
      if (!annotation) {
        return null
      }
      Object.assign(annotation, updates)
      return annotation
    })
  },
  listPendingAnnotations(userId: string) {
    return (readDatabase().annotations || []).filter(
      (item) => item.userId === userId && (item.status === "pending" || item.status === "processing")
    )
  },
  getAnnotationConfig(userId: string) {
    return (readDatabase().annotationConfigs || []).find(
      (item) => item.userId === userId
    )
  },
  saveAnnotationConfig(userId: string, input: Omit<AnnotationConfig, "userId">) {
    return mutateDatabase((database) => {
      if (!database.annotationConfigs) {
        database.annotationConfigs = []
      }
      const existing = database.annotationConfigs.find(
        (item) => item.userId === userId
      )
      if (existing) {
        Object.assign(existing, input)
        return existing
      }
      const config: AnnotationConfig = { ...input, userId }
      database.annotationConfigs.push(config)
      return config
    })
  },

  /** 更新观点的 articleBlocks */
  updateViewpointBlocks(userId: string, viewpointId: string, blocks: NoteBlock[]) {
    return mutateDatabase((database) => {
      const viewpoint = database.viewpoints.find(
        (item) => item.id === viewpointId && item.userId === userId
      )
      if (!viewpoint) {
        return null
      }
      viewpoint.articleBlocks = blocks
      return viewpoint
    })
  },

  // ─── Scout: 文章 ───

  listArticles(
    userId: string,
    opts?: { topicId?: string; search?: string; filter?: string; sortBy?: string; page?: number; pageSize?: number }
  ) {
    const { topicId, search, filter, sortBy = "lastRead", page = 1, pageSize = 20 } = opts ?? {}
    const filtered = readDatabase().scoutArticles.filter((item) => {
        if (item.userId !== userId) {
          return false
        }
        if (topicId && !item.topics.includes(topicId)) {
          return false
        }
        if (search && !`${item.title} ${item.author ?? ""}`.toLowerCase().includes(search.toLowerCase())) {
          return false
        }
        if (filter === "unread") {
          return !item.reading && !item.archived
        }
        if (filter === "reading") {
          return !!item.reading && !item.archived
        }
        if (filter === "favorite") {
          return !!item.favorite && !item.archived
        }
        if (filter === "archived") {
          return !!item.archived
        }
        if (!filter || filter === "all") {
          return !item.archived
        }
        return true
      })
    const all = sortBy === "created"
      ? sortByDate(filtered, "createdAt")
      : [...filtered].sort((a, b) => {
        const aTime = a.lastReadAt || a.createdAt
        const bTime = b.lastReadAt || b.createdAt
        return bTime.localeCompare(aTime)
      })
    const total = all.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(Math.max(1, page), totalPages)
    const items = all.slice((safePage - 1) * pageSize, safePage * pageSize)
    return { items, total, page: safePage, pageSize, totalPages }
  },
  getArticle(userId: string, articleId: string) {
    return readDatabase().scoutArticles.find(
      (item) => item.userId === userId && item.id === articleId
    )
  },
  findArticleBySourceUrl(userId: string, sourceUrl: string) {
    const normalized = normalizeUrl(sourceUrl)
    return readDatabase().scoutArticles.find(
      (item) => item.userId === userId && normalizeUrl(item.sourceUrl) === normalized
    ) ?? null
  },
  createArticle(input: Omit<ScoutArticle, "id" | "createdAt"> & { id?: string }) {
    return mutateDatabase((database) => {
      const article: ScoutArticle = {
        ...input,
        id: input.id || randomUUID(),
        createdAt: now()
      }
      database.scoutArticles.push(article)
      return article
    })
  },
  updateArticle(userId: string, articleId: string, updates: Partial<ScoutArticle>) {
    return mutateDatabase((database) => {
      const article = database.scoutArticles.find(
        (item) => item.id === articleId && item.userId === userId
      )
      if (!article) {
        return null
      }
      Object.assign(article, updates)
      return article
    })
  },
  deleteArticle(userId: string, articleId: string) {
    return mutateDatabase((database) => {
      const article = database.scoutArticles.find(
        (item) => item.userId === userId && item.id === articleId
      ) || null
      database.scoutArticles = database.scoutArticles.filter(
        (item) => !(item.userId === userId && item.id === articleId)
      )
      pruneArticleAssociatedRecords(database, userId, [articleId])
      return article
    })
  },
  clearArticleDerivedData(
    userId: string,
    articleId: string,
    options: {
      keepShareLinks?: boolean
    } = {}
  ) {
    return mutateDatabase((database) => {
      pruneArticleAssociatedRecords(database, userId, [articleId], options)
      return database.scoutArticles.find(
        (item) => item.userId === userId && item.id === articleId
      ) || null
    })
  },
  /** 清理超过保留天数的归档文章 */
  purgeExpiredArchives(userId: string, retentionDays: number) {
    const cutoff = Date.now() - retentionDays * 86_400_000
    return mutateDatabase((database) => {
      const purged: ScoutArticle[] = []
      database.scoutArticles = database.scoutArticles.filter((item) => {
        if (item.userId !== userId || !item.archived) {
          return true
        }
        if (item.favorite) {
          return true
        }
        const archivedTime = item.archivedAt
          ? new Date(item.archivedAt).getTime()
          : new Date(item.createdAt).getTime()
        if (archivedTime > cutoff) {
          return true
        }
        purged.push(item)
        return false
      })
      pruneArticleAssociatedRecords(
        database,
        userId,
        purged.map((item) => item.id)
      )
      return purged
    })
  },
  /** 将已读完超过指定天数的文章自动归档 */
  autoArchiveFinished(userId: string, afterDays: number) {
    const cutoff = Date.now() - afterDays * 86_400_000
    const now = new Date().toISOString()
    return mutateDatabase((database) => {
      for (const item of database.scoutArticles) {
        if (item.userId !== userId || item.archived || item.readProgress < 1) {
          continue
        }
        const readTime = item.lastReadAt
          ? new Date(item.lastReadAt).getTime()
          : 0
        if (readTime > 0 && readTime < cutoff) {
          item.archived = true
          item.archivedAt = now
        }
      }
    })
  },

  // ─── Scout: 主题 ───

  listArticleTopics(userId: string) {
    const database = readDatabase()
    const counts = new Map<string, number>()
    database.scoutArticles
      .filter((item) => item.userId === userId)
      .forEach((article) => {
        article.topics.forEach((topicId) => {
          counts.set(topicId, (counts.get(topicId) ?? 0) + 1)
        })
      })
    return database.articleTopics
      .filter((item) => item.userId === userId)
      .map((item) => ({
        ...item,
        articleCount: counts.get(item.id) ?? 0
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  },
  createArticleTopic(userId: string, input: Omit<ArticleTopic, "id" | "userId" | "createdAt" | "articleCount">) {
    return mutateDatabase((database) => {
      const topic: ArticleTopic = {
        ...input,
        id: randomUUID(),
        userId,
        articleCount: 0,
        createdAt: now()
      }
      database.articleTopics.push(topic)
      return topic
    })
  },
  updateArticleTopic(userId: string, topicId: string, updates: Partial<ArticleTopic>) {
    return mutateDatabase((database) => {
      const topic = database.articleTopics.find(
        (item) => item.id === topicId && item.userId === userId
      )
      if (!topic) {
        return null
      }
      Object.assign(topic, updates)
      return topic
    })
  },
  deleteArticleTopic(userId: string, topicId: string) {
    return mutateDatabase((database) => {
      database.articleTopics = database.articleTopics.filter(
        (item) => !(item.userId === userId && item.id === topicId)
      )
    })
  },

  // ─── Scout: 渠道 ───

  listChannels(userId: string) {
    const db = readDatabase()
    return db.scoutChannels.filter(
      (item) => item.origin === "builtin" || item.userId === userId
    )
  },
  getChannel(channelId: string) {
    return readDatabase().scoutChannels.find((item) => item.id === channelId)
  },
  createChannel(userId: string, input: Omit<ScoutChannel, "id" | "userId" | "createdAt">) {
    return mutateDatabase((database) => {
      const channel: ScoutChannel = {
        ...input,
        id: randomUUID(),
        userId,
        createdAt: now()
      }
      database.scoutChannels.push(channel)
      return channel
    })
  },
  updateChannel(userId: string, channelId: string, updates: Partial<ScoutChannel>) {
    return mutateDatabase((database) => {
      const channel = database.scoutChannels.find(
        (item) => item.id === channelId && item.userId === userId && item.origin === "user"
      )
      if (!channel) {
        return null
      }
      Object.assign(channel, updates)
      return channel
    })
  },
  deleteChannel(userId: string, channelId: string) {
    return mutateDatabase((database) => {
      database.scoutChannels = database.scoutChannels.filter(
        (item) => !(item.userId === userId && item.id === channelId && item.origin === "user")
      )
    })
  },

  // ─── Scout: 凭证 ───

  listCredentials(userId: string) {
    return readDatabase().scoutCredentials.filter((item) => item.userId === userId)
  },
  getCredential(userId: string, credentialId: string) {
    return readDatabase().scoutCredentials.find(
      (item) => item.id === credentialId && item.userId === userId
    )
  },
  createCredential(userId: string, input: Omit<ScoutCredential, "id" | "userId" | "createdAt" | "verified">) {
    return mutateDatabase((database) => {
      const credential: ScoutCredential = {
        ...input,
        id: randomUUID(),
        userId,
        verified: false,
        credentials: Object.fromEntries(
          Object.entries(input.credentials).map(([k, v]) => [k, encryptValue(v)])
        ),
        createdAt: now()
      }
      database.scoutCredentials.push(credential)
      return credential
    })
  },
  updateCredential(userId: string, credentialId: string, updates: Partial<ScoutCredential>) {
    return mutateDatabase((database) => {
      const credential = database.scoutCredentials.find(
        (item) => item.id === credentialId && item.userId === userId
      )
      if (!credential) {
        return null
      }
      if (updates.credentials) {
        updates.credentials = Object.fromEntries(
          Object.entries(updates.credentials).map(([k, v]) => [k, encryptValue(v)])
        )
      }
      Object.assign(credential, updates)
      return credential
    })
  },
  deleteCredential(userId: string, credentialId: string) {
    return mutateDatabase((database) => {
      database.scoutCredentials = database.scoutCredentials.filter(
        (item) => !(item.userId === userId && item.id === credentialId)
      )
    })
  },

  // ─── Scout: 信息源 ───

  listSources(userId: string) {
    return sortByDate(
      readDatabase().scoutSources.filter((item) => item.userId === userId)
    )
  },
  getSource(userId: string, sourceId: string) {
    return readDatabase().scoutSources.find(
      (item) => item.id === sourceId && item.userId === userId
    )
  },
  createSource(userId: string, input: Omit<ScoutSource, "id" | "userId" | "createdAt" | "totalFetched" | "totalPatches">) {
    return mutateDatabase((database) => {
      const source: ScoutSource = {
        ...input,
        id: randomUUID(),
        userId,
        totalFetched: 0,
        totalPatches: 0,
        createdAt: now()
      }
      database.scoutSources.push(source)
      return source
    })
  },
  updateSource(userId: string, sourceId: string, updates: Partial<ScoutSource>) {
    return mutateDatabase((database) => {
      const source = database.scoutSources.find(
        (item) => item.id === sourceId && item.userId === userId
      )
      if (!source) {
        return null
      }
      Object.assign(source, updates)
      return source
    })
  },
  deleteSource(userId: string, sourceId: string) {
    return mutateDatabase((database) => {
      database.scoutSources = database.scoutSources.filter(
        (item) => !(item.userId === userId && item.id === sourceId)
      )
    })
  },

  // ─── Scout: 任务 ───

  listTasks(userId: string) {
    return sortByDate(
      readDatabase().scoutTasks.filter((item) => item.userId === userId)
    )
  },
  getTask(userId: string, taskId: string) {
    return readDatabase().scoutTasks.find(
      (item) => item.id === taskId && item.userId === userId
    )
  },
  createTask(userId: string, input: Omit<ScoutTask, "id" | "userId" | "createdAt" | "updatedAt" | "totalRuns">) {
    return mutateDatabase((database) => {
      const task: ScoutTask = {
        ...input,
        id: randomUUID(),
        userId,
        totalRuns: 0,
        createdAt: now(),
        updatedAt: now()
      }
      database.scoutTasks.push(task)
      return task
    })
  },
  updateTask(userId: string, taskId: string, updates: Partial<ScoutTask>) {
    return mutateDatabase((database) => {
      const task = database.scoutTasks.find(
        (item) => item.id === taskId && item.userId === userId
      )
      if (!task) {
        return null
      }
      Object.assign(task, updates, { updatedAt: now() })
      return task
    })
  },
  deleteTask(userId: string, taskId: string) {
    return mutateDatabase((database) => {
      database.scoutTasks = database.scoutTasks.filter(
        (item) => !(item.userId === userId && item.id === taskId)
      )
    })
  },

  // ─── Scout: 条目 ───

  listEntries(userId: string, sourceId?: string, taskId?: string) {
    return sortByDate(
      readDatabase().scoutEntries.filter((item) => {
        if (item.userId !== userId) {
          return false
        }
        if (sourceId && item.sourceId !== sourceId) {
          return false
        }
        if (taskId && item.taskId !== taskId) {
          return false
        }
        return true
      }),
      "fetchedAt"
    )
  },
  getEntry(userId: string, entryId: string) {
    return readDatabase().scoutEntries.find(
      (item) => item.id === entryId && item.userId === userId
    )
  },
  createEntry(input: Omit<ScoutEntry, "id">) {
    return mutateDatabase((database) => {
      const entry: ScoutEntry = { ...input, id: randomUUID() }
      database.scoutEntries.push(entry)
      return entry
    })
  },
  updateEntry(userId: string, entryId: string, updates: Partial<ScoutEntry>) {
    return mutateDatabase((database) => {
      const entry = database.scoutEntries.find(
        (item) => item.id === entryId && item.userId === userId
      )
      if (!entry) {
        return null
      }
      Object.assign(entry, updates)
      return entry
    })
  },
  deleteEntry(userId: string, entryId: string) {
    return mutateDatabase((database) => {
      database.scoutEntries = database.scoutEntries.filter(
        (item) => !(item.userId === userId && item.id === entryId)
      )
    })
  },
  /** 按 contentHash 检查去重 */
  findEntryByHash(userId: string, contentHash: string) {
    return readDatabase().scoutEntries.find(
      (item) => item.userId === userId && item.contentHash === contentHash
    )
  },

  // ─── Scout: Patch ───

  listPatches(userId: string, taskId?: string, status?: ScoutPatch["status"]) {
    return sortByDate(
      readDatabase().scoutPatches.filter((item) => {
        if (item.userId !== userId) {
          return false
        }
        if (taskId && item.taskId !== taskId) {
          return false
        }
        if (status && item.status !== status) {
          return false
        }
        return true
      })
    )
  },
  getPatch(userId: string, patchId: string) {
    return readDatabase().scoutPatches.find(
      (item) => item.id === patchId && item.userId === userId
    )
  },
  createPatch(input: Omit<ScoutPatch, "id" | "createdAt" | "updatedAt">) {
    return mutateDatabase((database) => {
      const patch: ScoutPatch = {
        ...input,
        id: randomUUID(),
        createdAt: now(),
        updatedAt: now()
      }
      database.scoutPatches.push(patch)
      return patch
    })
  },
  updatePatch(userId: string, patchId: string, updates: Partial<ScoutPatch>) {
    return mutateDatabase((database) => {
      const patch = database.scoutPatches.find(
        (item) => item.id === patchId && item.userId === userId
      )
      if (!patch) {
        return null
      }
      Object.assign(patch, updates, { updatedAt: now() })
      return patch
    })
  },

  // ─── Scout: Job ───

  listJobs(userId: string, taskId?: string) {
    return sortByDate(
      readDatabase().scoutJobs.filter((item) => {
        if (item.userId !== userId) {
          return false
        }
        if (taskId && item.taskId !== taskId) {
          return false
        }
        return true
      }),
      "startedAt"
    )
  },
  getJob(userId: string, jobId: string) {
    return readDatabase().scoutJobs.find(
      (item) => item.id === jobId && item.userId === userId
    )
  },
  createJob(input: Omit<ScoutJob, "id">) {
    return mutateDatabase((database) => {
      const job: ScoutJob = { ...input, id: randomUUID() }
      database.scoutJobs.push(job)
      return job
    })
  },
  updateJob(userId: string, jobId: string, updates: Partial<ScoutJob>) {
    return mutateDatabase((database) => {
      const job = database.scoutJobs.find(
        (item) => item.id === jobId && item.userId === userId
      )
      if (!job) {
        return null
      }
      Object.assign(job, updates)
      return job
    })
  },

  // ─── Scout: 配置 ───

  getScoutConfig(userId: string) {
    return readDatabase().scoutConfigs.find((item) => item.userId === userId)
  },
  saveScoutConfig(userId: string, input: Omit<ScoutConfig, "userId">) {
    return mutateDatabase((database) => {
      const existing = database.scoutConfigs.find((item) => item.userId === userId)
      if (existing) {
        Object.assign(existing, input)
        return existing
      }
      const config: ScoutConfig = { ...input, userId }
      database.scoutConfigs.push(config)
      return config
    })
  },

  // ─── Import: 导入来源 ───

  listImportSources(userId: string) {
    return readDatabase().importSources.filter((s) => s.userId === userId)
  },
  getImportSource(userId: string, id: string) {
    return readDatabase().importSources.find((s) => s.id === id && s.userId === userId)
  },
  createImportSource(input: Omit<ImportSource, "id" | "createdAt">) {
    return mutateDatabase((database) => {
      const source: ImportSource = { ...input, id: randomUUID(), createdAt: now() }
      database.importSources.push(source)
      return source
    })
  },
  updateImportSource(userId: string, id: string, updates: Partial<ImportSource>) {
    return mutateDatabase((database) => {
      const source = database.importSources.find((s) => s.id === id && s.userId === userId)
      if (!source) {
        return null
      }
      Object.assign(source, updates)
      return source
    })
  },
  deleteImportSource(userId: string, id: string) {
    return mutateDatabase((database) => {
      database.importSources = database.importSources.filter((s) => !(s.id === id && s.userId === userId))
      database.importJobs = database.importJobs.filter((j) => !(j.sourceId === id && j.userId === userId))
      const noteIds = new Set(
        database.importedNotes.filter((n) => n.sourceId === id && n.userId === userId).map((n) => n.id)
      )
      database.noteViewpointLinks = database.noteViewpointLinks.filter((l) => !noteIds.has(l.noteId))
      database.importedNotes = database.importedNotes.filter((n) => !(n.sourceId === id && n.userId === userId))
      // 清理观点中由导入产生的引用块
      for (const viewpoint of database.viewpoints) {
        if (viewpoint.articleBlocks) {
          viewpoint.articleBlocks = viewpoint.articleBlocks.filter(
            (b) => !(b.sourceRef?.type === "import" && noteIds.has(b.sourceRef.noteId))
          )
        }
      }
    })
  },

  // ─── Import: 导入任务 ───

  listImportJobs(userId: string, sourceId?: string) {
    const jobs = readDatabase().importJobs.filter((j) => j.userId === userId)
    const filtered = sourceId ? jobs.filter((j) => j.sourceId === sourceId) : jobs
    return sortByDate(filtered, "startedAt")
  },
  getImportJob(userId: string, id: string) {
    return readDatabase().importJobs.find((j) => j.id === id && j.userId === userId)
  },
  createImportJob(input: Omit<ImportJob, "id">) {
    return mutateDatabase((database) => {
      const job: ImportJob = { ...input, id: randomUUID() }
      database.importJobs.push(job)
      return job
    })
  },
  updateImportJob(userId: string, id: string, updates: Partial<ImportJob>) {
    return mutateDatabase((database) => {
      const job = database.importJobs.find((j) => j.id === id && j.userId === userId)
      if (!job) {
        return null
      }
      Object.assign(job, updates)
      return job
    })
  },
  /** 检查某来源是否有进行中的导入 */
  hasRunningImportJob(userId: string, sourceId: string) {
    return readDatabase().importJobs.some(
      (j) => j.userId === userId && j.sourceId === sourceId && (j.status === "running" || j.status === "committing")
    )
  },

  // ─── Import: 导入笔记 ───

  listImportedNotes(userId: string, sourceId?: string) {
    const notes = readDatabase().importedNotes.filter((n) => n.userId === userId)
    return sourceId ? notes.filter((n) => n.sourceId === sourceId) : notes
  },
  getImportedNote(userId: string, id: string) {
    return readDatabase().importedNotes.find((n) => n.id === id && n.userId === userId)
  },
  /** 批量写入导入笔记（事务提交阶段调用） */
  commitImportData(data: {
    notes: ImportedNote[]
    links: NoteViewpointLink[]
    newViewpoints: Viewpoint[]
  }) {
    return mutateDatabase((database) => {
      database.importedNotes.push(...data.notes)
      database.noteViewpointLinks.push(...data.links)
      database.viewpoints.push(...data.newViewpoints)
    })
  },

  // ─── Import: 笔记-观点关联 ───

  listNoteViewpointLinks(noteId: string) {
    return readDatabase().noteViewpointLinks.filter((l) => l.noteId === noteId)
  },
  listViewpointNoteLinks(viewpointId: string) {
    return readDatabase().noteViewpointLinks.filter((l) => l.viewpointId === viewpointId)
  },
  updateNoteViewpointLink(noteId: string, viewpointId: string, updates: Partial<NoteViewpointLink>) {
    return mutateDatabase((database) => {
      const link = database.noteViewpointLinks.find(
        (l) => l.noteId === noteId && l.viewpointId === viewpointId
      )
      if (!link) {
        return null
      }
      Object.assign(link, updates)
      return link
    })
  }
}
