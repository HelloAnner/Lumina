/**
 * 审批台三栏布局
 * 左：任务筛选 | 中：Patch 列表 | 右：Patch 详情 + 追问
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
  MessageSquare,
  Send,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { cn } from "@/src/lib/utils"
import type { ScoutPatch, ScoutTask } from "@/src/server/store/types"

interface Props {
  tasks: ScoutTask[]
  patches: ScoutPatch[]
  onPatchesChange: (patches: ScoutPatch[]) => void
}

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "merged"

export function ReviewPanel({ tasks, patches, onPatchesChange }: Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending")
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null)
  const [expandInput, setExpandInput] = useState("")
  const [expanding, setExpanding] = useState(false)
  const [toast, setToast] = useState<{ title: string; tone: "success" | "error" } | null>(null)

  const filtered = useMemo(() => {
    return patches.filter((p) => {
      if (selectedTaskId && p.taskId !== selectedTaskId) return false
      if (statusFilter !== "all" && p.status !== statusFilter) return false
      return true
    })
  }, [patches, selectedTaskId, statusFilter])

  const selectedPatch = useMemo(() => {
    return patches.find((p) => p.id === selectedPatchId)
  }, [patches, selectedPatchId])

  const handleApprove = useCallback(async (patchId: string) => {
    try {
      const res = await fetch(`/api/scout/patches/${patchId}/approve`, { method: "POST" })
      if (res.ok) {
        onPatchesChange(patches.map((p) =>
          p.id === patchId ? { ...p, status: "merged" as const, mergedAt: new Date().toISOString() } : p
        ))
        setToast({ title: "已合并到知识库", tone: "success" })
      }
    } catch {
      setToast({ title: "操作失败", tone: "error" })
    }
  }, [patches, onPatchesChange])

  const handleReject = useCallback(async (patchId: string) => {
    try {
      const res = await fetch(`/api/scout/patches/${patchId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
      if (res.ok) {
        onPatchesChange(patches.map((p) =>
          p.id === patchId ? { ...p, status: "rejected" as const } : p
        ))
        setToast({ title: "已拒绝", tone: "success" })
      }
    } catch {
      setToast({ title: "操作失败", tone: "error" })
    }
  }, [patches, onPatchesChange])

  const handleExpand = useCallback(async (patchId: string, message: string) => {
    if (!message.trim()) return
    setExpanding(true)
    try {
      const res = await fetch(`/api/scout/patches/${patchId}/expand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() })
      })
      if (res.ok) {
        const { item } = await res.json()
        onPatchesChange(patches.map((p) => (p.id === patchId ? item : p)))
        setExpandInput("")
      }
    } catch {
      setToast({ title: "追问失败", tone: "error" })
    } finally {
      setExpanding(false)
    }
  }, [patches, onPatchesChange])

  return (
    <div className="flex h-full">
      {/* 左栏：任务筛选 */}
      <div className="w-52 shrink-0 border-r border-border overflow-y-auto px-3 py-3">
        <div className="mb-2 flex items-center gap-1 text-[11px] font-medium text-muted uppercase tracking-wide">
          <Filter className="h-3 w-3" />
          任务筛选
        </div>
        <button
          onClick={() => setSelectedTaskId(null)}
          className={cn(
            "mb-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
            !selectedTaskId ? "bg-selected text-foreground" : "text-muted hover:bg-overlay"
          )}
        >
          全部任务
          <span className="ml-auto text-[11px]">{patches.length}</span>
        </button>
        {tasks.map((task) => {
          const count = patches.filter((p) => p.taskId === task.id).length
          return (
            <button
              key={task.id}
              onClick={() => setSelectedTaskId(task.id)}
              className={cn(
                "mb-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                selectedTaskId === task.id ? "bg-selected text-foreground" : "text-muted hover:bg-overlay"
              )}
            >
              <span className="truncate">{task.name}</span>
              <span className="ml-auto shrink-0 text-[11px]">{count}</span>
            </button>
          )
        })}

        <div className="mt-4 mb-2 text-[11px] font-medium text-muted uppercase tracking-wide">
          状态
        </div>
        {(["all", "pending", "approved", "rejected", "merged"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "mb-0.5 flex w-full items-center rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
              statusFilter === s ? "bg-selected text-foreground" : "text-muted hover:bg-overlay"
            )}
          >
            {{ all: "全部", pending: "待审批", approved: "已批准", rejected: "已拒绝", merged: "已合并" }[s]}
          </button>
        ))}
      </div>

      {/* 中栏：Patch 列表 */}
      <div className="w-80 shrink-0 border-r border-border overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <Clock className="mb-2 h-6 w-6 opacity-40" />
            <p className="text-[13px]">暂无 Patch</p>
            <p className="mt-1 text-[11px] text-muted/70">
              任务执行后会自动生成匹配建议
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((patch) => (
              <button
                key={patch.id}
                onClick={() => setSelectedPatchId(patch.id)}
                className={cn(
                  "flex flex-col gap-1 border-b border-border/40 px-4 py-3 text-left transition-colors",
                  selectedPatchId === patch.id ? "bg-selected/60" : "hover:bg-overlay/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-foreground line-clamp-1">
                    {patch.title}
                  </span>
                  <PatchStatusBadge status={patch.status} />
                </div>
                <p className="text-[12px] text-muted line-clamp-2">{patch.rationale}</p>
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <span>{patch.targetViewpointTitle}</span>
                  <span>·</span>
                  <span>相关度 {Math.round(patch.relevanceScore * 100)}%</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 右栏：Patch 详情 */}
      <div className="flex-1 overflow-y-auto">
        {selectedPatch ? (
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[16px] font-medium text-foreground">{selectedPatch.title}</h3>
              <PatchStatusBadge status={selectedPatch.status} />
            </div>

            {/* 来源信息 */}
            <div className="mb-4 rounded-lg border border-border/40 bg-overlay/30 p-3">
              <div className="flex items-center gap-2 text-[12px] text-muted">
                <ExternalLink className="h-3 w-3" />
                <a
                  href={selectedPatch.sourceSnapshot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {selectedPatch.sourceSnapshot.title ?? selectedPatch.sourceSnapshot.url}
                </a>
              </div>
              {selectedPatch.sourceSnapshot.author && (
                <p className="mt-1 text-[12px] text-muted">
                  作者：{selectedPatch.sourceSnapshot.author}
                </p>
              )}
              <p className="mt-2 text-[13px] text-foreground/80">
                {selectedPatch.sourceSnapshot.excerpt}
              </p>
            </div>

            {/* 理由 */}
            <div className="mb-4">
              <h4 className="mb-1 text-[12px] font-medium text-muted">匹配理由</h4>
              <p className="text-[13px] text-foreground/80">{selectedPatch.rationale}</p>
            </div>

            {/* 建议内容预览 */}
            <div className="mb-4">
              <h4 className="mb-2 text-[12px] font-medium text-muted">
                建议添加 ({selectedPatch.suggestedBlocks.length} 个块)
              </h4>
              <div className="rounded-lg border border-border/40 bg-overlay/20 p-3 space-y-2">
                {selectedPatch.suggestedBlocks.map((block, i) => (
                  <div key={block.id || i}>
                    {block.type === "heading" && (
                      <p className={cn(
                        "font-medium text-foreground",
                        (block as any).level === 1 ? "text-[16px]" : (block as any).level === 2 ? "text-[14px]" : "text-[13px]"
                      )}>
                        {(block as any).text}
                      </p>
                    )}
                    {block.type === "paragraph" && (
                      <p className="text-[13px] text-foreground/80 leading-relaxed">{(block as any).text}</p>
                    )}
                    {block.type === "quote" && (
                      <blockquote className="border-l-2 border-primary/30 pl-3 text-[13px] text-foreground/70 italic">
                        {(block as any).text}
                      </blockquote>
                    )}
                    {block.type === "insight" && (
                      <p className="rounded bg-primary/5 px-3 py-2 text-[13px] text-foreground/80">
                        {(block as any).text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 目标观点 */}
            <div className="mb-6 flex items-center gap-2 text-[12px] text-muted">
              <ChevronRight className="h-3 w-3" />
              目标观点：
              <span className="font-medium text-foreground">{selectedPatch.targetViewpointTitle}</span>
            </div>

            {/* 操作按钮 */}
            {(selectedPatch.status === "pending" || selectedPatch.status === "expanding") && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleApprove(selectedPatch.id)}
                  className="gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  批准合并
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleReject(selectedPatch.id)}
                  className="gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  拒绝
                </Button>
              </div>
            )}

            {/* 追问对话线程 */}
            <div className="mt-6 border-t border-border pt-4">
              <h4 className="mb-3 flex items-center gap-1 text-[12px] font-medium text-muted">
                <MessageSquare className="h-3 w-3" />
                追问与展开
              </h4>

              {/* 历史消息 */}
              {selectedPatch.thread && selectedPatch.thread.length > 0 && (
                <div className="mb-3 space-y-2">
                  {selectedPatch.thread.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "rounded-lg p-2.5 text-[13px]",
                        msg.role === "user"
                          ? "bg-primary/10 text-foreground ml-8"
                          : "bg-overlay/40 text-foreground/80 mr-8"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className="mt-1 text-[10px] text-muted">
                        {new Date(msg.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* 追问输入框 */}
              {(selectedPatch.status === "pending" || selectedPatch.status === "expanding") && (
                <div className="flex items-center gap-2">
                  <Input
                    value={expandInput}
                    onChange={(e) => setExpandInput(e.target.value)}
                    placeholder="输入追问，进一步了解此条目..."
                    className="h-8 flex-1 text-[13px]"
                    disabled={expanding}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleExpand(selectedPatch.id, expandInput)
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleExpand(selectedPatch.id, expandInput)}
                    disabled={expanding || !expandInput.trim()}
                    className="h-8 w-8 p-0"
                  >
                    {expanding ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted">
            <Clock className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-[14px]">选择一个 Patch 查看详情</p>
            <p className="mt-1 text-[12px] text-muted/70">
              Patch 由任务执行后自动匹配生成
            </p>
          </div>
        )}
      </div>

      {toast && (
        <Toast title={toast.title} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

function PatchStatusBadge({ status }: { status: ScoutPatch["status"] }) {
  const config = {
    pending: { label: "待审批", className: "bg-amber-500/15 text-amber-400" },
    approved: { label: "已批准", className: "bg-green-500/15 text-green-400" },
    merged: { label: "已合并", className: "bg-blue-500/15 text-blue-400" },
    rejected: { label: "已拒绝", className: "bg-red-500/15 text-red-300" },
    expanding: { label: "追问中", className: "bg-purple-500/15 text-purple-400" },
  }[status]

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", config.className)}>
      {config.label}
    </span>
  )
}
