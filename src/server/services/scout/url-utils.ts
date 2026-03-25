/**
 * URL 归一化与内容哈希
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
import { createHash } from "node:crypto"

/** 需要移除的常见追踪参数 */
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "ref", "source", "mc_cid", "mc_eid"
])

/** 归一化 URL：移除追踪参数、fragment、规范化路径 */
export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw)
    url.hash = ""
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param)
    }
    url.searchParams.sort()
    /** 规范化路径：移除尾部斜杠 */
    url.pathname = url.pathname.replace(/\/+$/, "") || "/"
    return url.toString()
  } catch {
    return raw
  }
}

/** 生成内容的 SHA-256 哈希，用于去重 */
export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}
