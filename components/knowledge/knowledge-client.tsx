"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import {
  Bold,
  Code2,
  ChevronDown,
  ChevronRight,
  FilePlus,
  GripVertical,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Trash2,
  X,
  Undo2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  applyInlineMarkdown,
  applyLinePrefixMarkdown,
  buildKnowledgeEditorStats,
  buildKnowledgeSaveRequest,
  renderKnowledgeMarkdown
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

type SaveState = "saved" | "pending" | "saving" | "error"

/**
 * 知识库页面客户端容器
 *
 * @author Anner
 * @since 0.1.0
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
  const [viewpoints, setViewpoints] = useState(initialViewpoints)
  const [selectedId, setSelectedId] = useState(initialSelected?.id ?? initialViewpoints[0]?.id)
  const [content, setContent] = useState(initialSelected?.articleContent ?? "")
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
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveChain = useRef<Promise<boolean>>(Promise.resolve(true))
  const latestDraftRef = useRef({
    selectedId: initialSelected?.id ?? initialViewpoints[0]?.id,
    content: initialSelected?.articleContent ?? ""
  })
  const savedContentsRef = useRef(
    new Map(initialViewpoints.map((item) => [item.id, item.articleContent ?? ""]))
  )

  const selected = viewpoints.find((item) => item.id === selectedId)
  const tree = useMemo(() => buildViewpointTree(viewpoints), [viewpoints])
  const stats = useMemo(() => buildKnowledgeEditorStats(content), [content])
  const deferredContent = useDeferredValue(content)
  const previewHtml = useMemo(() => renderKnowledgeMarkdown(deferredContent), [deferredContent])
  const previewLagging = deferredContent !== content

  useEffect(() => {
    latestDraftRef.current = { selectedId, content }
  }, [content, selectedId])

  const updateCachedViewpointContent = useCallback((viewpointId: string, articleContent: string) => {
    savedContentsRef.current.set(viewpointId, articleContent)
    setViewpoints((current) =>
      current.map((item) => (item.id === viewpointId ? { ...item, articleContent } : item))
    )
  }, [])

  const syncSaveState = useCallback((viewpointId: string | undefined, articleContent: string) => {
    const request = buildKnowledgeSaveRequest(
      viewpointId,
      articleContent,
      viewpointId ? savedContentsRef.current.get(viewpointId) : ""
    )
    setSaveState(request ? "pending" : "saved")
  }, [])

  const queueSave = useCallback(
    (viewpointId: string | undefined, articleContent: string, keepalive = false) => {
      const request = buildKnowledgeSaveRequest(
        viewpointId,
        articleContent,
        viewpointId ? savedContentsRef.current.get(viewpointId) : ""
      )
      if (!request) {
        syncSaveState(viewpointId, articleContent)
        return saveChain.current
      }

      const nextSave = saveChain.current.then(async () => {
        setSaveState((current) =>
          latestDraftRef.current.selectedId === request.viewpointId ? "saving" : current
        )
        try {
          const response = await fetch(`/api/viewpoints/${request.viewpointId}/article`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ articleContent: request.articleContent }),
            keepalive
          })
          if (!response.ok) {
            throw new Error("save viewpoint article failed")
          }
          updateCachedViewpointContent(request.viewpointId, request.articleContent)
          syncSaveState(
            latestDraftRef.current.selectedId,
            latestDraftRef.current.content
          )
          return true
        } catch {
          if (latestDraftRef.current.selectedId === request.viewpointId) {
            setSaveState("error")
          }
          return false
        }
      })

      saveChain.current = nextSave.catch(() => false)
      return nextSave
    },
    [syncSaveState, updateCachedViewpointContent]
  )

  const flushCurrentDraft = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const { selectedId: currentSelectedId, content: currentContent } = latestDraftRef.current
    if (!currentSelectedId) {
      return true
    }
    return queueSave(currentSelectedId, currentContent)
  }, [queueSave])

  const selectViewpoint = useCallback(
    async (viewpointId: string) => {
      if (viewpointId === latestDraftRef.current.selectedId) {
        setFocusedParentId(viewpointId)
        return
      }
      await flushCurrentDraft()
      const next = viewpoints.find((item) => item.id === viewpointId)
      const nextContent = next?.articleContent ?? ""
      setSelectedId(viewpointId)
      setFocusedParentId(viewpointId)
      setContent(nextContent)
      syncSaveState(viewpointId, nextContent)
    },
    [flushCurrentDraft, syncSaveState, viewpoints]
  )

  const applyEditorSelection = useCallback(
    (
      updater: (
        text: string,
        selectionStart: number,
        selectionEnd: number
      ) => {
        text: string
        selectionStart: number
        selectionEnd: number
      }
    ) => {
      const textarea = editorRef.current
      if (!textarea) {
        return
      }
      const next = updater(
        textarea.value,
        textarea.selectionStart ?? 0,
        textarea.selectionEnd ?? 0
      )
      setContent(next.text)
      syncSaveState(selectedId, next.text)
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(next.selectionStart, next.selectionEnd)
      })
    },
    [selectedId, syncSaveState]
  )

  // 保存偏好设置
  useEffect(() => {
    if (prefTimer.current) clearTimeout(prefTimer.current)
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
      if (prefTimer.current) clearTimeout(prefTimer.current)
    }
  }, [relationWidth, treeWidth])

  // 加载待确认笔记
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
        if (!cancelled) setPendingNotes(data.items ?? [])
      })
      .catch(() => { if (!cancelled) setPendingNotes([]) })
      .finally(() => { if (!cancelled) setLoadingPendingNotes(false) })
    return () => { cancelled = true }
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) {
      setSaveState("saved")
      return
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
    }
    const request = buildKnowledgeSaveRequest(
      selectedId,
      content,
      savedContentsRef.current.get(selectedId)
    )
    if (!request) {
      setSaveState("saved")
      saveTimer.current = null
      return
    }
    setSaveState("pending")
    saveTimer.current = setTimeout(() => {
      void queueSave(request.viewpointId, request.articleContent)
      saveTimer.current = null
    }, 600)
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }
    }
  }, [content, queueSave, selectedId])

  useEffect(() => {
    return () => {
      const { selectedId: currentSelectedId, content: currentContent } = latestDraftRef.current
      if (!currentSelectedId) {
        return
      }
      void queueSave(currentSelectedId, currentContent, true)
    }
  }, [queueSave])

  const handleInput = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextContent = event.target.value
      setContent(nextContent)
      syncSaveState(selectedId, nextContent)
    },
    [selectedId, syncSaveState]
  )

  const wrapSelection = useCallback(
    (before: string, after: string) => {
      applyEditorSelection((text, selectionStart, selectionEnd) =>
        applyInlineMarkdown(text, selectionStart, selectionEnd, before, after, "内容")
      )
    },
    [applyEditorSelection]
  )

  const insertBlock = useCallback(
    (prefix: string) => {
      applyEditorSelection((text, selectionStart, selectionEnd) =>
        applyLinePrefixMarkdown(text, selectionStart, selectionEnd, prefix, "内容")
      )
    },
    [applyEditorSelection]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return
      }
      if (event.key === "b") {
        event.preventDefault()
        wrapSelection("**", "**")
      }
      if (event.key === "i") {
        event.preventDefault()
        wrapSelection("*", "*")
      }
    },
    [wrapSelection]
  )

  const toolbarItems = [
    { label: "H1", icon: Heading1, action: () => insertBlock("# ") },
    { label: "H2", icon: Heading2, action: () => insertBlock("## ") },
    { label: "加粗", icon: Bold, action: () => wrapSelection("**", "**") },
    { label: "引用", icon: Quote, action: () => insertBlock("> ") },
    { label: "列表", icon: List, action: () => insertBlock("- ") },
    { label: "有序", icon: ListOrdered, action: () => insertBlock("1. ") },
    { label: "代码", icon: Code2, action: () => wrapSelection("`", "`") }
  ]
  const saveStateText = {
    saved: "已保存",
    pending: "待自动保存",
    saving: "保存中",
    error: "保存失败"
  } satisfies Record<SaveState, string>

  // 其他函数保持不变...
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
    }, []
  )

  const persistViewpointOrder = useCallback(async (items: Viewpoint[]) => {
    const updates = serializeViewpointOrder(items)
    const responses = await Promise.all(
      updates.map((item) =>
        fetch(`/api/viewpoints/${item.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ parentId: item.parentId, sortOrder: item.sortOrder })
        })
      )
    )
    if (responses.some((response) => !response.ok)) {
      throw new Error("persist viewpoint order failed")
    }
  }, [])

  const applyDrop = useCallback(
    async (target: ViewpointDropTarget) => {
      if (!draggingId) return
      const previous = viewpoints
      const next = moveViewpointNode(previous, { sourceId: draggingId, target })
      const previousOrder = JSON.stringify(serializeViewpointOrder(previous))
      const nextOrder = JSON.stringify(serializeViewpointOrder(next))
      setDraggingId(null)
      setDropTarget(null)
      if (previousOrder === nextOrder) return
      setViewpoints(next)
      if (target.type === "inside") {
        setExpanded((current) => ({ ...current, [target.targetId]: true }))
      }
      try {
        await persistViewpointOrder(next)
      } catch {
        setViewpoints(previous)
      }
    }, [draggingId, persistViewpointOrder, viewpoints]
  )

  async function submitDraft() {
    if (!draftNode || !draftTitle.trim()) {
      setDraftNode(null)
      setDraftTitle("")
      return
    }
    const response = await fetch("/api/viewpoints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: draftTitle.trim(), parentId: draftNode.parentId, isFolder: false })
    })
    const data = await response.json()
    if (response.ok) {
      await flushCurrentDraft()
      setViewpoints((current) => [...current, data.item])
      savedContentsRef.current.set(data.item.id, data.item.articleContent ?? "")
      if (draftNode.parentId) {
        setExpanded((current) => ({ ...current, [draftNode.parentId!]: true }))
      }
      setSelectedId(data.item.id)
      setFocusedParentId(data.item.id)
      setContent(data.item.articleContent)
      syncSaveState(data.item.id, data.item.articleContent)
    }
    setDraftNode(null)
    setDraftTitle("")
  }

  function openDraft(parentId: string | undefined) {
    setDraftNode({ parentId, placement: parentId ? "child" : "root" })
    setDraftTitle("")
    if (parentId) setExpanded((current) => ({ ...current, [parentId]: true }))
  }

  async function deleteViewpoint(viewpointId: string) {
    const subtreeIds = collectViewpointSubtreeIds(viewpoints, viewpointId)
    if (!subtreeIds.length) return
    const childCount = Math.max(0, subtreeIds.length - 1)
    const removedSnapshots = subtreeIds.map((id) => [id, savedContentsRef.current.get(id) ?? ""] as const)
    const confirmed = window.confirm(
      childCount > 0 ? `确认删除该观点及其 ${childCount} 个子观点吗？` : "确认删除该观点吗？"
    )
    if (!confirmed) return

    const nextViewpoints = viewpoints.filter((item) => !subtreeIds.includes(item.id))
    const nextSelected = nextViewpoints[0]
    const shouldResetSelection = (selectedId && subtreeIds.includes(selectedId)) ||
      (focusedParentId && subtreeIds.includes(focusedParentId))

    setDeletingId(viewpointId)
    setViewpoints(nextViewpoints)
    subtreeIds.forEach((id) => savedContentsRef.current.delete(id))
    if (selectedId && subtreeIds.includes(selectedId)) {
      setSelectedId(nextSelected?.id)
      const nextContent = nextSelected?.articleContent ?? ""
      setContent(nextContent)
      syncSaveState(nextSelected?.id, nextContent)
    }
    if (shouldResetSelection) setFocusedParentId(nextSelected?.id ?? null)
    if (draftNode?.parentId && subtreeIds.includes(draftNode.parentId)) {
      setDraftNode(null)
      setDraftTitle("")
    }

    try {
      await Promise.all(
        [...subtreeIds].reverse().map((id) => fetch(`/api/viewpoints/${id}`, { method: "DELETE" }))
      )
    } catch {
      removedSnapshots.forEach(([id, articleContent]) => {
        savedContentsRef.current.set(id, articleContent)
      })
      setViewpoints(viewpoints)
      setSelectedId(selectedId)
      setFocusedParentId(focusedParentId)
      setContent(selected?.articleContent ?? content)
      syncSaveState(selectedId, selected?.articleContent ?? content)
    } finally {
      setDeletingId(null)
    }
  }

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

  function renderDropZone(depth: number, target: ViewpointDropTarget, className = "") {
    const active = dropTarget?.type === target.type &&
      (dropTarget.type === "root" || (target.type !== "root" && dropTarget.targetId === target.targetId))
    return (
      <div
        className={cn(
          "mx-2 h-0.5 rounded-full border border-transparent transition-all",
          draggingId ? "opacity-100" : "opacity-0",
          active ? "border-primary/60 bg-primary/30" : "hover:border-primary/40",
          className
        )}
        style={{ marginLeft: 12 + depth * 14 }}
        onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDropTarget(target) }}
        onDrop={(event) => { event.preventDefault(); event.stopPropagation(); void applyDrop(target) }}
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
          onClick={() => { void selectViewpoint(node.id) }}
          onDragStart={() => { setDraggingId(node.id); setDropTarget(null) }}
          onDragEnd={() => { setDraggingId(null); setDropTarget(null) }}
          onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDropTarget({ type: "inside", targetId: node.id }) }}
          onDrop={(event) => { event.preventDefault(); event.stopPropagation(); void applyDrop({ type: "inside", targetId: node.id }) }}
        >
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
          {hasChildren ? (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-overlay"
              onClick={(event) => { event.stopPropagation(); setExpanded((current) => ({ ...current, [node.id]: !isExpanded })) }}
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
            </span>
          ) : <span className="inline-block h-5 w-5" />}
          <span className="truncate font-medium">{node.title}</span>
          <span className="ml-auto rounded-full bg-elevated px-1.5 py-0.5 text-[10px] text-muted">{node.highlightCount}</span>
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-destructive/10 hover:text-red-300 group-hover:opacity-100"
            onClick={(event) => { event.stopPropagation(); void deleteViewpoint(node.id) }}
          >
            {deletingId === node.id ? <X className="h-3.5 w-3.5 animate-pulse" /> : <Trash2 className="h-3.5 w-3.5" />}
          </span>
        </button>
        {showDraftHere ? renderDraft(depth + 1) : null}
        {hasChildren && isExpanded ? node.children.map((child) => renderNode(child, depth + 1)) : null}
        {renderDropZone(depth, { type: "after", targetId: node.id })}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-surface">
      {/* 左侧观点树 */}
      <aside className="relative flex shrink-0 flex-col border-r border-border/60 bg-surface" style={{ width: treeWidth }}>
        <div className="flex h-12 items-center justify-between border-b border-border/60 px-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">观点树</span>
          <Button variant="ghost" size="sm" onClick={() => openDraft(focusedParentId ?? undefined)} className="h-7 w-7 p-0">
            <FilePlus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-all duration-200",
              focusedParentId === null ? "bg-elevated text-foreground" : "text-secondary hover:bg-overlay/70 hover:text-foreground"
            )}
            onClick={(event) => { event.stopPropagation(); setFocusedParentId(null); setDraftNode(null) }}
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
        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30" onMouseDown={createResizeHandler(treeWidth, setTreeWidth)} />
      </aside>

      {/* 中央编辑区域 - Notion 风格所见即所得 */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* 顶部标题栏 */}
        <div className="flex h-12 items-center justify-between border-b border-border/60 bg-surface/50 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{selected?.title ?? "未选择观点"}</span>
            <span className="shrink-0 rounded-full border border-border/60 bg-elevated/80 px-2 py-0.5 text-[11px] text-muted">{selected?.highlightCount ?? 0} 笔记</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted">
            <span>{stats.lines} 行</span>
            <span className="mx-1">·</span>
            <span>{stats.characters} 字</span>
            <span className="mx-1">·</span>
            <span className={cn(saveState === "error" && "text-red-300")}>{saveStateText[saveState]}</span>
          </div>
        </div>

        {/* 编辑器主体 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 工具栏 */}
          <div className="flex items-center gap-1 border-b border-border/60 bg-surface/30 px-4 py-2">
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
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted hover:text-foreground"
                onClick={() => {
                  const nextContent = savedContentsRef.current.get(selectedId ?? "") ?? ""
                  setContent(nextContent)
                  syncSaveState(selectedId, nextContent)
                }}
                title="撤销更改"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid flex-1 min-h-0 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <section className="flex min-h-0 flex-col border-b border-border/60 xl:border-b-0 xl:border-r">
              <div className="flex h-11 items-center justify-between border-b border-border/60 px-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">编辑</span>
                <span className="text-[11px] text-muted">Markdown 即时保存</span>
              </div>
              <div className="min-h-0 flex-1 p-4">
                <Textarea
                  ref={editorRef}
                  value={content}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  placeholder="在这里持续记录你的观点、论证和摘录。输入会自动保存，右侧会实时渲染。"
                  className="h-full min-h-[calc(100vh-220px)] resize-none border-0 bg-transparent px-2 py-1 text-[15px] leading-7 shadow-none focus:ring-0"
                />
              </div>
            </section>
            <section className="flex min-h-0 flex-col bg-surface/35">
              <div className="flex h-11 items-center justify-between border-b border-border/60 px-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">预览</span>
                <span className="text-[11px] text-muted">{previewLagging ? "渲染中" : "实时渲染"}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="prose-lumina mx-auto max-w-3xl px-8 py-6">
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* 右侧笔记关联 */}
      <aside className="relative flex shrink-0 flex-col border-l border-border/60 bg-surface" style={{ width: relationWidth }}>
        <div className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30" onMouseDown={createResizeHandler(relationWidth, setRelationWidth, true)} />
        <div className="flex h-12 items-center justify-between border-b border-border/60 px-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">笔记关联</span>
          <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] text-muted">{pendingNotes.length}</span>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {loadingPendingNotes ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-elevated/30 p-4 text-center">
              <p className="text-xs text-muted">关联加载中...</p>
            </div>
          ) : pendingNotes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-elevated/30 p-4 text-center">
              <p className="text-xs text-muted">暂无待确认关联</p>
            </div>
          ) : (
            pendingNotes.map((item) => (
              <Card key={item.id} className="border-border/60 bg-elevated/40 p-3 transition-all hover:bg-elevated/60">
                <p className="text-sm leading-relaxed text-foreground">{item.content}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                  <span className="rounded bg-elevated px-1.5 py-0.5">相似度 {(item.similarityScore ?? 0).toFixed(2)}</span>
                </div>
              </Card>
            ))
          )}
        </div>
      </aside>
    </div>
  )
}
