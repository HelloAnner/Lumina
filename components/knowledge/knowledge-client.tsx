"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Bold,
  Code2,
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
  FilePlus,
  GripVertical,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Mail,
  Quote,
  Trash2,
  X
} from "lucide-react"
import { marked } from "marked"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  applyInlineMarkdown,
  applyLinePrefixMarkdown,
  buildKnowledgeEditorStats
} from "@/components/knowledge/knowledge-editor-utils"
import {
  buildViewpointTree,
  collectViewpointSubtreeIds,
  moveViewpointNode,
  serializeViewpointOrder,
  type ViewpointDropTarget,
  type ViewpointTreeNode
} from "@/components/knowledge/viewpoint-tree-utils"
import { cn } from "@/src/lib/utils"
import type { Highlight, Viewpoint } from "@/src/server/store/types"

type DraftNode = {
  parentId?: string
  placement: "root" | "child"
}

type ViewMode = "edit" | "preview" | "split"

/**
 * 知识库页面客户端容器
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
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
  const [viewpoints, setViewpoints] = useState(initialViewpoints)
  const [selectedId, setSelectedId] = useState(initialSelected?.id ?? initialViewpoints[0]?.id)
  const [article, setArticle] = useState(initialSelected?.articleContent ?? "")
  const [treeWidth, setTreeWidth] = useState(initialWidths.knowledgeTreeWidth)
  const [relationWidth, setRelationWidth] = useState(initialWidths.knowledgeListWidth)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialViewpoints.map((item) => [item.id, true]))
  )
  const [focusedParentId, setFocusedParentId] = useState<string | null>(
    initialSelected?.id ?? null
  )
  const [draftNode, setDraftNode] = useState<DraftNode | null>(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<ViewpointDropTarget | null>(null)
  const [pendingNotes, setPendingNotes] = useState(unconfirmed)
  const [loadingPendingNotes, setLoadingPendingNotes] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("edit")
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = viewpoints.find((item) => item.id === selectedId)
  const tree = useMemo(() => buildViewpointTree(viewpoints), [viewpoints])
  const previewHtml = useMemo(() => marked.parse(article), [article])
  const editorStats = useMemo(() => buildKnowledgeEditorStats(article), [article])

  const createResizeHandler = useCallback(
    (initialWidth: number, onResize: (width: number) => void, reverse = false) => {
      return (event: React.MouseEvent) => {
        event.preventDefault()
        const startX = event.clientX
        const move = (moveEvent: MouseEvent) => {
          const delta = moveEvent.clientX - startX
          const nextWidth = reverse ? initialWidth - delta : initialWidth + delta
          onResize(Math.min(420, Math.max(180, nextWidth)))
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
    const responses = await Promise.all(
      updates.map((item) =>
        fetch(`/api/viewpoints/${item.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            parentId: item.parentId,
            sortOrder: item.sortOrder
          })
        })
      )
    )
    if (responses.some((response) => !response.ok)) {
      throw new Error("persist viewpoint order failed")
    }
  }, [])

  const applyDrop = useCallback(
    async (target: ViewpointDropTarget) => {
      if (!draggingId) {
        return
      }
      const previous = viewpoints
      const next = moveViewpointNode(previous, {
        sourceId: draggingId,
        target
      })
      const previousOrder = JSON.stringify(serializeViewpointOrder(previous))
      const nextOrder = JSON.stringify(serializeViewpointOrder(next))
      setDraggingId(null)
      setDropTarget(null)
      if (previousOrder === nextOrder) {
        return
      }
      setViewpoints(next)
      if (target.type === "inside") {
        setExpanded((current) => ({ ...current, [target.targetId]: true }))
      }
      try {
        await persistViewpointOrder(next)
      } catch {
        setViewpoints(previous)
      }
    },
    [draggingId, persistViewpointOrder, viewpoints]
  )

  useEffect(() => {
    if (!selectedId) {
      setPendingNotes([])
      return
    }
    let cancelled = false
    setLoadingPendingNotes(true)
    fetch(`/api/viewpoints/${selectedId}/highlights`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setPendingNotes(data.items ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPendingNotes([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPendingNotes(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  useEffect(() => {
    if (!selected) {
      return
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
    }
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/viewpoints/${selected.id}/article`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ articleContent: article })
      })
    }, 500)
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }
    }
  }, [article, selected])

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
          knowledgeListWidth: Math.round(relationWidth)
        })
      })
    }, 180)
    return () => {
      if (prefTimer.current) {
        clearTimeout(prefTimer.current)
      }
    }
  }, [relationWidth, treeWidth])

  async function submitDraft() {
    if (!draftNode || !draftTitle.trim()) {
      setDraftNode(null)
      setDraftTitle("")
      return
    }
    const response = await fetch("/api/viewpoints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: draftTitle.trim(),
        parentId: draftNode.parentId,
        isFolder: false
      })
    })
    const data = await response.json()
    if (response.ok) {
      setViewpoints((current) => [...current, data.item])
      if (draftNode.parentId) {
        setExpanded((current) => ({ ...current, [draftNode.parentId!]: true }))
      }
      setSelectedId(data.item.id)
      setFocusedParentId(data.item.id)
      setArticle(data.item.articleContent)
    }
    setDraftNode(null)
    setDraftTitle("")
  }

  function openDraft(parentId: string | undefined) {
    setDraftNode({
      parentId,
      placement: parentId ? "child" : "root"
    })
    setDraftTitle("")
    if (parentId) {
      setExpanded((current) => ({ ...current, [parentId]: true }))
    }
  }

  async function deleteViewpoint(viewpointId: string) {
    const subtreeIds = collectViewpointSubtreeIds(viewpoints, viewpointId)
    if (!subtreeIds.length) {
      return
    }
    const childCount = Math.max(0, subtreeIds.length - 1)
    const confirmed = window.confirm(
      childCount > 0
        ? `确认删除该观点及其 ${childCount} 个子观点吗？`
        : "确认删除该观点吗？"
    )
    if (!confirmed) {
      return
    }

    const nextViewpoints = viewpoints.filter((item) => !subtreeIds.includes(item.id))
    const nextSelected = nextViewpoints[0]
    const shouldResetSelection =
      (selectedId && subtreeIds.includes(selectedId)) ||
      (focusedParentId && subtreeIds.includes(focusedParentId))

    setDeletingId(viewpointId)
    setViewpoints(nextViewpoints)
    if (selectedId && subtreeIds.includes(selectedId)) {
      setSelectedId(nextSelected?.id)
      setArticle(nextSelected?.articleContent ?? "")
    }
    if (shouldResetSelection) {
      setFocusedParentId(nextSelected?.id ?? null)
    }
    if (draftNode?.parentId && subtreeIds.includes(draftNode.parentId)) {
      setDraftNode(null)
      setDraftTitle("")
    }

    try {
      await Promise.all(
        [...subtreeIds]
          .reverse()
          .map((id) =>
            fetch(`/api/viewpoints/${id}`, {
              method: "DELETE"
            })
          )
      )
    } catch {
      setViewpoints(viewpoints)
      setSelectedId(selectedId)
      setFocusedParentId(focusedParentId)
      setArticle(selected?.articleContent ?? article)
    } finally {
      setDeletingId(null)
    }
  }

  function updateEditorSelection(
    nextText: string,
    nextSelectionStart: number,
    nextSelectionEnd: number
  ) {
    const textarea = editorRef.current
    if (!textarea) {
      return
    }
    setArticle(nextText)
    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd)
    })
  }

  const toolbarItems = [
    {
      label: "H1",
      icon: Heading1,
      action: () => {
        const textarea = editorRef.current
        if (!textarea) return
        const result = applyLinePrefixMarkdown(
          article,
          textarea.selectionStart,
          textarea.selectionEnd,
          "# ",
          "一级标题"
        )
        updateEditorSelection(result.text, result.selectionStart, result.selectionEnd)
      }
    },
    {
      label: "H2",
      icon: Heading2,
      action: () => {
        const textarea = editorRef.current
        if (!textarea) return
        const result = applyLinePrefixMarkdown(
          article,
          textarea.selectionStart,
          textarea.selectionEnd,
          "## ",
          "二级标题"
        )
        updateEditorSelection(result.text, result.selectionStart, result.selectionEnd)
      }
    },
    {
      label: "加粗",
      icon: Bold,
      action: () => {
        const textarea = editorRef.current
        if (!textarea) return
        const result = applyInlineMarkdown(
          article,
          textarea.selectionStart,
          textarea.selectionEnd,
          "**",
          "**",
          "重点内容"
        )
        updateEditorSelection(result.text, result.selectionStart, result.selectionEnd)
      }
    },
    {
      label: "引用",
      icon: Quote,
      action: () => {
        const textarea = editorRef.current
        if (!textarea) return
        const result = applyLinePrefixMarkdown(
          article,
          textarea.selectionStart,
          textarea.selectionEnd,
          "> ",
          "引用内容"
        )
        updateEditorSelection(result.text, result.selectionStart, result.selectionEnd)
      }
    },
    {
      label: "列表",
      icon: List,
      action: () => {
        const textarea = editorRef.current
        if (!textarea) return
        const result = applyLinePrefixMarkdown(
          article,
          textarea.selectionStart,
          textarea.selectionEnd,
          "- ",
          "列表项"
        )
        updateEditorSelection(result.text, result.selectionStart, result.selectionEnd)
      }
    },
    {
      label: "有序",
      icon: ListOrdered,
      action: () => {
        const textarea = editorRef.current
        if (!textarea) return
        const result = applyLinePrefixMarkdown(
          article,
          textarea.selectionStart,
          textarea.selectionEnd,
          "1. ",
          "列表项"
        )
        updateEditorSelection(result.text, result.selectionStart, result.selectionEnd)
      }
    },
    {
      label: "代码",
      icon: Code2,
      action: () => {
        const textarea = editorRef.current
        if (!textarea) return
        const result = applyInlineMarkdown(
          article,
          textarea.selectionStart,
          textarea.selectionEnd,
          "```\n",
          "\n```",
          "代码片段"
        )
        updateEditorSelection(result.text, result.selectionStart, result.selectionEnd)
      }
    }
  ] as const

  function renderDraft(depth: number) {
    if (!draftNode) return null
    return (
      <div className="px-2 py-1" style={{ paddingLeft: 12 + depth * 14 }}>
        <input
          autoFocus
          className="h-9 w-full rounded-lg border border-primary/30 bg-elevated px-3 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/20"
          placeholder="输入观点名称"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          onBlur={submitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitDraft()
            if (event.key === "Escape") {
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
        (target.type !== "root" && dropTarget.targetId === target.targetId))
    return (
      <div
        className={cn(
          "mx-2 h-0.5 rounded-full border border-transparent transition-all",
          draggingId ? "opacity-100" : "opacity-0",
          active ? "border-primary/60 bg-primary/30" : "hover:border-primary/40",
          className
        )}
        style={{ marginLeft: 12 + depth * 14 }}
        onDragOver={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setDropTarget(target)
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void applyDrop(target)
        }}
      />
    )
  }

  function renderNode(node: ViewpointTreeNode, depth = 0): React.ReactNode {
    const isExpanded = expanded[node.id] ?? true
    const active = selectedId === node.id
    const focused = focusedParentId === node.id
    const hasChildren = node.children.length > 0
    const showDraftHere = draftNode?.parentId === node.id && draftNode.placement === "child"
    const insideActive = dropTarget?.type === "inside" && dropTarget.targetId === node.id

    return (
      <div key={node.id}>
        {renderDropZone(depth, { type: "before", targetId: node.id })}
        <button
          draggable
          className={cn(
            "group flex w-full items-center gap-1.5 rounded-lg px-3 py-1 text-left text-sm transition-all duration-200",
            active && "bg-elevated text-foreground",
            focused && !active && "bg-elevated/50",
            insideActive && "bg-primary/5 text-foreground",
            !active && !focused && "text-secondary hover:bg-overlay/70 hover:text-foreground"
          )}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => {
            setSelectedId(node.id)
            setFocusedParentId(node.id)
            setArticle(node.articleContent)
          }}
          onDragStart={() => {
            setDraggingId(node.id)
            setDropTarget(null)
          }}
          onDragEnd={() => {
            setDraggingId(null)
            setDropTarget(null)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setDropTarget({ type: "inside", targetId: node.id })
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void applyDrop({ type: "inside", targetId: node.id })
          }}
        >
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
          {hasChildren ? (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-overlay"
              onClick={(event) => {
                event.stopPropagation()
                setExpanded((current) => ({ ...current, [node.id]: !isExpanded }))
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted" />
              )}
            </span>
          ) : (
            <span className="inline-block h-5 w-5" />
          )}
          <span className="truncate font-medium">{node.title}</span>
          <span className="ml-auto rounded-full bg-elevated px-1.5 py-0.5 text-[10px] text-muted">
            {node.highlightCount}
          </span>
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-destructive/10 hover:text-red-300 group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation()
              void deleteViewpoint(node.id)
            }}
          >
            {deletingId === node.id ? (
              <X className="h-3.5 w-3.5 animate-pulse" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </span>
        </button>
        {showDraftHere ? renderDraft(depth + 1) : null}
        {hasChildren && isExpanded
          ? node.children.map((child) => renderNode(child, depth + 1))
          : null}
        {renderDropZone(depth, { type: "after", targetId: node.id })}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-base">
      {/* 左侧观点树 */}
      <aside
        className="relative flex shrink-0 flex-col border-r border-border/60 bg-reader-sidebar"
        style={{ width: treeWidth }}
      >
        <div className="flex h-12 items-center justify-between border-b border-border/60 px-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            观点树
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDraft(focusedParentId ?? undefined)}
            title={focusedParentId ? "在当前观点下新建子观点" : "在根目录新建观点"}
            className="h-7 w-7 p-0"
          >
            <FilePlus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-all duration-200",
              focusedParentId === null
                ? "bg-elevated text-foreground"
                : "text-secondary hover:bg-overlay/70 hover:text-foreground"
            )}
            onClick={(event) => {
              event.stopPropagation()
              setFocusedParentId(null)
              setDraftNode(null)
            }}
          >
            <span className="flex h-4 w-4 items-center justify-center text-muted">#</span>
            <span className="truncate">根目录</span>
          </button>
          {draftNode?.placement === "root" ? renderDraft(0) : null}
          {tree.map((node) => renderNode(node))}
          {draggingId ? (
            <div className="pt-2">
              {renderDropZone(0, { type: "root" }, "h-8 border-dashed")}
              <div className="px-3 pt-1 text-[11px] text-muted">拖到这里，放到根目录最下方</div>
            </div>
          ) : null}
        </div>
        <div
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
          onMouseDown={createResizeHandler(treeWidth, setTreeWidth)}
        />
      </aside>

      {/* 中央编辑区域 */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* 顶部标题栏 */}
        <div className="flex h-12 items-center justify-between border-b border-border/60 bg-surface/50 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {selected?.title ?? "未选择观点"}
            </span>
            <span className="shrink-0 rounded-full border border-border/60 bg-elevated/80 px-2 py-0.5 text-[11px] text-muted">
              {selected?.highlightCount ?? 0} 笔记
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "edit" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("edit")}
              className="h-8 gap-1.5 text-xs"
            >
              <Edit3 className="h-3.5 w-3.5" />
              编辑
            </Button>
            <Button
              variant={viewMode === "preview" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("preview")}
              className="h-8 gap-1.5 text-xs"
            >
              <Eye className="h-3.5 w-3.5" />
              预览
            </Button>
          </div>
        </div>

        {/* 编辑器主体 */}
        <div className="relative flex-1 overflow-hidden">
          {/* 编辑模式 */}
          {viewMode === "edit" && (
            <div className="flex h-full flex-col">
              {/* 极简工具栏 */}
              <div className="flex items-center justify-between border-b border-border/60 bg-surface/30 px-4 py-2">
                <div className="flex flex-wrap gap-1">
                  {toolbarItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <Button
                        key={item.label}
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-secondary hover:bg-elevated hover:text-foreground"
                        onClick={item.action}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{item.label}</span>
                      </Button>
                    )
                  })}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted">
                  <span>{editorStats.lines} 行</span>
                  <span>{editorStats.characters} 字</span>
                  <span>{selected ? "已保存" : "未选择"}</span>
                </div>
              </div>
              {/* 文本编辑区 */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mx-auto max-w-3xl">
                  <Textarea
                    ref={editorRef}
                    className="min-h-[calc(100vh-180px)] w-full resize-none rounded-xl border-0 bg-transparent px-0 py-0 text-[15px] leading-7 text-foreground shadow-none outline-none ring-0 placeholder:text-muted/60"
                    placeholder="在此开始记录你的想法、观点和论证..."
                    value={article}
                    onChange={(event) => setArticle(event.target.value)}
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 预览模式 */}
          {viewMode === "preview" && (
            <div className="h-full overflow-y-auto">
              <div className="mx-auto max-w-3xl px-6 py-8">
                {article.trim() ? (
                  <div
                    className="prose-lumina"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <div className="flex h-[calc(100vh-180px)] flex-col items-center justify-center text-muted">
                    <Eye className="mb-3 h-8 w-8 opacity-20" />
                    <p className="text-sm">暂无内容可预览</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 右侧笔记关联 */}
      <aside
        className="relative flex shrink-0 flex-col border-l border-border/60 bg-surface"
        style={{ width: relationWidth }}
      >
        <div
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
          onMouseDown={createResizeHandler(relationWidth, setRelationWidth, true)}
        />
        <div className="flex h-12 items-center justify-between border-b border-border/60 px-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">笔记关联</span>
          <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] text-muted">
            {pendingNotes.length}
          </span>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {pendingNotes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-elevated/30 p-4 text-center">
              <Mail className="mx-auto mb-2 h-5 w-5 text-muted/50" />
              <p className="text-xs text-muted">暂无待确认关联</p>
            </div>
          ) : (
            pendingNotes.map((item) => (
              <Card
                key={item.id}
                className="border-border/60 bg-elevated/40 p-3 transition-all hover:bg-elevated/60"
              >
                <p className="text-sm leading-relaxed text-foreground">{item.content}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                  <span className="rounded bg-elevated px-1.5 py-0.5">
                    相似度 {(item.similarityScore ?? 0).toFixed(2)}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      </aside>
    </div>
  )
}
