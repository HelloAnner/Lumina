"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

/**
 * 知识库页面客户端容器 - Notion 风格所见即所得编辑器
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
  const editorRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isComposing = useRef(false)

  const selected = viewpoints.find((item) => item.id === selectedId)
  const tree = useMemo(() => buildViewpointTree(viewpoints), [viewpoints])

  // 统计信息
  const stats = useMemo(() => {
    const lines = content ? content.split("\n").length : 0
    const chars = content.length
    const words = content.trim().split(/[\s\u3000]+/).filter(Boolean).length
    return { lines, chars, words }
  }, [content])

  // 将内容解析为 HTML 用于显示
  const renderContent = useCallback((text: string): string => {
    if (!text) return '<p class="empty-paragraph"><br></p>'

    const lines = text.split("\n")
    let html = ""
    let inCodeBlock = false
    let codeBlockContent = ""
    let codeBlockLang = ""

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // 代码块处理
      if (line.startsWith("```")) {
        if (!inCodeBlock) {
          inCodeBlock = true
          codeBlockLang = line.slice(3).trim()
          codeBlockContent = ""
        } else {
          inCodeBlock = false
          html += `<pre class="code-block" data-lang="${codeBlockLang}"><code>${escapeHtml(codeBlockContent.trim())}</code></pre>`
          codeBlockContent = ""
          codeBlockLang = ""
        }
        continue
      }

      if (inCodeBlock) {
        codeBlockContent += line + "\n"
        continue
      }

      // 空行
      if (!line.trim()) {
        html += '<p class="empty-paragraph"><br></p>'
        continue
      }

      // 标题
      if (line.startsWith("# ")) {
        html += `<h1>${escapeHtml(line.slice(2))}</h1>`
        continue
      }
      if (line.startsWith("## ")) {
        html += `<h2>${escapeHtml(line.slice(3))}</h2>`
        continue
      }
      if (line.startsWith("### ")) {
        html += `<h3>${escapeHtml(line.slice(4))}</h3>`
        continue
      }

      // 引用
      if (line.startsWith("> ")) {
        html += `<blockquote>${escapeHtml(line.slice(2))}</blockquote>`
        continue
      }

      // 无序列表
      if (line.match(/^[-*]\s/)) {
        html += `<ul><li>${escapeHtml(line.slice(2))}</li></ul>`
        continue
      }

      // 有序列表
      const orderedMatch = line.match(/^(\d+)\.\s/)
      if (orderedMatch) {
        html += `<ol><li>${escapeHtml(line.slice(orderedMatch[0].length))}</li></ol>`
        continue
      }

      // 普通段落（处理行内格式）
      let processed = escapeHtml(line)
      processed = processed
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
      html += `<p>${processed}</p>`
    }

    // 未闭合的代码块
    if (inCodeBlock) {
      html += `<pre class="code-block" data-lang="${codeBlockLang}"><code>${escapeHtml(codeBlockContent.trim())}</code></pre>`
    }

    return html
  }, [])

  // 获取编辑器纯文本
  const getEditorText = useCallback((): string => {
    if (!editorRef.current) return ""
    return editorRef.current.innerText || ""
  }, [])

  // 设置编辑器内容
  const setEditorContent = useCallback((text: string) => {
    if (!editorRef.current) return
    editorRef.current.innerHTML = renderContent(text)
  }, [renderContent])

  // 初始化编辑器内容
  useEffect(() => {
    if (editorRef.current) {
      setEditorContent(content)
    }
  }, [selectedId])

  // 保存到服务器
  useEffect(() => {
    if (!selected || saveTimer.current) {
      clearTimeout(saveTimer.current!)
    }
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/viewpoints/${selected!.id}/article`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ articleContent: content })
      })
    }, 500)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [content, selected])

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

  // 编辑器事件处理
  const handleInput = useCallback(() => {
    const text = getEditorText()
    setContent(text)
  }, [getEditorText])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (isComposing.current) return

    // 回车键处理 - 智能延续格式
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()

      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return

      const range = selection.getRangeAt(0)
      const currentNode = range.startContainer.parentElement
      const currentBlock = currentNode?.closest("p, h1, h2, h3, blockquote, li") || currentNode

      if (currentBlock) {
        const blockText = currentBlock.textContent || ""

        // 检测当前行格式
        let prefix = ""
        if (blockText.startsWith("# ")) prefix = "# "
        else if (blockText.startsWith("## ")) prefix = "## "
        else if (blockText.startsWith("### ")) prefix = "### "
        else if (blockText.startsWith("> ")) prefix = "> "
        else if (blockText.match(/^[-*]\s/)) prefix = "- "
        else if (blockText.match(/^\d+\.\s/)) {
          const match = blockText.match(/^(\d+)\.\s/)
          if (match) {
            const num = parseInt(match[1]) + 1
            prefix = `${num}. `
          }
        }

        // 插入新行
        const br = document.createElement("br")
        const newBlock = document.createElement("p")
        newBlock.innerHTML = prefix ? prefix : "<br>"

        range.deleteContents()
        range.insertNode(br)
        range.collapse(false)

        // 如果有前缀，在当前位置插入带前缀的文本
        if (prefix) {
          const textNode = document.createTextNode(prefix)
          range.insertNode(textNode)
          range.setStartAfter(textNode)
          range.setEndAfter(textNode)
        }

        selection.removeAllRanges()
        selection.addRange(range)

        // 触发输入事件更新状态
        handleInput()
      }
    }

    // 快捷键处理
    if (event.metaKey || event.ctrlKey) {
      // 加粗: Cmd/Ctrl + B
      if (event.key === "b") {
        event.preventDefault()
        wrapSelection("**", "**")
      }
      // 斜体: Cmd/Ctrl + I
      if (event.key === "i") {
        event.preventDefault()
        wrapSelection("*", "*")
      }
    }
  }, [handleInput])

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true
  }, [])

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false
    handleInput()
  }, [handleInput])

  // 包裹选中文本
  const wrapSelection = useCallback((before: string, after: string) => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return

    const range = selection.getRangeAt(0)
    const selectedText = range.toString()

    if (selectedText) {
      const wrappedText = before + selectedText + after
      range.deleteContents()
      const textNode = document.createTextNode(wrappedText)
      range.insertNode(textNode)
      range.selectNode(textNode)
      selection.removeAllRanges()
      selection.addRange(range)
      handleInput()
    }
  }, [handleInput])

  // 工具栏操作
  const insertBlock = useCallback((prefix: string) => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return

    const range = selection.getRangeAt(0)
    const currentBlock = range.startContainer.parentElement

    if (currentBlock) {
      const text = currentBlock.textContent || ""
      currentBlock.textContent = prefix + text

      // 移动光标到行尾
      const newRange = document.createRange()
      newRange.selectNodeContents(currentBlock)
      newRange.collapse(false)
      selection.removeAllRanges()
      selection.addRange(newRange)

      handleInput()
    }
    editorRef.current.focus()
  }, [handleInput])

  const toolbarItems = [
    { label: "H1", icon: Heading1, action: () => insertBlock("# ") },
    { label: "H2", icon: Heading2, action: () => insertBlock("## ") },
    { label: "加粗", icon: Bold, action: () => wrapSelection("**", "**") },
    { label: "引用", icon: Quote, action: () => insertBlock("> ") },
    { label: "列表", icon: List, action: () => insertBlock("- ") },
    { label: "有序", icon: ListOrdered, action: () => insertBlock("1. ") },
    { label: "代码", icon: Code2, action: () => wrapSelection("`", "`") }
  ]

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
      setViewpoints((current) => [...current, data.item])
      if (draftNode.parentId) {
        setExpanded((current) => ({ ...current, [draftNode.parentId!]: true }))
      }
      setSelectedId(data.item.id)
      setFocusedParentId(data.item.id)
      setContent(data.item.articleContent)
      setEditorContent(data.item.articleContent)
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
    if (selectedId && subtreeIds.includes(selectedId)) {
      setSelectedId(nextSelected?.id)
      setContent(nextSelected?.articleContent ?? "")
      setEditorContent(nextSelected?.articleContent ?? "")
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
      setViewpoints(viewpoints)
      setSelectedId(selectedId)
      setFocusedParentId(focusedParentId)
      setContent(selected?.articleContent ?? content)
      setEditorContent(selected?.articleContent ?? content)
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
          onClick={() => {
            setSelectedId(node.id)
            setFocusedParentId(node.id)
            const vp = viewpoints.find(v => v.id === node.id)
            setContent(vp?.articleContent ?? "")
            setEditorContent(vp?.articleContent ?? "")
          }}
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
            <span>{stats.chars} 字</span>
            <span className="mx-1">·</span>
            <span>自动保存</span>
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
                  setContent(selected?.articleContent ?? "")
                  setEditorContent(selected?.articleContent ?? "")
                }}
                title="撤销更改"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* 所见即所得编辑区 */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-8 py-8">
              <div
                ref={editorRef}
                className="wysiwyg-editor min-h-[calc(100vh-200px)] outline-none"
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                spellCheck={false}
                data-placeholder="在此开始记录你的想法、观点和论证..."
              />
            </div>
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
          {pendingNotes.length === 0 ? (
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

// 工具函数：转义 HTML
function escapeHtml(text: string): string {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}
