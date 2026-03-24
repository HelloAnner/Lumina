"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FilePlus,
  FileText,
  FolderOpen,
  GripVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Toast } from "@/components/ui/toast"
import {
  applyInlineMarkdown,
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
 * 采用 Obsidian 风格：单面板编辑/预览切换，观点树缩进导线
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
  const [toast, setToast] = useState("")
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
  // 单面板模式：false=预览态，true=编辑态
  const [editMode, setEditMode] = useState(false)

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
      setEditMode(false)
      syncSaveState(viewpointId, nextContent)
    },
    [flushCurrentDraft, syncSaveState, viewpoints]
  )

  // Cmd+B / Cmd+I 快捷键支持
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        setEditMode(false)
        return
      }
      if (!(event.metaKey || event.ctrlKey)) {
        return
      }
      const textarea = editorRef.current
      if (!textarea) return
      const { value, selectionStart, selectionEnd } = textarea
      if (event.key === "b") {
        event.preventDefault()
        const next = applyInlineMarkdown(value, selectionStart, selectionEnd, "**", "**", "内容")
        setContent(next.text)
        syncSaveState(selectedId, next.text)
        requestAnimationFrame(() => {
          textarea.focus()
          textarea.setSelectionRange(next.selectionStart, next.selectionEnd)
        })
      }
      if (event.key === "i") {
        event.preventDefault()
        const next = applyInlineMarkdown(value, selectionStart, selectionEnd, "*", "*", "内容")
        setContent(next.text)
        syncSaveState(selectedId, next.text)
        requestAnimationFrame(() => {
          textarea.focus()
          textarea.setSelectionRange(next.selectionStart, next.selectionEnd)
        })
      }
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

  // 自动保存定时器
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

  // 卸载前保存
  useEffect(() => {
    return () => {
      const { selectedId: currentSelectedId, content: currentContent } = latestDraftRef.current
      if (!currentSelectedId) return
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

    const toastMessage = childCount > 0
      ? `已删除观点及 ${childCount} 个子观点，可按 Cmd+Z 撤销`
      : "已删除观点，可按 Cmd+Z 撤销"
    setToast(toastMessage)

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
      <div className="py-0.5" style={{ paddingLeft: 8 + depth * 16 }}>
        <input
          autoFocus
          className="h-7 w-full rounded border border-primary/40 bg-elevated px-2 text-[13px] text-foreground outline-none focus:border-primary"
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
          "h-0.5 rounded-full transition-all",
          draggingId ? "opacity-100" : "opacity-0",
          active ? "bg-primary/60" : "bg-transparent hover:bg-primary/30",
          className
        )}
        style={{ marginLeft: 8 + depth * 16 }}
        onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDropTarget(target) }}
        onDrop={(event) => { event.preventDefault(); event.stopPropagation(); void applyDrop(target) }}
      />
    )
  }

  function renderNode(node: ViewpointTreeNode, depth = 0): React.ReactNode {
    const isExpanded = expanded[node.id] ?? true
    const active = selectedId === node.id
    const hasChildren = node.children.length > 0
    const showDraftHere = draftNode?.parentId === node.id && draftNode.placement === "child"
    const insideActive = dropTarget?.type === "inside" && dropTarget.targetId === node.id

    // 缩进导线的起始位置
    const indentLeft = 8 + depth * 16

    return (
      <div key={node.id} className="relative">
        {/* 缩进导线 - Obsidian 风格竖线 */}
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
          onClick={() => { void selectViewpoint(node.id) }}
          onDragStart={() => { setDraggingId(node.id); setDropTarget(null) }}
          onDragEnd={() => { setDraggingId(null); setDropTarget(null) }}
          onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDropTarget({ type: "inside", targetId: node.id }) }}
          onDrop={(event) => { event.preventDefault(); event.stopPropagation(); void applyDrop({ type: "inside", targetId: node.id }) }}
        >
          {/* 拖拽把手 */}
          <GripVertical className="h-3 w-3 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-60" />

          {/* 展开/折叠 chevron 或文件图标 */}
          {hasChildren ? (
            <span
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted transition-colors hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation()
                setExpanded((current) => ({ ...current, [node.id]: !isExpanded }))
              }}
            >
              {isExpanded
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronRight className="h-3 w-3" />}
            </span>
          ) : (
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted/50">
              <FileText className="h-3 w-3" />
            </span>
          )}

          {/* 标题 */}
          <span className="min-w-0 flex-1 truncate">{node.title}</span>

          {/* 笔记数量 */}
          {node.highlightCount > 0 && (
            <span className="shrink-0 rounded px-1 text-[10px] tabular-nums text-muted/60">
              {node.highlightCount}
            </span>
          )}

          {/* 删除按钮（hover 时出现） */}
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
            onClick={(event) => { event.stopPropagation(); void deleteViewpoint(node.id) }}
          >
            {deletingId === node.id
              ? <X className="h-3 w-3 animate-pulse" />
              : <Trash2 className="h-3 w-3" />}
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

  const saveStateText = {
    saved: "已保存",
    pending: "待保存",
    saving: "保存中",
    error: "保存失败"
  } satisfies Record<SaveState, string>

  return (
    <>
      {toast ? <Toast title={toast} onClose={() => setToast("")} /> : null}
      <div className="flex h-screen overflow-hidden bg-surface">

        {/* 左侧观点树 - Obsidian 文件浏览器风格 */}
        <aside
          className="relative flex shrink-0 flex-col border-r border-border/50 bg-surface"
          style={{ width: treeWidth }}
        >
          {/* 树标题栏 */}
          <div className="flex h-11 items-center justify-between px-3 border-b border-border/40">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted/70">
              观点树
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDraft(focusedParentId ?? undefined)}
              className="h-6 w-6 p-0 text-muted hover:text-foreground"
              title="新建观点"
            >
              <FilePlus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* 树内容 */}
          <div className="flex-1 overflow-y-auto py-1 px-1">
            {/* 根目录 */}
            <button
              className={cn(
                "flex w-full items-center gap-1.5 rounded-sm px-2 py-[3px] text-left text-[13px] transition-colors",
                focusedParentId === null
                  ? "text-foreground bg-overlay/60"
                  : "text-muted hover:bg-overlay/40 hover:text-secondary"
              )}
              onClick={() => { setFocusedParentId(null); setDraftNode(null) }}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted/60" />
              <span className="truncate">全部观点</span>
            </button>

            {draftNode?.placement === "root" ? renderDraft(0) : null}
            {tree.map((node) => renderNode(node))}

            {/* 拖拽到根目录提示 */}
            {draggingId ? (
              <div className="mt-2 px-2">
                {renderDropZone(0, { type: "root" }, "h-6 border border-dashed border-border/40 rounded")}
                <p className="mt-1 px-1 text-[11px] text-muted/50">拖到这里放到根目录</p>
              </div>
            ) : null}
          </div>

          {/* 右侧拖拽调宽把手 */}
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20"
            onMouseDown={createResizeHandler(treeWidth, setTreeWidth)}
          />
        </aside>

        {/* 中央编辑区域 - 单面板 Obsidian Live Preview 风格 */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* 顶部标题栏 */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 bg-surface px-5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {selected?.title ?? "未选择观点"}
              </span>
              {selected && (
                <span className="shrink-0 rounded-full border border-border/40 bg-elevated/60 px-2 py-0.5 text-[10px] text-muted">
                  {selected.highlightCount} 笔记
                </span>
              )}
            </div>

            {/* 右侧：统计 + 保存状态 + 编辑/预览切换 */}
            <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted">
              {selected && (
                <>
                  <span className="tabular-nums">{stats.characters} 字</span>
                  <span className={cn(
                    "transition-colors",
                    saveState === "error" && "text-red-400",
                    saveState === "saving" && "text-muted",
                    saveState === "pending" && "text-muted/60"
                  )}>
                    {previewLagging && editMode ? "渲染中" : saveStateText[saveState]}
                  </span>
                </>
              )}

              {/* 编辑/预览切换按钮 */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 gap-1.5 rounded-md px-2 text-[11px] transition-all",
                  editMode
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted hover:text-foreground"
                )}
                onClick={() => {
                  const next = !editMode
                  setEditMode(next)
                  if (next) {
                    requestAnimationFrame(() => editorRef.current?.focus())
                  }
                }}
                title={editMode ? "切换到阅读视图 (Esc)" : "切换到编辑模式"}
              >
                {editMode
                  ? <><Eye className="h-3.5 w-3.5" /><span>预览</span></>
                  : <><Pencil className="h-3.5 w-3.5" /><span>编辑</span></>}
              </Button>
            </div>
          </div>

          {/* 内容主体 */}
          <div
            className="relative min-h-0 flex-1 overflow-y-auto"
            onClick={!editMode && selected ? () => {
              setEditMode(true)
              requestAnimationFrame(() => editorRef.current?.focus())
            } : undefined}
          >
            {/* 编辑态 - textarea */}
            {editMode ? (
              <div className="mx-auto h-full max-w-3xl px-8 py-8">
                <Textarea
                  ref={editorRef}
                  value={content}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  placeholder="开始记录观点、论证和摘录…"
                  className="h-full min-h-[calc(100vh-88px)] w-full resize-none border-0 bg-transparent p-0 font-mono text-[14px] leading-7 text-foreground shadow-none outline-none focus-visible:ring-0 placeholder:text-muted/30"
                />
              </div>
            ) : (
              /* 预览态 - 渲染 HTML，点击任意位置进入编辑 */
              <div className={cn(
                "mx-auto max-w-3xl px-8 py-8 min-h-full",
                selected && "cursor-text"
              )}>
                {selected ? (
                  previewHtml ? (
                    <div
                      className="prose-lumina"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : (
                    <p className="text-[14px] text-muted/40 select-none">
                      点击开始编辑…
                    </p>
                  )
                ) : (
                  <div className="flex h-64 items-center justify-center">
                    <p className="text-sm text-muted/40">从左侧选择一个观点</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* 右侧笔记关联 */}
        <aside
          className="relative flex shrink-0 flex-col border-l border-border/50 bg-surface"
          style={{ width: relationWidth }}
        >
          <div
            className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20"
            onMouseDown={createResizeHandler(relationWidth, setRelationWidth, true)}
          />

          <div className="flex h-11 items-center justify-between border-b border-border/40 px-4">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted/70">
              笔记关联
            </span>
            <span className="rounded-full bg-elevated px-1.5 py-0.5 text-[10px] tabular-nums text-muted">
              {pendingNotes.length}
            </span>
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {loadingPendingNotes ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-[12px] text-muted/50">加载中…</p>
              </div>
            ) : pendingNotes.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-[12px] text-muted/40">暂无待确认关联</p>
              </div>
            ) : (
              pendingNotes.map((item) => (
                <Card
                  key={item.id}
                  className="border-border/40 bg-elevated/30 p-3 transition-colors hover:bg-elevated/60"
                >
                  <p className="text-[13px] leading-relaxed text-foreground/80">{item.content}</p>
                  <div className="mt-2 text-[10px] text-muted/50">
                    相似度 {(item.similarityScore ?? 0).toFixed(2)}
                  </div>
                </Card>
              ))
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
