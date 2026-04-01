/**
 * Next.js Instrumentation
 * 服务端启动时初始化后台服务
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { scoutScheduler } = await import("@/src/server/services/scout/scheduler")
    scoutScheduler.start()
  }
}
