"use client"

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useDeferredValue
} from "react"
import { usePathname } from "next/navigation"
import { parseServerTiming } from "@/src/lib/timing"
import {
  BookOpen,
  Check,
  Download,
  Import,
  Loader2,
  MessageSquare,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Toast } from "@/components/ui/toast"
import { NoteEditor } from "@/components/knowledge/note-editor"
import { ImportedNotesTree } from "@/components/import/imported-notes-tree"
import { ImportedNoteViewer } from "@/components/import/imported-note-viewer"
import { AddSourceDialog } from "@/components/import/add-source-dialog"
import { type SelectionContext } from "@/components/knowledge/annotation-sidebar"
import {
  buildViewpointPrefetchOrder,
  shouldBootstrapEmptyViewpoint,
  shouldRenderViewpointEditor
} from "@/components/knowledge/knowledge-view-state"
import {
  DEFAULT_KNOWLEDGE_NOTE_STATE,
  type KnowledgeSelection,
  type KnowledgeNoteState,
  buildKnowledgeHref,
  buildKnowledgeNoteKey,
  readKnowledgeSelection
} from "@/components/knowledge/knowledge-url-state"
import { resolveJumpTargetBlockId } from "@/components/knowledge/knowledge-jump"
import { RightSidebar, type RightSidebarTab } from "@/components/knowledge/right-sidebar"
import { buildNoteEditorStats } from "@/components/knowledge/note-editor-state"
import { ViewpointTree } from "@/components/knowledge/viewpoint-tree"
import {
  collectViewpointSubtreeIds,
  moveViewpointNode,
  serializeViewpointOrder,
  type ViewpointDropTarget,
} from "@/components/knowledge/viewpoint-tree-utils"
import type {
  AppKeyboardShortcuts,
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
 * 主题树 + 可编辑笔记面板 + 批注侧栏
 *
 * @author Anner
 * @since 0.2.0
 * Created on 2026/3/24
 */
export function KnowledgeClient({
  initialViewpoints,
  initialImportedNoteId,
  initialSelection,
  keyboardShortcuts,
  initialSelected,
  unconfirmed,
  initialWidths
}: {
  initialViewpoints: Viewpoint[]
  initialImportedNoteId?: string
  initialSelection: KnowledgeSelection
  keyboardShortcuts?: AppKeyboardShortcuts
  initialSelected?: Viewpoint
  unconfirmed: (Highlight & { similarityScore?: number })[]
  initialWidths: {
    knowledgeTreeWidth: number
    knowledgeListWidth: number
  }
}) {
  const pathname = usePathname()
  const [toast, setToast] = useState("")
  const [viewpoints, setViewpoints] = useState(initialViewpoints)
  const [routeSelection, setRouteSelection] = useState<KnowledgeSelection>(
    initialSelection
  )
  const [selectedId, setSelectedId] = useState(
    initialImportedNoteId
      ? ""
      : (initialSelection.viewpointId ?? initialSelected?.id ?? initialViewpoints[0]?.id ?? "")
  )
  const [blocks, setBlocks] = useState<NoteBlock[]>(
    initialSelected?.articleBlocks ?? []
  )
  const [readyViewpointId, setReadyViewpointId] = useState(
    initialImportedNoteId ? "" : (initialSelected?.id ?? "")
  )
  const [treeWidth, setTreeWidth] = useState(initialWidths.knowledgeTreeWidth)
  const [annoWidth, setAnnoWidth] = useState(initialWidths.knowledgeListWidth)
  const [draftNode, setDraftNode] = useState<DraftNode | null>(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [editingHeaderTitle, setEditingHeaderTitle] = useState(false)
  const [headerTitleDraft, setHeaderTitleDraft] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [selectionCtx, setSelectionCtx] = useState<SelectionContext | null>(null)
  const [annotatedBlockIdList, setAnnotatedBlockIdList] = useState<string[]>([])
  const annotatedBlockIds = useMemo(
    () => new Set(annotatedBlockIdList),
    [annotatedBlockIdList]
  )
  const [activeRightTab, setActiveRightTab] = useState<RightSidebarTab>("annotations")
  const [selectedBlockForChat, setSelectedBlockForChat] = useState<NoteBlock | null>(null)
  const [importedNoteId, setImportedNoteId] = useState<string | null>(
    initialImportedNoteId ?? null
  )
  const [noteState, setNoteState] = useState(DEFAULT_KNOWLEDGE_NOTE_STATE)
  const [activeHeadingId, setActiveHeadingId] = useState<string>()
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importedReadyVersion, setImportedReadyVersion] = useState(0)
  const [jumpTargetBlockId, setJumpTargetBlockId] = useState<string>()

  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteStateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jumpTargetResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const restoringNoteKeyRef = useRef<string | null>(null)
  const isRestoringScrollRef = useRef(false)
  const viewpointBlocksCacheRef = useRef<Map<string, NoteBlock[]>>(new Map())
  const viewpointBlocksRequestRef = useRef<Map<string, Promise<NoteBlock[]>>>(new Map())
  const noteStateCacheRef = useRef<Map<string, KnowledgeNoteState>>(new Map())
  const readyViewpointIdRef = useRef(readyViewpointId)
  readyViewpointIdRef.current = readyViewpointId
  const noteStateRef = useRef(noteState)
  noteStateRef.current = noteState
  const headerInputRef = useRef<HTMLInputElement>(null)
  const selected = viewpoints.find((v) => v.id === selectedId)
  const currentSelection = useMemo(
    () => importedNoteId
      ? { importedNoteId }
      : { viewpointId: selectedId || undefined },
    [importedNoteId, selectedId]
  )
  const currentNoteKey = buildKnowledgeNoteKey(currentSelection)
  const deferredChatBlocks = useDeferredValue(
    activeRightTab === "chat" ? blocks : []
  )

  const fetchViewpointBlocks = useCallback(async (viewpointId: string) => {
    const cached = viewpointBlocksCacheRef.current.get(viewpointId)
    if (cached) {
      return cached
    }
    const pending = viewpointBlocksRequestRef.current.get(viewpointId)
    if (pending) {
      return pending
    }
    const request = (async () => {
      const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now()
      const res = await fetch(`/api/viewpoints/${viewpointId}/blocks`)
      const responseAt = typeof performance !== "undefined" ? performance.now() : Date.now()
      const data = await res.json()
      const parsedAt = typeof performance !== "undefined" ? performance.now() : Date.now()
      const nextBlocks = (data.blocks ?? []) as NoteBlock[]
      viewpointBlocksCacheRef.current.set(viewpointId, nextBlocks)
      reportViewpointLoadTiming({
        viewpointId,
        totalDuration: parsedAt - startedAt,
        responseDuration: responseAt - startedAt,
        parseDuration: parsedAt - responseAt,
        serverTiming: parseServerTiming(res.headers.get("Server-Timing"))
      })
      return nextBlocks
    })()
    viewpointBlocksRequestRef.current.set(viewpointId, request)
    try {
      return await request
    } finally {
      viewpointBlocksRequestRef.current.delete(viewpointId)
    }
  }, [])

  const warmViewpointBlocks = useCallback((viewpointIds: string[]) => {
    for (const viewpointId of viewpointIds) {
      if (viewpointBlocksCacheRef.current.has(viewpointId) || viewpointBlocksRequestRef.current.has(viewpointId)) {
        continue
      }
      void fetchViewpointBlocks(viewpointId).catch(() => undefined)
    }
  }, [fetchViewpointBlocks])

  const scheduleNoteStateSave = useCallback((partial: {
    outlineCollapsed?: boolean
    scrollTop?: number
    anchorHeadingId?: string
  }) => {
    if (!currentNoteKey) {
      return
    }
    const next = {
      outlineCollapsed:
        partial.outlineCollapsed ?? noteStateRef.current.outlineCollapsed,
      scrollTop: partial.scrollTop ?? noteStateRef.current.scrollTop,
      anchorHeadingId:
        partial.anchorHeadingId ?? noteStateRef.current.anchorHeadingId
    }
    noteStateRef.current = next
    noteStateCacheRef.current.set(currentNoteKey, next)
    // Only trigger re-render for outlineCollapsed changes (visible in UI)
    // scrollTop/anchorHeadingId are tracked via ref only
    if (partial.outlineCollapsed !== undefined) {
      setNoteState(next)
    }
    if (noteStateTimer.current) {
      clearTimeout(noteStateTimer.current)
    }
    noteStateTimer.current = setTimeout(async () => {
      await persistKnowledgeNoteState(currentNoteKey, next)
    }, 220)
  }, [currentNoteKey])

  const flushCurrentNoteState = useCallback(() => {
    if (!currentNoteKey) {
      return
    }
    const scrollTop = Math.round(contentScrollRef.current?.scrollTop ?? 0)
    scheduleNoteStateSave({
      scrollTop,
      anchorHeadingId: activeHeadingId
    })
  }, [activeHeadingId, currentNoteKey, scheduleNoteStateSave])

  const replaceKnowledgeUrl = useCallback((selection: KnowledgeSelection) => {
    setRouteSelection(selection)
    if (typeof window === "undefined") {
      return
    }
    const nextUrl = buildKnowledgeHref(
      pathname,
      new URLSearchParams(window.location.search),
      selection
    )
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (currentUrl !== nextUrl) {
      window.history.replaceState(window.history.state, "", nextUrl)
    }
  }, [pathname])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const syncSelectionFromLocation = () => {
      setRouteSelection(
        readKnowledgeSelection(new URLSearchParams(window.location.search))
      )
    }
    window.addEventListener("popstate", syncSelectionFromLocation)
    return () => {
      window.removeEventListener("popstate", syncSelectionFromLocation)
    }
  }, [])

  // 加载笔记块
  useEffect(() => {
    if (!selectedId) {
      setBlocks([])
      setReadyViewpointId("")
      return
    }
    // 缓存命中 → 同步就绪，跳过网络请求
    const cached = viewpointBlocksCacheRef.current.get(selectedId)
    if (cached) {
      setBlocks(cached)
      setReadyViewpointId(selectedId)
      return
    }
    if (readyViewpointIdRef.current !== selectedId) {
      setReadyViewpointId("")
    }
    let cancelled = false
    void (async () => {
      try {
        const nextBlocks = await fetchViewpointBlocks(selectedId)
        if (cancelled) {
          return
        }
        setBlocks(nextBlocks)
        setReadyViewpointId(selectedId)
      } catch {
        if (cancelled) {
          return
        }
        setBlocks([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchViewpointBlocks, selectedId])

  useEffect(() => {
    if (!selectedId) {
      return
    }
    const nextIds = buildViewpointPrefetchOrder(viewpoints, selectedId, 6)
    if (nextIds.length === 0) {
      return
    }
    const schedule = () => warmViewpointBlocks(nextIds)
    const requestIdle = getRequestIdleCallback()
    if (requestIdle) {
      const idleId = requestIdle(schedule, { timeout: 800 })
      return () => getCancelIdleCallback()?.(idleId)
    }
    const timer = window.setTimeout(schedule, 120)
    return () => window.clearTimeout(timer)
  }, [selectedId, viewpoints, warmViewpointBlocks])

  useEffect(() => {
    if (routeSelection.importedNoteId) {
      if (routeSelection.importedNoteId === importedNoteId) {
        return
      }
      setImportedReadyVersion(0)
      setImportedNoteId(routeSelection.importedNoteId)
      setSelectedId("")
      setBlocks([])
      setSelectionCtx(null)
      setSelectedBlockForChat(null)
      setJumpTargetBlockId(undefined)
      return
    }
    const nextViewpointId = resolveClientSelectedViewpointId(
      viewpoints,
      routeSelection.viewpointId
    )
    if (!nextViewpointId) {
      return
    }
    if (importedNoteId || nextViewpointId !== selectedId) {
      setImportedReadyVersion(0)
      setImportedNoteId(null)
      setSelectedId(nextViewpointId)
      setSelectionCtx(null)
      setSelectedBlockForChat(null)
      setJumpTargetBlockId(undefined)
    }
  }, [importedNoteId, routeSelection, selectedId, viewpoints])

  useEffect(() => {
    if (!selectedId || !readyViewpointId || selectedId !== readyViewpointId) {
      return
    }
    if (routeSelection.importedNoteId) {
      return
    }
    if (!routeSelection.blockId && !routeSelection.highlightId) {
      return
    }

    const targetBlockId = resolveJumpTargetBlockId(blocks, {
      blockId: routeSelection.blockId,
      highlightId: routeSelection.highlightId
    })

    if (jumpTargetResetTimerRef.current) {
      clearTimeout(jumpTargetResetTimerRef.current)
    }
    setJumpTargetBlockId(targetBlockId)
    jumpTargetResetTimerRef.current = setTimeout(() => {
      setJumpTargetBlockId(undefined)
    }, 2200)

    replaceKnowledgeUrl({ viewpointId: selectedId })
  }, [
    blocks,
    readyViewpointId,
    replaceKnowledgeUrl,
    routeSelection.blockId,
    routeSelection.highlightId,
    routeSelection.importedNoteId,
    selectedId
  ])

  useEffect(() => {
    if (!selectedId || !readyViewpointId || selectedId !== readyViewpointId) {
      return
    }
    viewpointBlocksCacheRef.current.set(selectedId, blocks)
  }, [blocks, readyViewpointId, selectedId])

  useEffect(() => {
    restoringNoteKeyRef.current = null
    setActiveHeadingId(undefined)
    if (!currentNoteKey) {
      setNoteState(DEFAULT_KNOWLEDGE_NOTE_STATE)
      return
    }
    const cached = noteStateCacheRef.current.get(currentNoteKey)
    if (cached) {
      setNoteState(cached)
      return
    }
    void (async () => {
      try {
        const query = new URLSearchParams({ noteKey: currentNoteKey })
        const res = await fetch(`/api/preferences/knowledge-note?${query}`)
        const data = await res.json()
        const resolved = data.item ?? DEFAULT_KNOWLEDGE_NOTE_STATE
        noteStateCacheRef.current.set(currentNoteKey, resolved)
        setNoteState(resolved)
      } catch {
        setNoteState(DEFAULT_KNOWLEDGE_NOTE_STATE)
      }
    })()
  }, [currentNoteKey])

  useEffect(() => {
    if (!currentNoteKey || !contentScrollRef.current) {
      return
    }
    if (jumpTargetBlockId || routeSelection.blockId || routeSelection.highlightId) {
      return
    }
    const contentReady = importedNoteId
      ? importedReadyVersion > 0
      : blocks.length > 0 || selectedId === ""
    if (!contentReady || restoringNoteKeyRef.current === currentNoteKey) {
      return
    }
    const container = contentScrollRef.current
    isRestoringScrollRef.current = true
    const timer = window.setTimeout(() => {
      container.scrollTo({ top: noteState.scrollTop, behavior: "auto" })
      restoringNoteKeyRef.current = currentNoteKey
      window.setTimeout(() => {
        isRestoringScrollRef.current = false
      }, 80)
    }, 40)
    return () => window.clearTimeout(timer)
  }, [
    blocks.length,
    currentNoteKey,
    importedNoteId,
    importedReadyVersion,
    jumpTargetBlockId,
    noteState.scrollTop,
    routeSelection.blockId,
    routeSelection.highlightId,
    selectedId
  ])

  useEffect(() => {
    const container = contentScrollRef.current
    if (!container || !currentNoteKey) {
      return
    }
    let rafId: number | null = null
    const handleScroll = () => {
      if (isRestoringScrollRef.current) {
        return
      }
      if (rafId !== null) {
        return
      }
      rafId = requestAnimationFrame(() => {
        rafId = null
        scheduleNoteStateSave({
          scrollTop: Math.round(container.scrollTop),
          anchorHeadingId: activeHeadingId
        })
      })
    }
    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      container.removeEventListener("scroll", handleScroll)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [activeHeadingId, currentNoteKey, scheduleNoteStateSave])

  useEffect(() => {
    if (!currentNoteKey) {
      return
    }
    scheduleNoteStateSave({ anchorHeadingId: activeHeadingId })
  }, [activeHeadingId, currentNoteKey, scheduleNoteStateSave])

  useEffect(() => {
    const handlePageHide = () => {
      if (!currentNoteKey) {
        return
      }
      if (noteStateTimer.current) {
        clearTimeout(noteStateTimer.current)
      }
      void persistKnowledgeNoteState(currentNoteKey, {
        ...noteStateRef.current,
        scrollTop: Math.round(contentScrollRef.current?.scrollTop ?? 0),
        anchorHeadingId: activeHeadingId
      }, true)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handlePageHide()
      }
    }
    window.addEventListener("pagehide", handlePageHide)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [activeHeadingId, currentNoteKey])

  useEffect(() => {
    return () => {
      if (saveStatusResetTimerRef.current) {
        clearTimeout(saveStatusResetTimerRef.current)
      }
      if (jumpTargetResetTimerRef.current) {
        clearTimeout(jumpTargetResetTimerRef.current)
      }
    }
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

  /** 持久化排序 */
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

  /** 拖拽排序回调 */
  const handleReorder = useCallback(
    async (target: ViewpointDropTarget, sourceId: string) => {
      const prev = viewpoints
      const next = moveViewpointNode(prev, { sourceId, target })
      const prevOrder = JSON.stringify(serializeViewpointOrder(prev))
      const nextOrder = JSON.stringify(serializeViewpointOrder(next))
      if (prevOrder === nextOrder) {
        return
      }
      setViewpoints(next)
      try {
        await persistViewpointOrder(next)
      } catch {
        setViewpoints(prev)
      }
    },
    [persistViewpointOrder, viewpoints]
  )

  /** 新建主题 */
  function openDraft(parentId: string | undefined) {
    setDraftNode({ parentId, placement: parentId ? "child" : "root" })
    setDraftTitle("")
  }

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
      setSelectedId(data.item.id)
      setBlocks(data.item.articleBlocks ?? [])
    }
    setDraftNode(null)
    setDraftTitle("")
  }

  /** 删除主题 */
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
    setViewpoints(nextVps)
    if (selectedId && subtreeIds.includes(selectedId)) {
      setSelectedId(nextSelected?.id)
      setBlocks(nextSelected?.articleBlocks ?? [])
    }
    try {
      const responses = await Promise.all(
        [...subtreeIds]
          .reverse()
          .map((id) => fetch(`/api/viewpoints/${id}`, { method: "DELETE" }))
      )
      if (responses.some((response) => !response.ok)) {
        throw new Error("delete viewpoint failed")
      }
      for (const id of subtreeIds) {
        viewpointBlocksCacheRef.current.delete(id)
        viewpointBlocksRequestRef.current.delete(id)
      }
      if (selectedId && subtreeIds.includes(selectedId)) {
        replaceKnowledgeUrl(nextSelected?.id ? { viewpointId: nextSelected.id } : {})
      }
    } catch {
      setViewpoints(viewpoints)
      setToast("删除失败，请重试")
    }
  }

  /** 重命名主题 */
  const renameViewpoint = useCallback(
    async (viewpointId: string, newTitle: string) => {
      const trimmed = newTitle.trim()
      if (!trimmed) {
        return
      }
      const prev = viewpoints.find((v) => v.id === viewpointId)
      if (!prev || prev.title === trimmed) {
        return
      }
      setViewpoints((c) =>
        c.map((v) => (v.id === viewpointId ? { ...v, title: trimmed } : v))
      )
      try {
        await fetch(`/api/viewpoints/${viewpointId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: trimmed })
        })
      } catch {
        setViewpoints((c) =>
          c.map((v) =>
            v.id === viewpointId ? { ...v, title: prev.title } : v
          )
        )
        setToast("重命名失败")
      }
    },
    [viewpoints]
  )

  /** 划词回调 */
  const handleSelectText = useCallback(
    (blockId: string, text: string) => {
      setActiveRightTab("annotations")
      setSelectionCtx({ blockId, text })
    },
    []
  )

  useEffect(() => {
    if (!selectedBlockForChat) {
      return
    }
    const next = blocks.find((item) => item.id === selectedBlockForChat.id) ?? null
    if (next !== selectedBlockForChat) {
      setSelectedBlockForChat(next)
    }
  }, [blocks, selectedBlockForChat])

  const blocksRef = useRef(blocks)
  blocksRef.current = blocks
  const handleEditorBlockClick = useCallback(
    (blockId: string) => {
      const block = blocksRef.current.find((item) => item.id === blockId)
      setSelectedBlockForChat(block ?? null)
    },
    []
  )

  const refreshBlocks = useCallback(async () => {
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
  }, [selectedId])

  const clearSelectionCtx = useCallback(() => setSelectionCtx(null), [])
  const clearChatBlock = useCallback(() => setSelectedBlockForChat(null), [])
  const cancelDraft = useCallback(() => {
    setDraftNode(null)
    setDraftTitle("")
  }, [])
  const scheduleNoteStateSaveRef = useRef(scheduleNoteStateSave)
  scheduleNoteStateSaveRef.current = scheduleNoteStateSave
  const handleOutlineCollapsedChange = useCallback(
    (collapsed: boolean) => scheduleNoteStateSaveRef.current({ outlineCollapsed: collapsed }),
    []
  )

  const handleSelectImportedNote = useCallback(
    (id: string) => {
      flushCurrentNoteState()
      setImportedReadyVersion(0)
      setImportedNoteId(id)
      setSelectedId("")
      setSelectedBlockForChat(null)
      setSelectionCtx(null)
      replaceKnowledgeUrl({ importedNoteId: id })
    },
    [flushCurrentNoteState, replaceKnowledgeUrl]
  )

  /** 批注变更回调 */
  const handleAnnotationsChange = useCallback((annos: Annotation[]) => {
    const nextIds: string[] = []
    for (const a of annos) {
      if (a.targetBlockId && a.status !== "done") {
        nextIds.push(a.targetBlockId)
      }
    }
    nextIds.sort()
    setAnnotatedBlockIdList((prev) => {
      if (prev.length === nextIds.length && prev.every((id, i) => id === nextIds[i])) {
        return prev
      }
      return nextIds
    })
    const justDone = annos.some((a) => a.status === "done")
    if (justDone) {
      void refreshBlocks()
    }
  }, [refreshBlocks])

  const persistBlocksFromSidebar = useCallback(async (newBlocks: NoteBlock[]) => {
    setBlocks(newBlocks)
    if (!selectedId) {
      return
    }
    if (saveStatusResetTimerRef.current) {
      clearTimeout(saveStatusResetTimerRef.current)
    }
    setSaveStatus("saving")
    try {
      await fetch(`/api/viewpoints/${selectedId}/blocks`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blocks: newBlocks })
      })
      setSaveStatus("saved")
      saveStatusResetTimerRef.current = setTimeout(() => setSaveStatus("idle"), 1800)
    } catch {
      setSaveStatus("idle")
      setToast("保存失败，请重试")
    }
  }, [selectedId])

  const handleBlocksUpdateFromSidebar = useCallback(
    (newBlocks: NoteBlock[]) => void persistBlocksFromSidebar(newBlocks),
    [persistBlocksFromSidebar]
  )

  const handleImportedReady = useCallback(
    () => setImportedReadyVersion((value) => value + 1),
    []
  )
  const openImportDialog = useCallback(() => setShowImportDialog(true), [])
  const closeImportDialog = useCallback(() => setShowImportDialog(false), [])
  const handleImportCreated = useCallback((jobId?: string) => {
    setShowImportDialog(false)
    if (jobId) {
      window.location.href = `/sources/import/${jobId}`
    }
  }, [])
  const clearToast = useCallback(() => setToast(""), [])

  const selectViewpoint = useCallback(
    (viewpointId: string) => {
      flushCurrentNoteState()
      const cached = viewpointBlocksCacheRef.current.get(viewpointId)
      if (cached) {
        setBlocks(cached)
        setReadyViewpointId(viewpointId)
      } else {
        setReadyViewpointId("")
      }
      setSaveStatus("idle")
      setSelectedId(viewpointId)
      setImportedNoteId(null)
      setImportedReadyVersion(0)
      setSelectionCtx(null)
      setSelectedBlockForChat(null)
      setEditingHeaderTitle(false)
      replaceKnowledgeUrl({ viewpointId })
    },
    [flushCurrentNoteState, replaceKnowledgeUrl]
  )
  /** 空页面自动初始化一个空段落 */
  useEffect(() => {
    if (shouldBootstrapEmptyViewpoint({
      selectedId,
      readyViewpointId,
      blockCount: blocks.length
    })) {
      const newId = crypto.randomUUID()
      const initBlock = { type: "paragraph", text: "", id: newId, sortOrder: 0 } as NoteBlock
      setBlocks([initBlock])
    }
  }, [selectedId, readyViewpointId, blocks.length])

  // ---- 元信息 ----
  const { blockCount, charCount } = useMemo(
    () => buildNoteEditorStats(blocks),
    [blocks]
  )
  const pendingAnnoCount = [...annotatedBlockIds].length
  const viewpointEditorReady = shouldRenderViewpointEditor({
    selectedId,
    readyViewpointId
  })

  return (
    <>
      {toast ? <Toast title={toast} onClose={clearToast} /> : null}
      <div className="flex h-screen overflow-hidden bg-surface">
        {/* 左侧主题树 */}
        <aside
          className="relative flex shrink-0 flex-col border-r border-border/50 bg-surface"
          style={{ width: treeWidth }}
        >
          <ViewpointTree
            viewpoints={viewpoints}
            selectedId={selectedId}
            onSelect={selectViewpoint}
            onReorder={handleReorder}
            onCreate={openDraft}
            onRename={renameViewpoint}
            onDelete={deleteViewpoint}
            draftParentId={
              draftNode
                ? draftNode.placement === "root"
                  ? null
                  : draftNode.parentId
                : undefined
            }
            draftTitle={draftTitle}
            onDraftTitleChange={setDraftTitle}
            onDraftSubmit={submitDraft}
            onDraftCancel={cancelDraft}
            importedNotesSlot={
              <ImportedNotesTree
                selectedNoteId={importedNoteId}
                onSelectNote={handleSelectImportedNote}
              />
            }
          />
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20"
            onMouseDown={createResizeHandler(treeWidth, setTreeWidth)}
          />
        </aside>

        {/* 中央笔记面板 */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {importedNoteId ? (
            <ImportedNoteViewer
              noteId={importedNoteId}
              onReady={handleImportedReady}
              scrollContainerRef={contentScrollRef}
            />
          ) : (
          <>
          <KnowledgeHeaderBar
            selected={selected}
            editingHeaderTitle={editingHeaderTitle}
            headerTitleDraft={headerTitleDraft}
            headerInputRef={headerInputRef}
            onHeaderTitleDraftChange={setHeaderTitleDraft}
            onEditingHeaderTitleChange={setEditingHeaderTitle}
            onRename={renameViewpoint}
            onImport={openImportDialog}
          />

          <KnowledgeMetaBar
            selected={selected}
            pendingAnnoCount={pendingAnnoCount}
          />

          {/* 笔记块内容 */}
          <div
            ref={contentScrollRef}
            className="relative min-h-0 flex-1 overflow-y-auto"
          >
            <div className="w-full px-8 py-8">
              {selectedId ? (
                viewpointEditorReady ? (
                  <NoteEditor
                    viewpointId={selectedId}
                    blocks={blocks}
                    annotatedBlockIds={annotatedBlockIds}
                    keyboardShortcuts={keyboardShortcuts}
                    jumpTargetBlockId={jumpTargetBlockId}
                    outlineCollapsed={noteState.outlineCollapsed}
                    selectedBlockId={activeRightTab === "chat" ? selectedBlockForChat?.id : undefined}
                    scrollContainerRef={contentScrollRef}
                    onBlocksChange={setBlocks}
                    onSelectText={handleSelectText}
                    onActiveHeadingChange={setActiveHeadingId}
                    onOutlineCollapsedChange={handleOutlineCollapsedChange}
                    onSaveStatusChange={setSaveStatus}
                    onBlockClick={handleEditorBlockClick}
                  />
                ) : (
                  <div className="mx-auto max-w-[1120px] rounded-[22px] border border-border/30 bg-elevated/20 px-6 py-8 text-[13px] text-muted">
                    正在切换观点…
                  </div>
                )
              ) : null}
            </div>
          </div>

          <KnowledgeStatusBar
            pendingAnnoCount={pendingAnnoCount}
            saveStatus={saveStatus}
            charCount={charCount}
            blockCount={blockCount}
          />
          </>
          )}
        </main>

        {/* 右侧面板（批注/对话） */}
        <aside
          className="relative flex shrink-0 flex-col border-l border-border/50 bg-surface"
          style={{ width: annoWidth }}
        >
          <div
            className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20"
            onMouseDown={createResizeHandler(annoWidth, setAnnoWidth, true)}
          />
          <RightSidebar
            viewpointId={selectedId}
            blocks={deferredChatBlocks}
            selectionContext={selectionCtx}
            selectedBlockForChat={selectedBlockForChat}
            onClearSelection={clearSelectionCtx}
            onClearChatBlock={clearChatBlock}
            onAnnotationsChange={handleAnnotationsChange}
            onBlocksUpdate={handleBlocksUpdateFromSidebar}
            activeTab={activeRightTab}
            onTabChange={setActiveRightTab}
          />
        </aside>
      </div>

      {showImportDialog && (
        <AddSourceDialog
          onClose={closeImportDialog}
          onCreated={handleImportCreated}
        />
      )}
    </>
  )
}

/** 顶部标题栏 — 仅在标题编辑态或选中主题变化时重渲染 */
const KnowledgeHeaderBar = memo(function KnowledgeHeaderBar({
  selected,
  editingHeaderTitle,
  headerTitleDraft,
  headerInputRef,
  onHeaderTitleDraftChange,
  onEditingHeaderTitleChange,
  onRename,
  onImport
}: {
  selected?: Viewpoint
  editingHeaderTitle: boolean
  headerTitleDraft: string
  headerInputRef: React.RefObject<HTMLInputElement>
  onHeaderTitleDraftChange: (value: string) => void
  onEditingHeaderTitleChange: (editing: boolean) => void
  onRename: (id: string, title: string) => Promise<void>
  onImport: () => void
}) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 bg-surface px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        {editingHeaderTitle && selected ? (
          <input
            ref={headerInputRef}
            autoFocus
            className="min-w-0 flex-1 rounded-md bg-elevated/60 px-2 py-0.5 text-[15px] font-semibold text-foreground outline-none ring-1 ring-primary/30 transition-shadow focus:ring-primary/50"
            value={headerTitleDraft}
            onChange={(e) => onHeaderTitleDraftChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={() => {
              void onRename(selected.id, headerTitleDraft)
              onEditingHeaderTitleChange(false)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void onRename(selected.id, headerTitleDraft)
                onEditingHeaderTitleChange(false)
              }
              if (e.key === "Escape") {
                onEditingHeaderTitleChange(false)
              }
            }}
          />
        ) : (
          <span
            className="group/title flex min-w-0 items-center gap-1.5 truncate text-[15px] font-semibold text-foreground cursor-text rounded-md px-2 py-0.5 -mx-2 transition-colors hover:bg-overlay/40"
            onClick={() => {
              if (selected) {
                onEditingHeaderTitleChange(true)
                onHeaderTitleDraftChange(selected.title)
              }
            }}
          >
            <span className="truncate">{selected?.title ?? "未选择主题"}</span>
            {selected && (
              <Pencil className="h-3 w-3 shrink-0 text-muted/30 opacity-0 transition-opacity group-hover/title:opacity-100" />
            )}
          </span>
        )}
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
          onClick={onImport}
          className="h-7 gap-1.5 px-2.5 text-[12px] text-muted hover:text-foreground"
        >
          <Import className="h-3.5 w-3.5" />
          导入
        </Button>
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
  )
})

/** 元信息栏 — 仅在选中主题或批注数变化时重渲染 */
const KnowledgeMetaBar = memo(function KnowledgeMetaBar({
  selected,
  pendingAnnoCount
}: {
  selected?: Viewpoint
  pendingAnnoCount: number
}) {
  if (!selected) {
    return null
  }
  return (
    <div className="flex shrink-0 items-center gap-4 border-b border-border/30 bg-surface/80 px-6 py-1.5">
      <div className="flex items-center gap-1.5 text-muted/60">
        <BookOpen className="h-3 w-3" />
        <span className="text-[11px]">
          来自 {selected.relatedBookIds.length} 本书 · {selected.highlightCount} 条划线
        </span>
      </div>
      {pendingAnnoCount > 0 && (
        <>
          <span className="text-[11px] text-muted">·</span>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium text-primary">
              {pendingAnnoCount} 条批注待处理
            </span>
          </div>
        </>
      )}
    </div>
  )
})

/** 底部状态栏 — 仅在保存状态或统计数变化时重渲染 */
const KnowledgeStatusBar = memo(function KnowledgeStatusBar({
  pendingAnnoCount,
  saveStatus,
  charCount,
  blockCount
}: {
  pendingAnnoCount: number
  saveStatus: "idle" | "saving" | "saved"
  charCount: number
  blockCount: number
}) {
  return (
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
      <div className="flex items-center gap-3 text-[11px] text-muted">
        {saveStatus === "saving" && (
          <span className="flex items-center gap-1 text-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
            保存中
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="flex items-center gap-1 text-success/60">
            <Check className="h-3 w-3" />
            已保存
          </span>
        )}
        <span>{charCount.toLocaleString()} 字</span>
        <span>{blockCount} 个块</span>
      </div>
    </div>
  )
})

function resolveClientSelectedViewpointId(
  viewpoints: Viewpoint[],
  viewpointId?: string
) {
  if (!viewpointId) {
    return viewpoints[0]?.id
  }
  return viewpoints.find((item) => item.id === viewpointId)?.id
    ?? viewpoints[0]?.id
}

async function persistKnowledgeNoteState(
  noteKey: string,
  state: {
    outlineCollapsed: boolean
    scrollTop: number
    anchorHeadingId?: string
  },
  immediate = false
) {
  const payload = JSON.stringify({
    noteKey,
    outlineCollapsed: state.outlineCollapsed,
    scrollTop: Math.max(0, Math.round(state.scrollTop)),
    anchorHeadingId: state.anchorHeadingId ?? null
  })
  if (
    immediate &&
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    const blob = new Blob([payload], { type: "application/json" })
    navigator.sendBeacon("/api/preferences/knowledge-note", blob)
    return
  }
  await fetch("/api/preferences/knowledge-note", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: immediate
  })
}

function getRequestIdleCallback() {
  if (typeof window === "undefined" || !("requestIdleCallback" in window)) {
    return null
  }
  return window.requestIdleCallback.bind(window)
}

function getCancelIdleCallback() {
  if (typeof window === "undefined" || !("cancelIdleCallback" in window)) {
    return null
  }
  return window.cancelIdleCallback.bind(window)
}

function reportViewpointLoadTiming(input: {
  viewpointId: string
  totalDuration: number
  responseDuration: number
  parseDuration: number
  serverTiming: Array<{
    name: string
    duration: number
    description?: string
  }>
}) {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") {
    return
  }
  const markBase = `lumina:viewpoint:${input.viewpointId}:${Date.now()}`
  if (typeof performance !== "undefined" && typeof performance.mark === "function") {
    performance.mark(`${markBase}:start`)
    performance.mark(`${markBase}:end`)
    performance.measure(
      `${markBase}:total`,
      `${markBase}:start`,
      `${markBase}:end`
    )
  }
  console.info("[lumina] viewpoint load", {
    viewpointId: input.viewpointId,
    totalMs: roundClientTiming(input.totalDuration),
    responseMs: roundClientTiming(input.responseDuration),
    parseMs: roundClientTiming(input.parseDuration),
    server: input.serverTiming.map((metric) => ({
      name: metric.name,
      duration: roundClientTiming(metric.duration),
      description: metric.description
    }))
  })
}

function roundClientTiming(value: number) {
  return Math.round(value * 100) / 100
}
