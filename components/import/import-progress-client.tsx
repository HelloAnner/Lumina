/**
 * 导入进度客户端组件
 * 展示五阶段管线进度，支持取消/重试/跳转
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  Circle,
  CircleX,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/src/lib/utils"
import type { ImportJob, ImportJobStage } from "@/src/server/store/types"

interface Props {
  initialJob: ImportJob
  sourceName: string
}

const STAGES: { key: ImportJobStage; label: string }[] = [
  { key: "scanning", label: "扫描文件" },
  { key: "parsing", label: "解析笔记" },
  { key: "uploading", label: "上传图片" },
  { key: "analyzing", label: "分析观点" },
  { key: "linking", label: "建立关联" }
]

const STAGE_ORDER: Record<ImportJobStage, number> = {
  scanning: 0,
  parsing: 1,
  uploading: 2,
  analyzing: 3,
  linking: 4
}

type StageStatus = "done" | "active" | "waiting" | "failed"

function getStageStatus(
  stageKey: ImportJobStage,
  job: ImportJob
): StageStatus {
  const currentIdx = STAGE_ORDER[job.stage]
  const stageIdx = STAGE_ORDER[stageKey]

  if (job.status === "failed") {
    if (stageIdx < currentIdx) return "done"
    if (stageIdx === currentIdx) return "failed"
    return "waiting"
  }

  if (job.status === "done" || job.status === "committing") {
    return "done"
  }

  if (stageIdx < currentIdx) return "done"
  if (stageIdx === currentIdx) return "active"
  return "waiting"
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "done") {
    return <Check className="h-[18px] w-[18px] text-success" strokeWidth={2} />
  }
  if (status === "active") {
    return <Loader2 className="h-[18px] w-[18px] text-accent-blue animate-spin" strokeWidth={2} />
  }
  if (status === "failed") {
    return <CircleX className="h-[18px] w-[18px] text-error" strokeWidth={2} />
  }
  return <Circle className="h-[18px] w-[18px] text-placeholder" strokeWidth={1.5} />
}

function StageStatusText({ status }: { status: StageStatus }) {
  if (status === "done") {
    return <span className="text-xs text-success">完成</span>
  }
  if (status === "active") {
    return <span className="text-xs text-accent-blue">进行中</span>
  }
  if (status === "failed") {
    return <span className="text-xs text-error">失败</span>
  }
  return <span className="text-xs text-placeholder">等待中</span>
}

export function ImportProgressClient({ initialJob, sourceName }: Props) {
  const router = useRouter()
  const [job, setJob] = useState<ImportJob>(initialJob)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isTerminal = job.status === "done" || job.status === "failed" || job.status === "cancelled"

  /** 轮询任务状态 */
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/import/jobs/${job.id}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.item) {
        setJob(data.item)
      }
    } catch {
      // 网络错误静默忽略
    }
  }, [job.id])

  useEffect(() => {
    if (isTerminal) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(poll, 1500)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isTerminal, poll])

  const handleCancel = useCallback(async () => {
    try {
      await fetch(`/api/import/jobs/${job.id}/cancel`, { method: "POST" })
      await poll()
    } catch {
      // 忽略
    }
  }, [job.id, poll])

  const handleRetry = useCallback(async () => {
    // 从 job.sourceId 重新触发同步
    try {
      const res = await fetch(`/api/import/sources/${job.sourceId}/sync`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        if (data.item?.id) {
          router.replace(`/sources/import/${data.item.id}`)
        }
      }
    } catch {
      // 忽略
    }
  }, [job.sourceId, router])

  const progressPercent = job.progress.total > 0
    ? Math.round((job.progress.processed / job.progress.total) * 100)
    : 0

  const title = job.status === "done"
    ? "导入完成"
    : job.status === "failed"
      ? "导入失败"
      : job.status === "cancelled"
        ? "导入已取消"
        : `导入 ${sourceName}`

  const titleColor = job.status === "failed"
    ? "text-error"
    : job.status === "cancelled"
      ? "text-muted"
      : "text-foreground"

  return (
    <div className="relative h-full w-full bg-base">
      {/* 返回按钮 */}
      <button
        onClick={() => router.push("/settings")}
        className="absolute left-8 top-7 flex items-center gap-1.5 text-muted hover:text-secondary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-[13px]">返回设置</span>
      </button>

      {/* 居中内容 */}
      <div className="absolute left-1/2 top-[120px] -translate-x-1/2 w-[600px] flex flex-col items-center gap-8">
        {/* 标题 */}
        <h1 className={cn("text-[22px] font-semibold tracking-tight", titleColor)}>
          {title}
        </h1>

        {/* 阶段卡片 */}
        <div className="w-[440px] rounded-xl border border-border bg-surface p-7 flex flex-col">
          {STAGES.map((stage) => {
            const status = getStageStatus(stage.key, job)
            return (
              <div key={stage.key} className="flex items-center gap-3 h-8">
                <StageIcon status={status} />
                <span className={cn(
                  "text-sm flex-1",
                  status === "waiting" ? "text-muted" : "text-foreground",
                  status === "active" && "font-medium"
                )}>
                  {stage.label}
                </span>
                <StageStatusText status={status} />
              </div>
            )
          })}

          {/* 进度条（仅进行中显示） */}
          {!isTerminal && (
            <>
              <div className="h-4" />
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 rounded-sm bg-elevated overflow-hidden">
                  <div
                    className="h-full bg-accent-blue rounded-sm transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-secondary whitespace-nowrap">
                  {job.progress.processed} / {job.progress.total}
                </span>
              </div>

              {/* 当前文件 */}
              {job.progress.currentFile && (
                <div className="mt-1 pl-[30px]">
                  <span className="text-xs text-muted truncate block">
                    正在处理: {job.progress.currentFile}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* 统计信息 */}
        {(job.status === "done" || job.status === "running" || job.status === "committing") && (
          <>
            <div className="flex items-center gap-1.5 text-[13px]">
              {job.status === "done" && job.result ? (
                <span className="text-muted">
                  {job.result.importedNotes} 篇笔记 · {job.result.importedImages} 张图片
                </span>
              ) : (
                <>
                  <span className="text-muted">扫描</span>
                  <span className="text-foreground font-medium">{job.progress.totalFiles}</span>
                  <span className="text-muted">篇笔记</span>
                  <span className="text-placeholder">·</span>
                  <span className="text-foreground font-medium">{job.progress.totalImages}</span>
                  <span className="text-muted">张图片</span>
                </>
              )}
            </div>

            {job.status === "done" && job.result && (
              <div className="flex items-center gap-1.5 text-[13px]">
                <span className="text-muted">
                  {job.result.newViewpoints} 个新观点 · 关联 {job.result.linkedViewpoints} 个已有观点
                </span>
              </div>
            )}
          </>
        )}

        {/* 错误信息（失败时） */}
        {job.status === "failed" && job.errorMessage && (
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[13px] text-secondary">{job.errorMessage}</span>
            <span className="text-xs text-muted">已自动回滚，数据未变更</span>
          </div>
        )}

        {/* 操作按钮 */}
        {job.status === "done" && (
          <Button
            onClick={() => router.push("/knowledge")}
            className="h-[38px] px-5 rounded-sm bg-accent-blue text-white text-[13px] font-medium hover:bg-accent-blue/90"
          >
            前往知识库查看
          </Button>
        )}

        {job.status === "failed" && (
          <div className="flex items-center gap-2.5">
            <Button
              onClick={handleRetry}
              className="h-9 px-[18px] rounded-sm bg-accent-blue text-white text-[13px] font-medium hover:bg-accent-blue/90"
            >
              重试
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push("/settings")}
              className="h-9 px-[18px] rounded-sm border-border text-secondary text-[13px] hover:bg-surface"
            >
              返回设置
            </Button>
          </div>
        )}

        {job.status === "cancelled" && (
          <Button
            variant="secondary"
            onClick={() => router.push("/settings")}
            className="h-9 px-[18px] rounded-sm border-border text-secondary text-[13px] hover:bg-surface"
          >
            返回设置
          </Button>
        )}

        {!isTerminal && (
          <Button
            variant="secondary"
            onClick={handleCancel}
            className="h-9 px-[18px] rounded-sm border-border text-secondary text-[13px] hover:bg-surface"
          >
            取消导入
          </Button>
        )}
      </div>
    </div>
  )
}
