import { getRedis } from "./redis"

const KEY_PREFIX = "lumina:"
const DEFAULT_TTL = 300 // 5 minutes

/**
 * Redis 缓存工具
 *
 * 读取命中 → 直接返回反序列化结果
 * 读取未命中 → 执行 fetcher，写入缓存，返回结果
 * Redis 不可用 → 直接执行 fetcher，不阻塞业务
 */
export async function cached<T>(
  key: string,
  fetcher: () => T | Promise<T>,
  ttl = DEFAULT_TTL
): Promise<T> {
  const fullKey = KEY_PREFIX + key
  const redis = getRedis()
  try {
    const raw = await redis.get(fullKey)
    if (raw !== null) {
      return JSON.parse(raw) as T
    }
  } catch {
    // Redis 不可用，fallthrough
  }
  const result = await fetcher()
  try {
    await redis.set(fullKey, JSON.stringify(result), "EX", ttl)
  } catch {
    // 写入失败静默
  }
  return result
}

/** 同步版本 — 先查缓存，未命中同步执行 fetcher 并异步写入 */
export function cachedSync<T>(
  key: string,
  fetcher: () => T,
  ttl = DEFAULT_TTL
): T {
  const result = fetcher()
  const fullKey = KEY_PREFIX + key
  try {
    const redis = getRedis()
    void redis.set(fullKey, JSON.stringify(result), "EX", ttl).catch(() => undefined)
  } catch {
    // 静默
  }
  return result
}

/** 批量失效指定前缀的缓存 */
export async function invalidate(...patterns: string[]) {
  const redis = getRedis()
  try {
    for (const pattern of patterns) {
      const keys = await redis.keys(KEY_PREFIX + pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    }
  } catch {
    // 静默
  }
}

/** 失效单个 key */
export async function invalidateKey(...keys: string[]) {
  if (keys.length === 0) {
    return
  }
  const redis = getRedis()
  try {
    await redis.del(...keys.map((k) => KEY_PREFIX + k))
  } catch {
    // 静默
  }
}

/** 构建用户维度缓存 key */
export function userKey(userId: string, scope: string) {
  return `user:${userId}:${scope}`
}
