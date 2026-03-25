"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Download,
  FilePlus,
  FileText,
  FolderOpen,
  GripVertical,
  MessageSquare,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Toast } from "@/components/ui/toast"
import { NoteBlockList } from "@/components/knowledge/note-block-renderer"
import {
  AnnotationSidebar,
  type SelectionContext
} from "@/components/knowledge/annotation-sidebar"
import {
  buildViewpointTree,
  collectViewpointSubtreeIds,
  moveViewpointNode,
  serializeViewpointOrder,
  type ViewpointDropTarget,
  type ViewpointTreeNode
} from "@/components/knowledge/viewpoint-tree-utils"
import { cn } from "@/src/lib/utils"
import type {
  Annotation,
  Highlight,
  NoteBlock,
  Viewpoint
} from "@/src/server/store/types"

type DraftNode = {
  parentId?: string
  placement: "root" | "child"
}

/**
 * 知识库页面客户端容器
 * 主题树 + 只读笔记面板 + 批注侧栏
 *
 * @author Anner
 * @since 0.2.0
 * Created on 2026/3/24
 */
export function KnowledgeClient({
  initialViewpoints,
  initialSelected,
  unconfirmed,
  initialWidths
}: {
  initialViewpoints: Viewpoint[]
  initialSelected?: Viewpoint
  unconfirmed: (Highlight & { similarityScore?: number })[]
  initialWidths: {
    knowledgeTreeWidth: number
    knowledgeListWidth: number
  }
}) {
  const [toast, setToast] = useState("")
  const [viewpoints, setViewpoints] = useState(initialViewpoints)
  const [selectedId, setSelectedId] = useState(
    initialSelected?.id ?? initialViewpoints[0]?.id
  )
  const [blocks, setBlocks] = useState<NoteBlock[]>(
    initialSelected?.articleBlocks ?? []
  )
  const [treeWidth, setTreeWidth] = useState(initialWidths.knowledgeTreeWidth)
  const [annoWidth, setAnnoWidth] = useState(initialWidths.knowledgeListWidth)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialViewpoints.map((v) => [v.id, true]))
  )
  const [focusedParentId, setFocusedParentId] = useState<string | null>(
    initialSelected?.id ?? null
  )
  const [draftNode, setDraftNode] = useState<DraftNode | null>(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<ViewpointDropTarget | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectionCtx, setSelectionCtx] = useState<SelectionContext | null>(null)
  const [annotatedBlockIds, setAnnotatedBlockIds] = useState<Set<string>>(
    new Set()
  )

  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selected = viewpoints.find((v) => v.id === selectedId)
  const tree = useMemo(() => buildViewpointTree(viewpoints), [viewpoints])

  // 加载笔记块
  useEffect(() => {
    if (!selectedId) {
      setBlocks([])
      return
    }
    void (async () => {
      try {
        const res = await fetch(`/api/viewpoints/${selectedId}/blocks`)
        const data = await res.json()
        setBlocks(data.blocks ?? [])
      } catch {
        setBlocks([])
      }
    })()
  }, [selectedId])

  const selectViewpoint = useCallback((viewpointId: string) => {
    setSelectedId(viewpointId)
    setFocusedParentId(viewpointId)
    setSelectionCtx(null)
  }, [])

  // 保存宽度偏好
  useEffect(() => {
    if (prefTimer.current) {
      clearTimeout(prefTimer.current)
    }
    prefTimer.current = setTimeout(async () => {
      await fetch("/api/preferences/ui", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          knowledgeTreeWidth: Math.round(treeWidth),
          knowledgeListWidth: Math.round(annoWidth)
        })
      })
    }, 180)
    return () => {
      if (prefTimer.current) {
        clearTimeout(prefTimer.current)
      }
    }
  }, [annoWidth, treeWidth])

  const createResizeHandler = useCallback(
    (
      initialWidth: number,
      onResize: (w: number) => void,
      reverse = false
    ) => {
      return (event: React.MouseEvent) => {
        event.preventDefault()
        const startX = event.clientX
        const move = (e: MouseEvent) => {
          const delta = e.clientX - startX
          const next = reverse ? initialWidth - delta : initialWidth + delta
          onResize(Math.min(420, Math.max(180, next)))
        }
        const up = () => {
          window.removeEventListener("mousemove", move)
          window.removeEventListener("mouseup", up)
        }
        window.addEventListener("mousemove", move)
        window.addEventListener("mouseup", up)
      }
    },
    []
  )

  const persistViewpointOrder = useCallback(async (items: Viewpoint[]) => {
    const updates = serializeViewpointOrder(items)
    const results = await Promise.all(
      updates.map((u) =>
        fetch(`/api/viewpoints/${u.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ parentId: u.parentId, sortOrder: u.sortOrder })
        })
      )
    )
    if (results.some((r) => !r.ok)) {
      throw new Error("persist order failed")
    }
  }, [])

  const applyDrop = useCallback(
    async (target: ViewpointDropTarget) => {
      if (!draggingId) {
        return
      }
      const prev = viewpoints
      const next = moveViewpointNode(prev, { sourceId: draggingId, target })
      const prevOrder = JSON.stringify(serializeViewpointOrder(prev))
      const nextOrder = JSON.stringify(serializeViewpointOrder(next))
      setDraggingId(null)
      setDropTarget(null)
      if (prevOrder === nextOrder) {
        return
      }
      setViewpoints(next)
      if (target.type === "inside") {
        setExpanded((c) => ({ ...c, [target.targetId]: true }))
      }
      try {
        await persistViewpointOrder(next)
      } catch {
        setViewpoints(prev)
      }
    },
    [draggingId, persistViewpointOrder, viewpoints]
  )

  async function submitDraft() {
    if (!draftNode || !draftTitle.trim()) {
      setDraftNode(null)
      setDraftTitle("")
      return
    }
    const res = await fetch("/api/viewpoints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: draftTitle.trim(),
        parentId: draftNode.parentId,
        isFolder: false
      })
    })
    const data = await res.json()
    if (res.ok) {
      setViewpoints((c) => [...c, data.item])
      if (draftNode.parentId) {
        setExpanded((c) => ({ ...c, [draftNode.parentId!]: true }))
      }
      setSelectedId(data.item.id)
      setFocusedParentId(data.item.id)
      setBlocks(data.item.articleBlocks ?? [])
    }
    setDraftNode(null)
    setDraftTitle("")
  }

  function openDraft(parentId: string | undefined) {
    setDraftNode({ parentId, placement: parentId ? "child" : "root" })
    setDraftTitle("")
    if (parentId) {
      setExpanded((c) => ({ ...c, [parentId]: true }))
    }
  }

  async function deleteViewpoint(viewpointId: string) {
    const subtreeIds = collectViewpointSubtreeIds(viewpoints, viewpointId)
    if (!subtreeIds.length) {
      return
    }
    const childCount = Math.max(0, subtreeIds.length - 1)
    setToast(
      childCount > 0
        ? `已删除主题及 ${childCount} 个子主题`
        : "已删除主题"
    )
    const nextVps = viewpoints.filter((v) => !subtreeIds.includes(v.id))
    const nextSelected = nextVps[0]
    setDeletingId(viewpointId)
    setViewpoints(nextVps)
    if (selectedId && subtreeIds.includes(selectedId)) {
      setSelectedId(nextSelected?.id)
      setBlocks(nextSelected?.articleBlocks ?? [])
    }
    if (
      focusedParentId &&
      subtreeIds.includes(focusedParentId)
    ) {
      setFocusedParentId(nextSelected?.id ?? null)
    }
    try {
      await Promise.all(
        [...subtreeIds]
          .reverse()
          .map((id) => fetch(`/api/viewpoints/${id}`, { method: "DELETE" }))
      )
    } catch {
      setViewpoints(viewpoints)
    } finally {
      setDeletingId(null)
    }
  }

  /** 划词回调 */
  const handleSelectText = useCallback(
    (blockId: string, text: string) => {
      setSelectionCtx({ blockId, text })
    },
    []
  )

  /** 批注变更回调 */
  const handleAnnotationsChange = useCallback((annos: Annotation[]) => {
    const ids = new Set<string>()
    for (const a of annos) {
      if (a.targetBlockId && a.status !== "done") {
        ids.add(a.targetBlockId)
      }
    }
    setAnnotatedBlockIds(ids)

    // 如果有刚完成的批注，刷新 blocks
    const justDone = annos.some((a) => a.status === "done")
    if (justDone) {
      void refreshBlocks()
    }
  }, [])

  const refreshBlocks = async () => {
    if (!selectedId) {
      return
    }
    try {
      const res = await fetch(`/api/viewpoints/${selectedId}/blocks`)
      const data = await res.json()
      setBlocks(data.blocks ?? [])
    } catch {
      /* ignore */
    }
  }

  // ---- 元信息 ----
  const blockCount = blocks.length
  const charCount = blocks.reduce((sum, b) => {
    if ("text" in b) {
      return sum + (b as { text: string }).text.length
    }
    if ("code" in b) {
      return sum + (b as { code: string }).code.length
    }
    return sum
  }, 0)
  const pendingAnnoCount = [...annotatedBlockIds].length

  // ---- 渲染辅助 ----
  function renderDraft(depth: number) {
    if (!draftNode) {
      return null
    }
    return (
      <div className="py-0.5" style={{ paddingLeft: 8 + depth * 16 }}>
        <input
          autoFocus
          className="h-7 w-full rounded border border-primary/40 bg-elevated px-2 text-[13px] text-foreground outline-none focus:border-primary"
          placeholder="输入主题名称"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={submitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void submitDraft()
            }
            if (e.key === "Escape") {
              setDraftNode(null)
              setDraftTitle("")
            }
          }}
        />
      </div>
    )
  }

  function renderDropZone(
    depth: number,
    target: ViewpointDropTarget,
    className = ""
  ) {
    const active =
      dropTarget?.type === target.type &&
      (dropTarget.type === "root" ||
        (target.type !== "root" &&
          dropTarget.targetId === target.targetId))
    return (
      <div
        className={cn(
          "h-0.5 rounded-full transition-all",
          draggingId ? "opacity-100" : "opacity-0",
          active
            ? "bg-primary/60"
            : "bg-transparent hover:bg-primary/30",
          className
        )}
        style={{ marginLeft: 8 + depth * 16 }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDropTarget(target)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void applyDrop(target)
        }}
      />
    )
  }

  function renderNode(node: ViewpointTreeNode, depth = 0): React.ReactNode {
    const isExpanded = expanded[node.id] ?? true
    const active = selectedId === node.id
    const hasChildren = node.children.length > 0
    const showDraft =
      draftNode?.parentId === node.id && draftNode.placement === "child"
    const insideActive =
      dropTarget?.type === "inside" && dropTarget.targetId === node.id
    const indentLeft = 8 + depth * 16

    return (
      <div key={node.id} className="relative">
        {depth > 0 && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/25"
            style={{ left: indentLeft - 8 }}
          />
        )}
        {renderDropZone(depth, { type: "before", targetId: node.id })}
        <button
          draggable
          className={cn(
            "group relative flex w-full items-center gap-1 rounded-sm py-[3px] pr-2 text-left text-[13px] transition-colors",
            active
              ? "bg-overlay/80 text-foreground before:absolute before:left-0 before:top-0.5 before:bottom-0.5 before:w-[2px] before:rounded-full before:bg-primary/80 before:content-['']"
              : insideActive
                ? "bg-primary/8 text-foreground"
                : "text-secondary hover:bg-overlay/50 hover:text-foreground"
          )}
          style={{ paddingLeft: indentLeft }}
          onClick={() => selectViewpoint(node.id)}
          onDragStart={() => {
            setDraggingId(node.id)
            setDropTarget(null)
          }}
          onDragEnd={() => {
            setDraggingId(null)
            setDropTarget(null)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDropTarget({ type: "inside", targetId: node.id })
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void applyDrop({ type: "inside", targetId: node.id })
          }}
        >
          <GripVertical className="h-3 w-3 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-60" />
          {hasChildren ? (
            <span
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted transition-colors hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((c) => ({ ...c, [node.id]: !isExpanded }))
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          ) : (
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted/50">
              <FileText className="h-3 w-3" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{node.title}</span>
          {node.highlightCount > 0 && (
            <span className="shrink-0 rounded px-1 text-[10px] tabular-nums text-muted/60">
              {node.highlightCount}
            </span>
          )}
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              void deleteViewpoint(node.id)
            }}
          >
            {deletingId === node.id ? (
              <X className="h-3 w-3 animate-pulse" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </span>
        </button>
        {showDraft ? renderDraft(depth + 1) : null}
        {hasChildren && isExpanded
          ? node.children.map((c) => renderNode(c, depth + 1))
          : null}
        {renderDropZone(depth, { type: "after", targetId: node.id })}
      </div>
    )
  }

  return (
    <>
      {toast ? <Toast title={toast} onClose={() => setToast("")} /> : null}
      <div className="flex h-screen overflow-hidden bg-surface">
        {/* 左侧主题树 */}
        <aside
          className="relative flex shrink-0 flex-col border-r border-border/50 bg-surface"
          style={{ width: treeWidth }}
        >
          <div className="flex h-11 items-center justify-between px-3 border-b border-border/40">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted/70">
              主题树
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDraft(focusedParentId ?? undefined)}
              className="h-6 w-6 p-0 text-muted hover:text-foreground"
              title="新建主题"
            >
              <FilePlus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-1 px-1">
            <button
              className={cn(
                "flex w-full items-center gap-1.5 rounded-sm px-2 py-[3px] text-left text-[13px] transition-colors",
                focusedParentId === null
                  ? "text-foreground bg-overlay/60"
                  : "text-muted hover:bg-overlay/40 hover:text-secondary"
              )}
              onClick={() => {
                setFocusedParentId(null)
                setDraftNode(null)
              }}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted/60" />
              <span className="truncate">全部主题</span>
            </button>
            {draftNode?.placement === "root" ? renderDraft(0) : null}
            {tree.map((node) => renderNode(node))}
            {draggingId ? (
              <div className="mt-2 px-2">
                {renderDropZone(
                  0,
                  { type: "root" },
                  "h-6 border border-dashed border-border/40 rounded"
                )}
                <p className="mt-1 px-1 text-[11px] text-muted/50">
                  拖到这里放到根目录
                </p>
              </div>
            ) : null}
          </div>
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20"
            onMouseDown={createResizeHandler(treeWidth, setTreeWidth)}
          />
        </aside>

        {/* 中央笔记面板 - 只读展示 */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* 顶部标题栏 */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 bg-surface px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="truncate text-[15px] font-semibold text-foreground">
                {selected?.title ?? "未选择主题"}
              </span>
              {selected?.lastSynthesizedAt && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  AI 生成
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-[12px] text-muted hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                导出
              </Button>
            </div>
          </div>

          {/* 元信息栏 */}
          {selected && (
            <div className="flex shrink-0 items-center gap-4 border-b border-border/30 bg-surface/80 px-6 py-1.5">
              <div className="flex items-center gap-1.5 text-muted/60">
                <BookOpen className="h-3 w-3" />
                <span className="text-[11px]">
                  来自 {selected.relatedBookIds.length} 本书 · {selected.highlightCount} 条划线
                </span>
              </div>
              {pendingAnnoCount > 0 && (
                <>
                  <span className="text-[11px] text-muted/30">·</span>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3 text-primary" />
                    <span className="text-[11px] font-medium text-primary">
                      {pendingAnnoCount} 条批注待处理
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 笔记块内容 */}
          <div className="relative min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-8 py-8">
              <NoteBlockList
                blocks={blocks}
                annotatedBlockIds={annotatedBlockIds}
                onSelectText={handleSelectText}
              />
            </div>
          </div>

          {/* 底部状态栏 */}
          <div className="flex h-8 shrink-0 items-center justify-between border-t border-border/30 bg-surface/80 px-6">
            <div className="flex items-center gap-2">
              {pendingAnnoCount > 0 && (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-warning" />
                  <span className="text-[11px] text-secondary">
                    {pendingAnnoCount} 条批注排队中
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted/50">
              <span>{charCount.toLocaleString()} 字</span>
              <span>{blockCount} 个块</span>
            </div>
          </div>
        </main>

        {/* 右侧批注侧栏 */}
        <aside
          className="relative flex shrink-0 flex-col border-l border-border/50 bg-surface"
          style={{ width: annoWidth }}
        >
          <div
            className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20"
            onMouseDown={createResizeHandler(annoWidth, setAnnoWidth, true)}
          />
          <AnnotationSidebar
            viewpointId={selectedId}
            selectionContext={selectionCtx}
            onClearSelection={() => setSelectionCtx(null)}
            onAnnotationsChange={handleAnnotationsChange}
          />
        </aside>
      </div>
    </>
  )
}
