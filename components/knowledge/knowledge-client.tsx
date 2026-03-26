"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"
import {
  usePathname,
  useRouter,
  useSearchParams
} from "next/navigation"
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
  DEFAULT_KNOWLEDGE_NOTE_STATE,
  buildKnowledgeNoteKey,
  buildKnowledgeSearch,
  readKnowledgeSelection
} from "@/components/knowledge/knowledge-url-state"
import { RightSidebar, type RightSidebarTab } from "@/components/knowledge/right-sidebar"
import { ViewpointTree } from "@/components/knowledge/viewpoint-tree"
import {
  collectViewpointSubtreeIds,
  moveViewpointNode,
  serializeViewpointOrder,
  type ViewpointDropTarget,
} from "@/components/knowledge/viewpoint-tree-utils"
import { BLOCK_TYPE_REGISTRY } from "@/components/knowledge/block-type-registry"
import type {
  AppKeyboardShortcuts,
  Annotation,
  Highlight,
  NoteBlock,
  NoteBlockType,
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
  keyboardShortcuts,
  initialSelected,
  unconfirmed,
  initialWidths
}: {
  initialViewpoints: Viewpoint[]
  initialImportedNoteId?: string
  keyboardShortcuts?: AppKeyboardShortcuts
  initialSelected?: Viewpoint
  unconfirmed: (Highlight & { similarityScore?: number })[]
  initialWidths: {
    knowledgeTreeWidth: number
    knowledgeListWidth: number
  }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [toast, setToast] = useState("")
  const [viewpoints, setViewpoints] = useState(initialViewpoints)
  const [selectedId, setSelectedId] = useState(
    initialImportedNoteId
      ? ""
      : (initialSelected?.id ?? initialViewpoints[0]?.id ?? "")
  )
  const [blocks, setBlocks] = useState<NoteBlock[]>(
    initialSelected?.articleBlocks ?? []
  )
  const [treeWidth, setTreeWidth] = useState(initialWidths.knowledgeTreeWidth)
  const [annoWidth, setAnnoWidth] = useState(initialWidths.knowledgeListWidth)
  const [draftNode, setDraftNode] = useState<DraftNode | null>(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [editingHeaderTitle, setEditingHeaderTitle] = useState(false)
  const [headerTitleDraft, setHeaderTitleDraft] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [selectionCtx, setSelectionCtx] = useState<SelectionContext | null>(null)
  const [annotatedBlockIds, setAnnotatedBlockIds] = useState<Set<string>>(
    new Set()
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

  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteStateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const restoringNoteKeyRef = useRef<string | null>(null)
  const isRestoringScrollRef = useRef(false)
  /** 编辑中的文本变更，不触发 React 重渲染 */
  const editsRef = useRef<Map<string, string>>(new Map())
  const blocksRef = useRef(blocks)
  blocksRef.current = blocks
  const noteStateRef = useRef(noteState)
  noteStateRef.current = noteState
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const headerInputRef = useRef<HTMLInputElement>(null)
  const selected = viewpoints.find((v) => v.id === selectedId)
  const routeSelection = useMemo(
    () => readKnowledgeSelection(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )
  const currentSelection = useMemo(
    () => importedNoteId
      ? { importedNoteId }
      : { viewpointId: selectedId || undefined },
    [importedNoteId, selectedId]
  )
  const currentNoteKey = buildKnowledgeNoteKey(currentSelection)

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
    setNoteState(next)
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

  const replaceKnowledgeUrl = useCallback((selection: {
    viewpointId?: string
    importedNoteId?: string
  }) => {
    const nextSearch = buildKnowledgeSearch(
      new URLSearchParams(searchParams.toString()),
      selection
    )
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams])

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
    }
  }, [importedNoteId, routeSelection, selectedId, viewpoints])

  useEffect(() => {
    restoringNoteKeyRef.current = null
    setActiveHeadingId(undefined)
    if (!currentNoteKey) {
      setNoteState(DEFAULT_KNOWLEDGE_NOTE_STATE)
      return
    }
    void (async () => {
      try {
        const query = new URLSearchParams({ noteKey: currentNoteKey })
        const res = await fetch(`/api/preferences/knowledge-note?${query}`)
        const data = await res.json()
        setNoteState(data.item ?? DEFAULT_KNOWLEDGE_NOTE_STATE)
      } catch {
        setNoteState(DEFAULT_KNOWLEDGE_NOTE_STATE)
      }
    })()
  }, [currentNoteKey])

  useEffect(() => {
    if (!currentNoteKey || !contentScrollRef.current) {
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
    noteState.scrollTop,
    selectedId
  ])

  useEffect(() => {
    const container = contentScrollRef.current
    if (!container || !currentNoteKey) {
      return
    }
    const handleScroll = () => {
      if (isRestoringScrollRef.current) {
        return
      }
      scheduleNoteStateSave({
        scrollTop: Math.round(container.scrollTop),
        anchorHeadingId: activeHeadingId
      })
    }
    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
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
      await Promise.all(
        [...subtreeIds]
          .reverse()
          .map((id) => fetch(`/api/viewpoints/${id}`, { method: "DELETE" }))
      )
    } catch {
      setViewpoints(viewpoints)
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

  /** 批注变更回调 */
  const handleAnnotationsChange = useCallback((annos: Annotation[]) => {
    const ids = new Set<string>()
    for (const a of annos) {
      if (a.targetBlockId && a.status !== "done") {
        ids.add(a.targetBlockId)
      }
    }
    setAnnotatedBlockIds(ids)
    const justDone = annos.some((a) => a.status === "done")
    if (justDone) {
      void refreshBlocks()
    }
  }, [refreshBlocks])

  /** 构建保存载荷 */
  const buildSavePayload = useCallback(() => {
    if (editsRef.current.size === 0) {
      return blocksRef.current
    }
    return blocksRef.current.map((b) => {
      const edited = editsRef.current.get(b.id)
      if (edited === undefined) {
        return b
      }
      if ("code" in b && b.type === "code") {
        return { ...b, code: edited }
      }
      if ("text" in b) {
        return { ...b, text: edited }
      }
      return b
    })
  }, [])

  /** 合并编辑到 state */
  const flushEditsToState = useCallback(() => {
    if (editsRef.current.size === 0) {
      return
    }
    const snapshot = new Map(editsRef.current)
    editsRef.current.clear()
    setBlocks((prev) =>
      prev.map((b) => {
        const edited = snapshot.get(b.id)
        if (edited === undefined) {
          return b
        }
        if ("code" in b && b.type === "code") {
          return { ...b, code: edited } as typeof b
        }
        if ("text" in b) {
          return { ...b, text: edited } as typeof b
        }
        return b
      })
    )
  }, [])

  /** 切换主题前刷新未保存的编辑 */
  const selectViewpoint = useCallback(
    async (viewpointId: string) => {
      flushCurrentNoteState()
      if (editsRef.current.size > 0 && selectedIdRef.current) {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current)
          saveTimer.current = null
        }
        const payload = buildSavePayload()
        flushEditsToState()
        try {
          await fetch(`/api/viewpoints/${selectedIdRef.current}/blocks`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ blocks: payload })
          })
        } catch {
          /* 静默失败 */
        }
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
    [
      buildSavePayload,
      flushCurrentNoteState,
      flushEditsToState,
      replaceKnowledgeUrl
    ]
  )

  /** 块文本编辑 */
  const handleBlockTextChange = useCallback(
    (blockId: string, text: string) => {
      editsRef.current.set(blockId, text)
      setSaveStatus("idle")
      if (savedStatusTimer.current) {
        clearTimeout(savedStatusTimer.current)
      }
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }
      saveTimer.current = setTimeout(async () => {
        const vid = selectedIdRef.current
        if (!vid) {
          return
        }
        setSaveStatus("saving")
        try {
          const payload = buildSavePayload()
          await fetch(`/api/viewpoints/${vid}/blocks`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ blocks: payload })
          })
          flushEditsToState()
          setSaveStatus("saved")
          savedStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 2000)
        } catch {
          setToast("保存失败，请重试")
          setSaveStatus("idle")
        }
      }, 800)
    },
    [buildSavePayload, flushEditsToState]
  )

  /** 删除单个笔记块 */
  const handleBlockDelete = useCallback(
    async (blockId: string) => {
      const vid = selectedIdRef.current
      if (!vid) {
        return
      }
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      flushEditsToState()
      editsRef.current.delete(blockId)
      const next = blocksRef.current.filter((b) => b.id !== blockId)
      blocksRef.current = next
      setBlocks(next)
      setSaveStatus("saving")
      try {
        await fetch(`/api/viewpoints/${vid}/blocks`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ blocks: next })
        })
        setSaveStatus("saved")
        if (savedStatusTimer.current) {
          clearTimeout(savedStatusTimer.current)
        }
        savedStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 2000)
      } catch {
        setToast("删除失败，请重试")
        setSaveStatus("idle")
      }
    },
    [flushEditsToState]
  )

  /** 插入新笔记块 */
  const handleBlockInsert = useCallback(
    async (afterBlockId: string | null, type: NoteBlockType) => {
      const vid = selectedIdRef.current
      if (!vid) {
        return
      }
      // 先 flush 待保存的编辑
      flushEditsToState()
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }

      const sorted = [...blocksRef.current].sort((a, b) => a.sortOrder - b.sortOrder)
      let newSortOrder: number
      if (afterBlockId === null) {
        // 插入开头
        newSortOrder = sorted.length > 0 ? sorted[0].sortOrder - 1 : 0
      } else {
        const idx = sorted.findIndex((b) => b.id === afterBlockId)
        if (idx >= 0 && idx < sorted.length - 1) {
          newSortOrder = (sorted[idx].sortOrder + sorted[idx + 1].sortOrder) / 2
        } else {
          newSortOrder = (sorted[sorted.length - 1]?.sortOrder ?? 0) + 1
        }
      }

      const entry = BLOCK_TYPE_REGISTRY.find((e) => e.type === type)
      const defaults = entry?.createDefault() ?? { type: "paragraph", text: "" }
      const newBlock = {
        ...defaults,
        id: crypto.randomUUID(),
        sortOrder: newSortOrder,
      } as NoteBlock

      const next = [...blocksRef.current, newBlock]
      blocksRef.current = next
      setBlocks(next)

      // 立即保存
      setSaveStatus("saving")
      try {
        await fetch(`/api/viewpoints/${vid}/blocks`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ blocks: next })
        })
        setSaveStatus("saved")
        if (savedStatusTimer.current) {
          clearTimeout(savedStatusTimer.current)
        }
        savedStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 2000)
      } catch {
        setToast("插入失败，请重试")
        setSaveStatus("idle")
      }
    },
    [flushEditsToState]
  )

  /** Enter 新建段落（返回新块 ID 用于聚焦） */
  const [focusBlockId, setFocusBlockId] = useState<string>()
  const handleEnterNewBlock = useCallback(
    (blockId: string) => {
      const vid = selectedIdRef.current
      if (!vid) {
        return
      }
      flushEditsToState()

      const sorted = [...blocksRef.current].sort((a, b) => a.sortOrder - b.sortOrder)
      const idx = sorted.findIndex((b) => b.id === blockId)
      let newSortOrder: number
      if (idx >= 0 && idx < sorted.length - 1) {
        newSortOrder = (sorted[idx].sortOrder + sorted[idx + 1].sortOrder) / 2
      } else {
        newSortOrder = (sorted[sorted.length - 1]?.sortOrder ?? 0) + 1
      }

      const newId = crypto.randomUUID()
      const newBlock = { type: "paragraph", text: "", id: newId, sortOrder: newSortOrder } as NoteBlock
      const next = [...blocksRef.current, newBlock]
      blocksRef.current = next
      setBlocks(next)
      setFocusBlockId(newId)

      // 延迟保存
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }
      saveTimer.current = setTimeout(async () => {
        setSaveStatus("saving")
        try {
          await fetch(`/api/viewpoints/${vid}/blocks`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ blocks: blocksRef.current })
          })
          setSaveStatus("saved")
          savedStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 2000)
        } catch {
          setSaveStatus("idle")
        }
      }, 400)
    },
    [flushEditsToState]
  )

  /** Backspace 删除空块并聚焦上一块 */
  const handleBackspaceEmpty = useCallback(
    (blockId: string) => {
      const vid = selectedIdRef.current
      if (!vid) {
        return
      }
      const sorted = [...blocksRef.current].sort((a, b) => a.sortOrder - b.sortOrder)
      // 只剩一个块时不删
      if (sorted.length <= 1) {
        return
      }
      const idx = sorted.findIndex((b) => b.id === blockId)
      // 聚焦上一块（如果是第一块则聚焦下一块）
      const prevBlock = idx > 0 ? sorted[idx - 1] : sorted[1]
      if (prevBlock) {
        setFocusBlockId(prevBlock.id)
      }

      flushEditsToState()
      editsRef.current.delete(blockId)
      const next = blocksRef.current.filter((b) => b.id !== blockId)
      blocksRef.current = next
      setBlocks(next)

      // 延迟保存
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }
      saveTimer.current = setTimeout(async () => {
        setSaveStatus("saving")
        try {
          await fetch(`/api/viewpoints/${vid}/blocks`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ blocks: blocksRef.current })
          })
          setSaveStatus("saved")
          savedStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 2000)
        } catch {
          setSaveStatus("idle")
        }
      }, 400)
    },
    [flushEditsToState]
  )

  /** / 选择后替换块类型 */
  const handleBlockTypeChange = useCallback(
    (blockId: string, type: NoteBlockType) => {
      const vid = selectedIdRef.current
      if (!vid) {
        return
      }
      flushEditsToState()

      const entry = BLOCK_TYPE_REGISTRY.find((e) => e.type === type)
      if (!entry) {
        return
      }
      const defaults = entry.createDefault()
      const next = blocksRef.current.map((b) => {
        if (b.id !== blockId) {
          return b
        }
        return { ...defaults, id: b.id, sortOrder: b.sortOrder } as NoteBlock
      })
      blocksRef.current = next
      setBlocks(next)
      setFocusBlockId(blockId)

      // 延迟保存
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }
      saveTimer.current = setTimeout(async () => {
        setSaveStatus("saving")
        try {
          await fetch(`/api/viewpoints/${vid}/blocks`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ blocks: blocksRef.current })
          })
          setSaveStatus("saved")
          savedStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 2000)
        } catch {
          setSaveStatus("idle")
        }
      }, 400)
    },
    [flushEditsToState]
  )

  /** 空页面自动初始化一个空段落 */
  useEffect(() => {
    if (selectedId && blocks.length === 0) {
      const newId = crypto.randomUUID()
      const initBlock = { type: "paragraph", text: "", id: newId, sortOrder: 0 } as NoteBlock
      blocksRef.current = [initBlock]
      setBlocks([initBlock])
      setFocusBlockId(newId)
    }
  }, [selectedId, blocks.length])

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

  return (
    <>
      {toast ? <Toast title={toast} onClose={() => setToast("")} /> : null}
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
            onDraftCancel={() => {
              setDraftNode(null)
              setDraftTitle("")
            }}
            importedNotesSlot={
              <ImportedNotesTree
                selectedNoteId={importedNoteId}
                onSelectNote={(id) => {
                  flushCurrentNoteState()
                  setImportedReadyVersion(0)
                  setImportedNoteId(id)
                  setSelectedId("")
                  setSelectedBlockForChat(null)
                  setSelectionCtx(null)
                  replaceKnowledgeUrl({ importedNoteId: id })
                }}
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
              onReady={() => setImportedReadyVersion((value) => value + 1)}
              scrollContainerRef={contentScrollRef}
            />
          ) : (
          <>
          {/* 顶部标题栏 */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 bg-surface px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              {editingHeaderTitle && selected ? (
                <input
                  ref={headerInputRef}
                  autoFocus
                  className="min-w-0 flex-1 rounded-md bg-elevated/60 px-2 py-0.5 text-[15px] font-semibold text-foreground outline-none ring-1 ring-primary/30 transition-shadow focus:ring-primary/50"
                  value={headerTitleDraft}
                  onChange={(e) => setHeaderTitleDraft(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => {
                    void renameViewpoint(selected.id, headerTitleDraft)
                    setEditingHeaderTitle(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void renameViewpoint(selected.id, headerTitleDraft)
                      setEditingHeaderTitle(false)
                    }
                    if (e.key === "Escape") {
                      setEditingHeaderTitle(false)
                    }
                  }}
                />
              ) : (
                <span
                  className="group/title flex min-w-0 items-center gap-1.5 truncate text-[15px] font-semibold text-foreground cursor-text rounded-md px-2 py-0.5 -mx-2 transition-colors hover:bg-overlay/40"
                  onClick={() => {
                    if (selected) {
                      setEditingHeaderTitle(true)
                      setHeaderTitleDraft(selected.title)
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
                onClick={() => setShowImportDialog(true)}
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
          )}

          {/* 笔记块内容 */}
          <div
            ref={contentScrollRef}
            className="relative min-h-0 flex-1 overflow-y-auto"
          >
            <div className="w-full px-8 py-8">
              {selectedId ? (
                <NoteEditor
                  viewpointId={selectedId}
                  blocks={blocks}
                  annotatedBlockIds={annotatedBlockIds}
                  keyboardShortcuts={keyboardShortcuts}
                  outlineCollapsed={noteState.outlineCollapsed}
                  selectedBlockId={activeRightTab === "chat" ? selectedBlockForChat?.id : undefined}
                  scrollContainerRef={contentScrollRef}
                  onBlocksChange={setBlocks}
                  onSelectText={handleSelectText}
                  onActiveHeadingChange={setActiveHeadingId}
                  onOutlineCollapsedChange={(collapsed) => {
                    scheduleNoteStateSave({ outlineCollapsed: collapsed })
                  }}
                  onSaveStatusChange={setSaveStatus}
                  onBlockClick={activeRightTab === "chat" ? (blockId) => {
                    const block = blocks.find((item) => item.id === blockId)
                    setSelectedBlockForChat(block ?? null)
                  } : undefined}
                />
              ) : null}
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
            blocks={blocks}
            selectionContext={selectionCtx}
            selectedBlockForChat={selectedBlockForChat}
            onClearSelection={() => setSelectionCtx(null)}
            onClearChatBlock={() => setSelectedBlockForChat(null)}
            onAnnotationsChange={handleAnnotationsChange}
            onBlocksUpdate={(newBlocks) => {
              setBlocks(newBlocks)
              void fetch(`/api/viewpoints/${selectedId}/blocks`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ blocks: newBlocks })
              })
            }}
            activeTab={activeRightTab}
            onTabChange={setActiveRightTab}
          />
        </aside>
      </div>

      {showImportDialog && (
        <AddSourceDialog
          onClose={() => setShowImportDialog(false)}
          onCreated={(jobId) => {
            setShowImportDialog(false)
            if (jobId) {
              window.location.href = `/sources/import/${jobId}`
            }
          }}
        />
      )}
    </>
  )
}

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
