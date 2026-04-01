import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs"
import { dirname, join } from "node:path"
import { buildSeedDatabase } from "@/src/server/store/seed"
import type {
  Database,
  NoteBlock,
  Viewpoint
} from "@/src/server/store/types"

// ---- 进程内内存缓存 ----
// 避免每次请求重复读取 + 解析整个 JSON 文件
let memoryCache: {
  database: Database
  mtime: number // 文件修改时间，用于检测外部写入
} | null = null

export interface ViewpointBlockEntry {
  userId: string
  viewpointId: string
  blocks: NoteBlock[]
}

function ensureDbFile() {
  const dataDir = getDataDir()
  const dbPath = getDbPath()
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  if (!existsSync(dirname(dbPath))) {
    mkdirSync(dirname(dbPath), { recursive: true })
  }
  if (!existsSync(dbPath)) {
    writeFileSync(dbPath, JSON.stringify(buildSeedDatabase(), null, 2), "utf-8")
  }
}

function ensureBlocksDir(userId?: string) {
  const target = userId ? join(getViewpointBlocksDir(), userId) : getViewpointBlocksDir()
  if (!existsSync(target)) {
    mkdirSync(target, { recursive: true })
  }
}

function buildViewpointBlocksPath(userId: string, viewpointId: string) {
  return join(getViewpointBlocksDir(), userId, `${viewpointId}.json`)
}

function readStoredViewpointBlocks(userId: string, viewpointId: string) {
  const path = buildViewpointBlocksPath(userId, viewpointId)
  if (!existsSync(path)) {
    return undefined
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as NoteBlock[]
  } catch {
    return undefined
  }
}

export function readViewpointBlocks(userId: string, viewpointId: string) {
  const stored = readStoredViewpointBlocks(userId, viewpointId)
  if (stored) {
    return stored
  }
  const database = readDatabase({ hydrateViewpointBlocks: false })
  return database.viewpoints.find(
    (item) => item.userId === userId && item.id === viewpointId
  )?.articleBlocks
}

export function deleteViewpointBlocks(userId: string, viewpointId: string) {
  const path = buildViewpointBlocksPath(userId, viewpointId)
  if (!existsSync(path)) {
    return
  }
  try {
    unlinkSync(path)
  } catch {
    /* ignore */
  }
}

function writeStoredViewpointBlocks(entry: ViewpointBlockEntry) {
  ensureBlocksDir(entry.userId)
  const path = buildViewpointBlocksPath(entry.userId, entry.viewpointId)
  const next = JSON.stringify(entry.blocks, null, 2)
  const current = existsSync(path) ? readFileSync(path, "utf-8") : null
  if (current === next) {
    return
  }
  writeFileSync(path, next, "utf-8")
}

export function splitViewpointBlocksFromDatabase(database: Database) {
  const blockEntries: ViewpointBlockEntry[] = []
  const viewpoints = (database.viewpoints ?? []).map((viewpoint) => {
    if (viewpoint.articleBlocks) {
      blockEntries.push({
        userId: viewpoint.userId,
        viewpointId: viewpoint.id,
        blocks: viewpoint.articleBlocks
      })
    }
    return stripViewpointBlocks(viewpoint)
  })

  return {
    database: {
      ...database,
      viewpoints
    },
    blockEntries
  }
}

export function hydrateViewpointBlocks(
  database: Database,
  blockEntries: ViewpointBlockEntry[]
) {
  const blockMap = new Map(
    blockEntries.map((entry) => [getViewpointBlocksKey(entry.userId, entry.viewpointId), entry.blocks])
  )

  return {
    ...database,
    viewpoints: (database.viewpoints ?? []).map((viewpoint) => {
      const blocks = blockMap.get(getViewpointBlocksKey(viewpoint.userId, viewpoint.id))
      if (!blocks) {
        return viewpoint
      }
      return {
        ...viewpoint,
        articleBlocks: blocks
      }
    })
  }
}

/** 读取数据库，自动补齐缺失的数组字段（兼容旧版数据） */
export function readDatabase(options: {
  hydrateViewpointBlocks?: boolean
} = {}): Database {
  ensureDbFile()
  const dbPath = getDbPath()

  // 检查内存缓存是否有效（通过文件 mtime 判断）
  const currentMtime = getFileMtime(dbPath)
  if (memoryCache && memoryCache.mtime === currentMtime) {
    if (options.hydrateViewpointBlocks === false) {
      return memoryCache.database
    }
    return memoryCache.database
  }

  const raw = JSON.parse(readFileSync(dbPath, "utf-8"))
  const database = {
    scoutArticles: [],
    articleTopics: [],
    scoutChannels: [],
    scoutCredentials: [],
    scoutSources: [],
    scoutTasks: [],
    scoutEntries: [],
    scoutPatches: [],
    scoutJobs: [],
    scoutConfigs: [],
    importSources: [],
    importJobs: [],
    importedNotes: [],
    noteViewpointLinks: [],
    shareLinks: [],
    ...raw
  } as Database

  if (options.hydrateViewpointBlocks === false) {
    return database
  }

  const blockEntries: ViewpointBlockEntry[] = []
  for (const viewpoint of database.viewpoints ?? []) {
    const blocks = readStoredViewpointBlocks(viewpoint.userId, viewpoint.id)
      ?? viewpoint.articleBlocks
    if (!blocks) {
      continue
    }
    blockEntries.push({
      userId: viewpoint.userId,
      viewpointId: viewpoint.id,
      blocks
    })
  }
  const hydrated = hydrateViewpointBlocks(database, blockEntries)

  // 写入内存缓存
  memoryCache = { database: hydrated, mtime: currentMtime }

  return hydrated
}

export function writeDatabase(database: Database) {
  ensureDbFile()
  const { database: stripped, blockEntries } = splitViewpointBlocksFromDatabase(database)
  writeFileSync(getDbPath(), JSON.stringify(stripped, null, 2), "utf-8")
  for (const entry of blockEntries) {
    writeStoredViewpointBlocks(entry)
  }
  // 更新内存缓存（避免下次 readDatabase 重新解析）
  memoryCache = { database, mtime: getFileMtime(getDbPath()) }
}

export function mutateDatabase<T>(updater: (database: Database) => T): T {
  const database = readDatabase()
  const result = updater(database)
  writeDatabase(database)
  return result
}

/** 手动清除内存缓存（测试或热重载时使用） */
export function clearDatabaseCache() {
  memoryCache = null
}

function stripViewpointBlocks(viewpoint: Viewpoint): Viewpoint {
  const { articleBlocks: _articleBlocks, ...rest } = viewpoint
  return rest
}

function getViewpointBlocksKey(userId: string, viewpointId: string) {
  return `${userId}:${viewpointId}`
}

function getDataDir() {
  return process.env.DATA_DIR ?? "data/app"
}

function getDbPath() {
  return join(getDataDir(), "lumina.json")
}

function getViewpointBlocksDir() {
  return join(getDataDir(), "viewpoint-blocks")
}

function getFileMtime(path: string): number {
  try {
    return statSync(path).mtimeMs
  } catch {
    return 0
  }
}
