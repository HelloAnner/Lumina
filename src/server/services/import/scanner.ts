/**
 * Vault 目录扫描器
 * 递归遍历 Obsidian Vault，收集 .md / 图片 / .excalidraw.md 文件
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
import { readdirSync, realpathSync, statSync } from "node:fs"
import { join, relative, extname, basename } from "node:path"
import minimatch from "minimatch"

export interface ScanResult {
  mdFiles: string[]
  imageFiles: Map<string, string>
  excalidrawFiles: Map<string, string>
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"])
const DEFAULT_EXCLUDES = [".obsidian/**", ".trash/**", "node_modules/**"]

/** 校验路径安全性，防止路径穿越 */
export function validatePath(filePath: string, vaultRealPath: string): boolean {
  try {
    const realFile = realpathSync(filePath)
    return realFile.startsWith(vaultRealPath + "/") || realFile === vaultRealPath
  } catch {
    return false
  }
}

/** 扫描 Vault 目录 */
export function scanVault(vaultPath: string, excludePatterns: string[]): ScanResult {
  const vaultRealPath = realpathSync(vaultPath)
  const allExcludes = [...DEFAULT_EXCLUDES, ...excludePatterns]
  const result: ScanResult = {
    mdFiles: [],
    imageFiles: new Map(),
    excalidrawFiles: new Map()
  }

  function walk(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relPath = relative(vaultRealPath, fullPath)

      if (allExcludes.some((pattern) => minimatch(relPath, pattern, { dot: true }))) {
        continue
      }

      if (!validatePath(fullPath, vaultRealPath)) {
        continue
      }

      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      const ext = extname(entry.name).toLowerCase()
      const name = basename(entry.name)

      if (name.endsWith(".excalidraw.md")) {
        result.excalidrawFiles.set(relPath, fullPath)
      } else if (ext === ".md") {
        result.mdFiles.push(fullPath)
      } else if (IMAGE_EXTENSIONS.has(ext)) {
        result.imageFiles.set(relPath, fullPath)
      }
    }
  }

  walk(vaultRealPath)
  return result
}

/** 解析 Obsidian 图片引用路径，返回 Vault 内的绝对路径 */
export function resolveImagePath(
  ref: string,
  currentMdPath: string,
  vaultPath: string,
  imageFiles: Map<string, string>
): string | null {
  // 外部 URL
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    return null
  }

  // 移除 Obsidian 尺寸标记 ![[img|400]]
  const cleanRef = ref.split("|")[0].trim()

  // 1. 先尝试全局短路径匹配
  for (const [relPath, absPath] of imageFiles) {
    if (basename(relPath) === basename(cleanRef)) {
      return absPath
    }
  }

  // 2. 相对于 Vault 根目录
  const fromRoot = join(vaultPath, cleanRef)
  if (imageFiles.has(relative(vaultPath, fromRoot))) {
    return fromRoot
  }

  // 3. 相对于当前 .md 文件
  const fromMd = join(currentMdPath, "..", cleanRef)
  try {
    const stat = statSync(fromMd)
    if (stat.isFile()) {
      return fromMd
    }
  } catch {
    // pass
  }

  return null
}
