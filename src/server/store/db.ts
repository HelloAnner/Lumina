import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs"
import { dirname, join } from "node:path"
import { buildSeedDatabase } from "@/src/server/store/seed"
import type {
  Database,
  NoteBlock,
  Viewpoint
} from "@/src/server/store/types"

const DATA_DIR = process.env.DATA_DIR ?? "data/app"
const DB_PATH = join(DATA_DIR, "lumina.json")
const VIEWPOINT_BLOCKS_DIR = join(DATA_DIR, "viewpoint-blocks")

export interface ViewpointBlockEntry {
  userId: string
  viewpointId: string
  blocks: NoteBlock[]
}

function ensureDbFile() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!existsSync(dirname(DB_PATH))) {
    mkdirSync(dirname(DB_PATH), { recursive: true })
  }
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify(buildSeedDatabase(), null, 2), "utf-8")
  }
}

function ensureBlocksDir(userId?: string) {
  const target = userId ? join(VIEWPOINT_BLOCKS_DIR, userId) : VIEWPOINT_BLOCKS_DIR
  if (!existsSync(target)) {
    mkdirSync(target, { recursive: true })
  }
}

function buildViewpointBlocksPath(userId: string, viewpointId: string) {
  return join(VIEWPOINT_BLOCKS_DIR, userId, `${viewpointId}.json`)
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
  const raw = JSON.parse(readFileSync(DB_PATH, "utf-8"))
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
  return hydrateViewpointBlocks(database, blockEntries)
}

export function writeDatabase(database: Database) {
  ensureDbFile()
  const { database: stripped, blockEntries } = splitViewpointBlocksFromDatabase(database)
  writeFileSync(DB_PATH, JSON.stringify(stripped, null, 2), "utf-8")
  for (const entry of blockEntries) {
    writeStoredViewpointBlocks(entry)
  }
}

export function mutateDatabase<T>(updater: (database: Database) => T): T {
  const database = readDatabase()
  const result = updater(database)
  writeDatabase(database)
  return result
}

function stripViewpointBlocks(viewpoint: Viewpoint): Viewpoint {
  const { articleBlocks: _articleBlocks, ...rest } = viewpoint
  return rest
}

function getViewpointBlocksKey(userId: string, viewpointId: string) {
  return `${userId}:${viewpointId}`
}
