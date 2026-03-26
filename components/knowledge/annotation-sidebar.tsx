/**
 * 批注侧栏
 * 展示当前观点的批注列表，支持新增批注（划词/对话）
 *
 * @author Anner
 * @since 0.2.0
 * Created on 2026/3/24
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  CheckCircle,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Send,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/src/lib/utils"
import type { Annotation, AnnotationMode } from "@/src/server/store/types"

interface AnnotationSidebarProps {
  viewpointId: string | undefined
  /** 划词选中信息 */
  selectionContext: SelectionContext | null
  onClearSelection: () => void
  onAnnotationsChange?: (annotations: Annotation[]) => void
}

export interface SelectionContext {
  blockId: string
  text: string
}

/**
 * 批注侧栏主组件
 */
export function AnnotationSidebar({
  viewpointId,
  selectionContext,
  onClearSelection,
  onAnnotationsChange
}: AnnotationSidebarProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [loading, setLoading] = useState(false)
  const [composerMode, setComposerMode] = useState<AnnotationMode | null>(null)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 加载批注
  const fetchAnnotations = useCallback(async () => {
    if (!viewpointId) {
      setAnnotations([])
      return
    }
    try {
      const res = await fetch(`/api/annotations/${viewpointId}`)
      const data = await res.json()
      const items = data.items ?? []
      setAnnotations(items)
      onAnnotationsChange?.(items)
    } catch {
      /* ignore */
    }
  }, [viewpointId, onAnnotationsChange])

  useEffect(() => {
    setLoading(true)
    void fetchAnnotations().finally(() => setLoading(false))
  }, [fetchAnnotations])

  // 轮询处理中的批注状态
  useEffect(() => {
    const hasProcessing = annotations.some(
      (a) => a.status === "pending" || a.status === "processing"
    )
    if (hasProcessing) {
      pollRef.current = setInterval(() => void fetchAnnotations(), 3000)
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [annotations, fetchAnnotations])

  // 划词触发
  useEffect(() => {
    if (selectionContext) {
      setComposerMode("selection")
      setComment("")
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [selectionContext])

  const submitAnnotation = async () => {
    if (!viewpointId || !comment.trim()) {
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        mode: composerMode ?? "chat",
        comment: comment.trim()
      }
      if (composerMode === "selection" && selectionContext) {
        body.targetBlockId = selectionContext.blockId
        body.targetText = selectionContext.text
      }
      await fetch(`/api/annotations/${viewpointId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      })
      setComment("")
      setComposerMode(null)
      onClearSelection()
      await fetchAnnotations()
    } finally {
      setSubmitting(false)
    }
  }

  const pendingCount = annotations.filter(
    (a) => a.status === "pending" || a.status === "processing"
  ).length
  const doneAnnotations = annotations.filter((a) => a.status === "done")
  const activeAnnotations = annotations.filter(
    (a) => a.status !== "done" && a.status !== "failed"
  )
  const failedAnnotations = annotations.filter((a) => a.status === "failed")

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-1.5">
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-medium text-warning">
              {pendingCount} 待处理
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted hover:text-foreground"
          onClick={() => {
            setComposerMode(composerMode ? null : "chat")
            setComment("")
            onClearSelection()
          }}
          title="新增对话批注"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 批注输入区 */}
      {composerMode && (
        <div className="shrink-0 border-b border-border/40 p-3">
          {composerMode === "selection" && selectionContext && (
            <div className="mb-2 flex items-start gap-2 rounded-md bg-elevated/60 p-2">
              <span className="text-[11px] leading-relaxed text-muted line-clamp-2">
                &ldquo;{selectionContext.text}&rdquo;
              </span>
              <button
                className="shrink-0 text-muted/50 hover:text-foreground"
                onClick={() => {
                  onClearSelection()
                  setComposerMode(null)
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <textarea
            ref={inputRef}
            className="w-full resize-none rounded-md border border-border/40 bg-elevated/30 px-3 py-2 text-[12px] leading-relaxed text-foreground outline-none placeholder:text-muted/40 focus:border-primary/40"
            rows={3}
            placeholder={
              composerMode === "selection"
                ? "输入修改意见…"
                : "告诉 AI 你想补充什么内容…"
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                void submitAnnotation()
              }
              if (e.key === "Escape") {
                setComposerMode(null)
                setComment("")
                onClearSelection()
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-muted">
              {composerMode === "selection" ? "划词批注" : "对话批注"} · Cmd+Enter 发送
            </span>
            <Button
              size="sm"
              className="h-6 gap-1 px-2 text-[11px]"
              disabled={!comment.trim() || submitting}
              onClick={() => void submitAnnotation()}
            >
              {submitting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              发送
            </Button>
          </div>
        </div>
      )}

      {/* 批注列表 */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-[12px] text-muted">加载中…</p>
          </div>
        ) : annotations.length === 0 && !composerMode ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="mb-2 h-6 w-6 text-muted/20" />
            <p className="text-[12px] text-muted">暂无批注</p>
            <p className="mt-1 text-[11px] text-muted">
              选中文字后按 C，或点击右上角添加
            </p>
          </div>
        ) : (
          <>
            {/* 活跃批注 */}
            {activeAnnotations.map((annotation) => (
              <AnnotationCard key={annotation.id} annotation={annotation} />
            ))}
            {/* 失败批注 */}
            {failedAnnotations.map((annotation) => (
              <AnnotationCard key={annotation.id} annotation={annotation} />
            ))}
            {/* 已完成分隔 */}
            {doneAnnotations.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2">
                  <CheckCircle className="h-3 w-3 text-muted" />
                  <span className="text-[11px] text-muted">已完成</span>
                </div>
                {doneAnnotations.map((annotation) => (
                  <AnnotationCard
                    key={annotation.id}
                    annotation={annotation}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AnnotationCard({ annotation }: { annotation: Annotation }) {
  const statusConfig = {
    pending: {
      bg: "bg-muted/20",
      text: "text-secondary",
      label: "等待中",
      dot: "bg-secondary"
    },
    processing: {
      bg: "bg-warning/20",
      text: "text-warning",
      label: "处理中",
      dot: "bg-warning"
    },
    done: {
      bg: "bg-success/20",
      text: "text-success",
      label: "已完成",
      dot: "bg-success"
    },
    failed: {
      bg: "bg-error/20",
      text: "text-error",
      label: "失败",
      dot: "bg-error"
    }
  }

  const config = statusConfig[annotation.status]
  const isDone = annotation.status === "done"
  const timeAgo = formatTimeAgo(annotation.createdAt)

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        isDone
          ? "border-border/20 bg-surface opacity-60"
          : annotation.status === "failed"
            ? "border-error/20 bg-elevated/30"
            : annotation.status === "processing"
              ? "border-warning/30 bg-elevated/40"
              : "border-border/30 bg-elevated/30"
      )}
    >
      {/* 状态头 */}
      <div className="mb-2 flex items-center justify-between">
        <div
          className={cn(
            "flex items-center gap-1.5 rounded px-1.5 py-0.5",
            config.bg
          )}
        >
          <div className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
          <span className={cn("text-[10px] font-medium", config.text)}>
            {config.label}
          </span>
        </div>
        <span className="text-[10px] text-muted">{timeAgo}</span>
      </div>

      {/* 选中原文 */}
      {annotation.targetText && (
        <div className="mb-2 rounded bg-elevated/60 px-2 py-1">
          <p className="text-[11px] leading-relaxed text-muted line-clamp-2">
            &ldquo;{annotation.targetText}&rdquo;
          </p>
        </div>
      )}

      {/* 批注内容 */}
      <p className="text-[12px] leading-relaxed text-foreground/80">
        {annotation.comment}
      </p>

      {/* 错误信息 */}
      {annotation.errorMessage && (
        <p className="mt-1.5 text-[11px] text-error/80">
          {annotation.errorMessage}
        </p>
      )}
    </div>
  )
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) {
    return "刚刚"
  }
  if (minutes < 60) {
    return `${minutes}分钟前`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}小时前`
  }
  const days = Math.floor(hours / 24)
  return `${days}天前`
}
