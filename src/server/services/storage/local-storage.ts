import { mkdirSync, existsSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"

const DATA_DIR = process.env.DATA_DIR ?? "data/app"
const UPLOAD_DIR = join(DATA_DIR, "uploads")

function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true })
  }
}

export function saveUpload(userId: string, fileName: string, content: Buffer) {
  ensureUploadDir()
  const safeName = `${userId}-${Date.now()}-${fileName.replace(/\s+/g, "-")}`
  const targetPath = join(UPLOAD_DIR, safeName)
  writeFileSync(targetPath, content)
  return targetPath
}

export function removeUpload(filePath: string) {
  if (filePath && existsSync(filePath)) {
    rmSync(filePath, { force: true })
  }
}
