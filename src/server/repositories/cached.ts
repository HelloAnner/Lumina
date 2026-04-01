/**
 * Redis 缓存层 —— 包装 repository 的高频读操作
 *
 * 策略：
 * - 每个用户的数据独立缓存，key = lumina:user:{userId}:{scope}
 * - 读操作：先查 Redis，miss 则走 repository 并回填
 * - 写操作：执行后批量失效相关缓存
 * - Redis 不可用时透传到 repository，不阻塞业务
 */
import { cached, invalidate, userKey } from "@/src/server/lib/cache"
import { repository } from "./index"
import type { Viewpoint, NoteBlock } from "@/src/server/store/types"

// ---- 缓存 scope 常量 ----
const SCOPE = {
  VIEWPOINTS: "viewpoints",
  VIEWPOINT: "viewpoint",
  VIEWPOINT_BLOCKS: "vp-blocks",
  GRAPH: "graph",
  BOOKS: "books",
  ARTICLES: "articles",
  ARTICLE_TOPICS: "article-topics",
  READER_SETTINGS: "reader-settings",
  MODEL_BINDINGS: "model-bindings",
  MODEL_CONFIGS: "model-configs",
  IMPORT_SOURCES: "import-sources",
  CHANNELS: "channels",
  SOURCES: "sources",
  CREDENTIALS: "credentials",
  PUBLISH_TASKS: "publish-tasks",
  PUBLISH_TARGETS: "publish-targets",
  SCOUT_TASKS: "scout-tasks",
  SCOUT_PATCHES: "scout-patches",
  HIGHLIGHTS: "highlights",
  ANNOTATIONS: "annotations"
} as const

const TTL_SHORT = 60      // 1 分钟 —— 频繁变化的数据
const TTL_MEDIUM = 300    // 5 分钟 —— 一般列表
const TTL_LONG = 600      // 10 分钟 —— 稳定配置

// ---- 缓存读操作 ----

export const cachedRepo = {
  listViewpoints(userId: string, options?: { metadataOnly?: boolean }) {
    const suffix = options?.metadataOnly ? ":meta" : ""
    return cached(
      userKey(userId, SCOPE.VIEWPOINTS + suffix),
      () => repository.listViewpoints(userId, options),
      TTL_MEDIUM
    )
  },

  getViewpoint(userId: string, viewpointId: string, options?: { includeBlocks?: boolean }) {
    const suffix = options?.includeBlocks ? ":blocks" : ""
    return cached(
      userKey(userId, `${SCOPE.VIEWPOINT}:${viewpointId}${suffix}`),
      () => repository.getViewpoint(userId, viewpointId, options),
      TTL_SHORT
    )
  },

  getViewpointBlocks(userId: string, viewpointId: string) {
    return cached(
      userKey(userId, `${SCOPE.VIEWPOINT_BLOCKS}:${viewpointId}`),
      () => repository.getViewpointBlocks(userId, viewpointId),
      TTL_SHORT
    )
  },

  getGraph(userId: string) {
    return cached(
      userKey(userId, SCOPE.GRAPH),
      () => repository.getGraph(userId),
      TTL_MEDIUM
    )
  },

  listBooks(userId: string, search?: string, tag?: string) {
    // 带搜索条件的不缓存
    if (search || tag) {
      return Promise.resolve(repository.listBooks(userId, search, tag))
    }
    return cached(
      userKey(userId, SCOPE.BOOKS),
      () => repository.listBooks(userId),
      TTL_MEDIUM
    )
  },

  listArticles(userId: string, opts?: Parameters<typeof repository.listArticles>[1]) {
    const suffix = opts ? `:p${opts.page ?? 1}:s${opts.sortBy ?? ""}:t${opts.topicId ?? ""}` : ""
    return cached(
      userKey(userId, SCOPE.ARTICLES + suffix),
      () => repository.listArticles(userId, opts),
      TTL_SHORT
    )
  },

  listArticleTopics(userId: string) {
    return cached(
      userKey(userId, SCOPE.ARTICLE_TOPICS),
      () => repository.listArticleTopics(userId),
      TTL_MEDIUM
    )
  },

  getReaderSettings(userId: string) {
    return cached(
      userKey(userId, SCOPE.READER_SETTINGS),
      () => repository.getReaderSettings(userId),
      TTL_LONG
    )
  },

  listModelBindings(userId: string) {
    return cached(
      userKey(userId, SCOPE.MODEL_BINDINGS),
      () => repository.listModelBindings(userId),
      TTL_LONG
    )
  },

  listModelConfigs(userId: string) {
    return cached(
      userKey(userId, SCOPE.MODEL_CONFIGS),
      () => repository.listModelConfigs(userId),
      TTL_LONG
    )
  },

  listImportSources(userId: string) {
    return cached(
      userKey(userId, SCOPE.IMPORT_SOURCES),
      () => repository.listImportSources(userId),
      TTL_MEDIUM
    )
  },

  listChannels(userId: string) {
    return cached(
      userKey(userId, SCOPE.CHANNELS),
      () => repository.listChannels(userId),
      TTL_MEDIUM
    )
  },

  listSources(userId: string) {
    return cached(
      userKey(userId, SCOPE.SOURCES),
      () => repository.listSources(userId),
      TTL_MEDIUM
    )
  },

  listCredentials(userId: string) {
    return cached(
      userKey(userId, SCOPE.CREDENTIALS),
      () => repository.listCredentials(userId),
      TTL_LONG
    )
  },

  listPublishTasks(userId: string) {
    return cached(
      userKey(userId, SCOPE.PUBLISH_TASKS),
      () => repository.listPublishTasks(userId),
      TTL_SHORT
    )
  },

  listPublishTargets(userId: string) {
    return cached(
      userKey(userId, SCOPE.PUBLISH_TARGETS),
      () => repository.listPublishTargets(userId),
      TTL_MEDIUM
    )
  },

  listTasks(userId: string) {
    return cached(
      userKey(userId, SCOPE.SCOUT_TASKS),
      () => repository.listTasks(userId),
      TTL_SHORT
    )
  },

  listPatches(userId: string, taskId?: string, status?: string) {
    const suffix = taskId ? `:t${taskId}` : status ? `:s${status}` : ""
    return cached(
      userKey(userId, SCOPE.SCOUT_PATCHES + suffix),
      () => repository.listPatches(userId, taskId, status as any),
      TTL_SHORT
    )
  },

  listHighlightsByBook(userId: string, bookId: string) {
    return cached(
      userKey(userId, `${SCOPE.HIGHLIGHTS}:${bookId}`),
      () => repository.listHighlightsByBook(userId, bookId),
      TTL_SHORT
    )
  },

  listUnconfirmedHighlights(userId: string, viewpointId: string) {
    return cached(
      userKey(userId, `${SCOPE.HIGHLIGHTS}:unconfirmed:${viewpointId}`),
      () => repository.listUnconfirmedHighlights(userId, viewpointId),
      TTL_SHORT
    )
  },

  listAnnotations(userId: string, viewpointId: string) {
    return cached(
      userKey(userId, `${SCOPE.ANNOTATIONS}:${viewpointId}`),
      () => repository.listAnnotations(userId, viewpointId),
      TTL_SHORT
    )
  }
}

// ---- 缓存失效 ----

/** 失效用户的观点相关缓存 */
export function invalidateViewpoints(userId: string) {
  return invalidate(
    `user:${userId}:${SCOPE.VIEWPOINTS}*`,
    `user:${userId}:${SCOPE.VIEWPOINT}:*`,
    `user:${userId}:${SCOPE.VIEWPOINT_BLOCKS}:*`,
    `user:${userId}:${SCOPE.GRAPH}`
  )
}

/** 失效用户的书籍/划线相关缓存 */
export function invalidateBooks(userId: string) {
  return invalidate(
    `user:${userId}:${SCOPE.BOOKS}`,
    `user:${userId}:${SCOPE.HIGHLIGHTS}:*`,
    `user:${userId}:${SCOPE.GRAPH}`
  )
}

/** 失效用户的文章相关缓存 */
export function invalidateArticles(userId: string) {
  return invalidate(
    `user:${userId}:${SCOPE.ARTICLES}*`,
    `user:${userId}:${SCOPE.ARTICLE_TOPICS}*`,
    `user:${userId}:${SCOPE.HIGHLIGHTS}:*`
  )
}

/** 失效用户的设置缓存 */
export function invalidateSettings(userId: string) {
  return invalidate(
    `user:${userId}:${SCOPE.READER_SETTINGS}`,
    `user:${userId}:${SCOPE.MODEL_BINDINGS}`,
    `user:${userId}:${SCOPE.MODEL_CONFIGS}`
  )
}

/** 失效用户的 Scout 相关缓存 */
export function invalidateScout(userId: string) {
  return invalidate(
    `user:${userId}:${SCOPE.CHANNELS}`,
    `user:${userId}:${SCOPE.SOURCES}`,
    `user:${userId}:${SCOPE.CREDENTIALS}`,
    `user:${userId}:${SCOPE.SCOUT_TASKS}*`,
    `user:${userId}:${SCOPE.SCOUT_PATCHES}*`
  )
}

/** 失效用户的发布缓存 */
export function invalidatePublish(userId: string) {
  return invalidate(
    `user:${userId}:${SCOPE.PUBLISH_TASKS}`,
    `user:${userId}:${SCOPE.PUBLISH_TARGETS}`
  )
}

/** 失效用户的批注缓存 */
export function invalidateAnnotations(userId: string) {
  return invalidate(`user:${userId}:${SCOPE.ANNOTATIONS}:*`)
}

/** 失效用户的导入缓存 */
export function invalidateImports(userId: string) {
  return invalidate(`user:${userId}:${SCOPE.IMPORT_SOURCES}`)
}

/** 失效用户的所有缓存 */
export function invalidateAll(userId: string) {
  return invalidate(`user:${userId}:*`)
}
