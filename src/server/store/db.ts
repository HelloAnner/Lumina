import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { buildSeedDatabase } from "@/src/server/store/seed"
import type { Database } from "@/src/server/store/types"

const DATA_DIR = process.env.DATA_DIR ?? "data/app"
const DB_PATH = join(DATA_DIR, "lumina.json")

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

export function readDatabase(): Database {
  ensureDbFile()
  return JSON.parse(readFileSync(DB_PATH, "utf-8")) as Database
}

export function writeDatabase(database: Database) {
  ensureDbFile()
  writeFileSync(DB_PATH, JSON.stringify(database, null, 2), "utf-8")
}

export function mutateDatabase<T>(updater: (database: Database) => T): T {
  const database = readDatabase()
  const result = updater(database)
  writeDatabase(database)
  return result
}
