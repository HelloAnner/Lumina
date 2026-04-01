/**
 * Scout 调度器
 * 周期性执行活跃任务的抓取管线，管理并发与清理
 *
 * @author Anner
 * @since 0.2.0
 */
import { repository } from "@/src/server/repositories"
import { runPipeline } from "@/src/server/services/scout/pipeline"
import type { ScoutConfig, ScoutTask } from "@/src/server/store/types"

/** 调度器轮询间隔（每分钟检查一次是否有任务需要执行） */
const TICK_MS = 60_000

class ScoutScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  /** 正在执行的任务 ID 集合，防止并发重复 */
  private running = new Set<string>()
  private started = false

  /** 启动调度器 */
  start() {
    if (this.started) return
    this.started = true
    this.timer = setInterval(() => this.tick(), TICK_MS)
    // 启动后延迟 10 秒执行首次检查，等待服务就绪
    setTimeout(() => this.tick(), 10_000)
  }

  /** 停止调度器 */
  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.started = false
  }

  /** 配置变更后重新调度（不需要重启 timer，下次 tick 会读取最新配置） */
  reconfigure() {
    // tick 每次都从数据库读取最新配置，无需额外操作
  }

  /** 每轮 tick：遍历启用的用户配置，执行到期任务 */
  private async tick() {
    try {
      const configs = repository.listEnabledScoutConfigs()

      for (const config of configs) {
        await this.processUser(config)
      }
    } catch {
      // 调度器本身不应因异常中断
    }
  }

  private async processUser(config: ScoutConfig) {
    const { userId, syncIntervalMinutes, entryRetentionDays } = config

    // 清理过期条目
    try {
      repository.purgeExpiredEntries(userId, entryRetentionDays)
    } catch {
      // 清理失败不影响抓取
    }

    const tasks = repository.listTasks(userId).filter((t) => t.status === "active")
    const now = Date.now()
    const intervalMs = syncIntervalMinutes * 60_000

    for (const task of tasks) {
      // 跳过正在执行的任务
      if (this.running.has(task.id)) continue

      // 判断是否到期
      if (!isDue(task, now, intervalMs)) continue

      this.running.add(task.id)

      // 创建 job 并异步执行
      const job = repository.createJob({
        userId,
        taskId: task.id,
        sourceIds: task.sourceIds,
        triggeredBy: "cron",
        status: "running",
        stages: {
          fetch: { total: 0, completed: 0, errors: 0 },
          analyze: { total: 0, completed: 0, errors: 0 },
          patch: { total: 0, generated: 0 }
        },
        startedAt: new Date().toISOString()
      })

      // 计算并记录下次运行时间
      repository.updateTask(userId, task.id, {
        nextRunAt: new Date(now + intervalMs).toISOString()
      })

      runPipeline(userId, task, job.id)
        .catch(() => {})
        .finally(() => {
          this.running.delete(task.id)
        })
    }
  }
}

/** 判断任务是否到期需要执行 */
function isDue(task: ScoutTask, now: number, intervalMs: number): boolean {
  // 从未运行过，立即执行
  if (!task.lastRunAt) return true

  const lastRun = new Date(task.lastRunAt).getTime()
  return now - lastRun >= intervalMs
}

export const scoutScheduler = new ScoutScheduler()
