import Redis from "ioredis"

let client: Redis | null = null

function getRedisUrl() {
  return process.env.REDIS_URL || "redis://localhost:26379"
}

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 3) {
          return null
        }
        return Math.min(times * 200, 1000)
      },
      lazyConnect: true
    })
    client.on("error", () => {
      // 静默处理 —— 连接失败时 cache 操作会 fallthrough 到数据源
    })
  }
  return client
}

/** 安全关闭连接，用于优雅退出 */
export async function closeRedis() {
  if (client) {
    await client.quit().catch(() => undefined)
    client = null
  }
}
