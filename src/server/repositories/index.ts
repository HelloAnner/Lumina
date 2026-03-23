import { randomUUID, createHash } from "node:crypto"
import { readDatabase, mutateDatabase } from "@/src/server/store/db"
import { encryptValue } from "@/src/server/lib/crypto"
import type {
  AggregateJob,
  Book,
  Highlight,
  HighlightViewpoint,
  ModelBinding,
  ModelConfig,
  PublishRecord,
  PublishTarget,
  PublishTask,
  ReaderSettings,
  StorageConfig,
  User,
  Viewpoint,
  ViewpointRelation
} from "@/src/server/store/types"

function now() {
  return new Date().toISOString()
}

function sortByDate<
  T extends { createdAt?: string; updatedAt?: string; executedAt?: string }
>(
  items: T[]
): T[] {
  return [...items].sort((left, right) =>
    (right.updatedAt ?? right.executedAt ?? right.createdAt ?? "").localeCompare(
      left.updatedAt ?? left.executedAt ?? left.createdAt ?? ""
    )
  )
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
        navigationMode: "horizontal"
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
    })
  },
  listHighlightsByBook(userId: string, bookId: string) {
    return sortByDate(
      readDatabase().highlights.filter(
        (item) => item.userId === userId && item.bookId === bookId
      )
    )
  },
  listUnconfirmedHighlights(userId: string, viewpointId: string) {
    const database = readDatabase()
    const linkMap = database.highlightViewpoints.filter(
      (item) => item.viewpointId === viewpointId && !item.confirmed
    )
    return linkMap
      .map((link) => ({
        ...database.highlights.find((item) => item.id === link.highlightId),
        similarityScore: link.similarityScore
      }))
      .filter(Boolean)
  },
  createHighlight(input: Omit<Highlight, "id" | "createdAt" | "status">) {
    return mutateDatabase((database) => {
      const highlight: Highlight = {
        ...input,
        id: randomUUID(),
        createdAt: now(),
        status: "PENDING"
      }
      database.highlights.push(highlight)
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
      database.highlights = database.highlights.filter(
        (item) => !(item.userId === userId && item.id === highlightId)
      )
      database.highlightViewpoints = database.highlightViewpoints.filter(
        (item) => item.highlightId !== highlightId
      )
    })
  },
  listViewpoints(userId: string) {
    return readDatabase().viewpoints
      .filter((item) => item.userId === userId)
      .sort((left, right) => left.sortOrder - right.sortOrder)
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
      database.viewpoints = database.viewpoints.filter(
        (item) => !(item.id === viewpointId && item.userId === userId)
      )
      database.highlightViewpoints = database.highlightViewpoints.filter(
        (item) => item.viewpointId !== viewpointId
      )
      database.relations = database.relations.filter(
        (item) => item.sourceId !== viewpointId && item.targetId !== viewpointId
      )
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
    return readDatabase().readerSettings.find((item) => item.userId === userId)
  },
  updateReaderSettings(userId: string, updates: Partial<ReaderSettings>) {
    return mutateDatabase((database) => {
      const settings = database.readerSettings.find((item) => item.userId === userId)
      if (!settings) {
        return null
      }
      Object.assign(settings, updates)
      return settings
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
  }
}
