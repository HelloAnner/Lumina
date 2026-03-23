"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  Mail,
  Eye,
  Edit3,
  GripVertical
} from "lucide-react"
import { marked } from "marked"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  buildViewpointTree,
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

interface CursorPosition {
  top: number
  left: number
}

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
  const [listWidth, setListWidth] = useState(initialWidths.knowledgeListWidth)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialViewpoints.map((item) => [item.id, true]))
  )
  const [focusedParentId, setFocusedParentId] = useState<string | null>(
    initialSelected?.id ?? null
  )
  const [draftNode, setDraftNode] = useState<DraftNode | null>(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null)
  const [currentLine, setCurrentLine] = useState("")
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<ViewpointDropTarget | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 抽取可调整大小面板的拖拽逻辑
  const createResizeHandler = useCallback(
    (initialWidth: number, onResize: (width: number) => void) => {
      return (event: React.MouseEvent) => {
        const startX = event.clientX
        const initial = initialWidth
        const move = (moveEvent: MouseEvent) =>
          onResize(Math.min(420, Math.max(180, initial + moveEvent.clientX - startX)))
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

  // 追踪光标位置并提取当前行
  const updateCursorPosition = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const { selectionStart, value } = textarea
    // 提取当前行
    const beforeCursor = value.slice(0, selectionStart)
    const lines = beforeCursor.split("\n")
    const currentLineText = lines[lines.length - 1] || ""
    setCurrentLine(currentLineText)

    // 使用更精确的方法获取光标位置
    const textLines = value.slice(0, selectionStart).split("\n")
    const lineHeight = 28 // 约等于 text-sm leading-7
    const charWidth = 8.4 // 约等于 monospace 字体的字符宽度

    const top = textLines.length * lineHeight + 16 // 16px padding
    const left = currentLineText.length * charWidth + 16

    setCursorPosition({ top, left })
  }, [])

  // 防抖更新光标位置
  const debouncedUpdateCursor = useCallback(() => {
    requestAnimationFrame(() => {
      updateCursorPosition()
    })
  }, [updateCursorPosition])

  const selected = viewpoints.find((item) => item.id === selectedId)
  const tree = useMemo(() => buildViewpointTree(viewpoints), [viewpoints])
  const previewHtml = useMemo(() => marked.parse(article), [article])
  const inlinePreviewHtml = useMemo(() => {
    if (!currentLine.trim()) return ""
    return marked.parse(currentLine)
  }, [currentLine])

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
    }, 900)
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
          knowledgeListWidth: Math.round(listWidth)
        })
      })
    }, 180)
    return () => {
      if (prefTimer.current) {
        clearTimeout(prefTimer.current)
      }
    }
  }, [treeWidth, listWidth])

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

  function renderDraft(depth: number) {
    if (!draftNode) {
      return null
    }
    return (
      <div className="px-2 py-1" style={{ paddingLeft: 12 + depth * 14 }}>
        <input
          autoFocus
          className="h-9 w-full rounded-md border border-primary/30 bg-elevated px-3 text-sm text-foreground outline-none focus:border-primary"
          placeholder="输入观点名称"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          onBlur={submitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submitDraft()
            }
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
          "mx-2 h-2 rounded-full border border-transparent transition",
          draggingId ? "opacity-100" : "opacity-0",
          active ? "border-primary/80 bg-primary/20" : "hover:border-primary/40",
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
            "group flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm transition-all duration-200",
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
            setDropTarget({
              type: "inside",
              targetId: node.id
            })
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void applyDrop({
              type: "inside",
              targetId: node.id
            })
          }}
        >
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
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
          {node.highlightCount > 0 && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-elevated text-muted">
              {node.highlightCount}
            </span>
          )}
        </button>
        {showDraftHere ? renderDraft(depth + 1) : null}
        {hasChildren && isExpanded ? node.children.map((child) => renderNode(child, depth + 1)) : null}
        {renderDropZone(depth, { type: "after", targetId: node.id })}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-base">
      <aside
        className="relative border-r border-border/60 bg-reader-sidebar"
        style={{ width: treeWidth }}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-border/60">
          <span className="text-sm font-semibold tracking-tight">观点树</span>
          <Button
            variant="ghost"
            onClick={() => openDraft(focusedParentId ?? undefined)}
            title={focusedParentId ? "在当前观点下新建子观点" : "在根目录新建观点"}
            className="h-8 w-8 p-0"
          >
            <FilePlus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-0.5 px-2 py-3">
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-secondary transition-all duration-200 hover:bg-overlay/70 hover:text-foreground",
              focusedParentId === null && "bg-elevated text-foreground"
            )}
            onClick={(event) => {
              event.stopPropagation()
              setFocusedParentId(null)
              setDraftNode(null)
            }}
          >
            <span className="h-4 w-4 flex items-center justify-center text-muted">#</span>
            根目录
          </button>
          {draftNode?.placement === "root" ? renderDraft(0) : null}
          {tree.map((node) => renderNode(node))}
          {draggingId ? (
            <div className="pt-2">
              {renderDropZone(0, { type: "root" }, "h-8 border-dashed")}
              <div className="px-3 text-[11px] text-muted">拖到这里，放到根目录最下方</div>
            </div>
          ) : null}
        </div>
        <div
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
          onMouseDown={createResizeHandler(treeWidth, setTreeWidth)}
        />
      </aside>

      <aside className="relative border-r border-border/60 bg-surface" style={{ width: listWidth }}>
        <div className="border-b border-border/60 px-4 py-4">
          <div className="text-sm font-medium text-foreground">{selected?.title ?? "未选择观点"}</div>
          <div className="mt-1 text-xs text-muted">Markdown 即时渲染</div>
        </div>
        <div className="p-4">
          <Card className="p-4 border-border/60">
            <div className="flex items-center gap-2 text-xs text-muted mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500/60" />
              待确认弱关联
            </div>
            <div className="space-y-2">
              {unconfirmed.length === 0 ? (
                <div className="text-xs text-muted py-2">暂无待确认划线</div>
              ) : (
                unconfirmed.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/60 bg-elevated/50 p-3 transition-colors hover:border-border">
                    <p className="text-sm text-foreground leading-relaxed">{item.content}</p>
                    <div className="mt-2 text-[11px] text-muted">
                      相似度 {(item.similarityScore ?? 0).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
        <div
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
          onMouseDown={createResizeHandler(listWidth, setListWidth)}
        />
      </aside>

      <main className="min-w-0 flex-1">
        <div className="flex h-14 items-center justify-between border-b border-border/60 px-8">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">
              {selected?.title ?? "知识文章"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={cn("gap-2", isPreviewMode && "bg-elevated text-foreground")}
            >
              {isPreviewMode ? (
                <>
                  <Edit3 className="h-4 w-4" />
                  编辑
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  预览
                </>
              )}
            </Button>
            <Button variant="ghost" className="gap-2">
              <Mail className="h-4 w-4" />
              发送邮件
            </Button>
          </div>
        </div>
        <div className="relative h-[calc(100vh-56px)] overflow-hidden">
          {isPreviewMode ? (
            <div className="h-full overflow-y-auto p-6">
              <div
                className="prose-lumina max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
              <div className="mt-8 flex flex-wrap gap-2">
                {selected?.relatedBookIds?.map((item) => (
                  <Badge key={item}>{item.slice(0, 8)}</Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative h-full p-6">
              <div className="absolute inset-0 overflow-y-auto">
                <div className="relative min-h-full font-mono text-sm leading-7">
                  {/* 即时行内预览层 */}
                  <div
                    ref={previewRef}
                    className="pointer-events-none absolute text-transparent"
                    aria-hidden="true"
                  >
                    <span>{article.slice(0, 0)}</span>
                    {/* 占位符保持行高 */}
                  </div>

                  {/* 编辑区域 */}
                  <textarea
                    ref={textareaRef}
                    className="absolute inset-0 h-full w-full resize-none border-none bg-transparent px-0 py-0 font-mono text-sm leading-7 text-transparent caret-foreground"
                    value={article}
                    onChange={(event) => setArticle(event.target.value)}
                    onSelect={debouncedUpdateCursor}
                    onKeyUp={debouncedUpdateCursor}
                    onClick={debouncedUpdateCursor}
                    spellCheck={false}
                  />

                  {/* 渲染层（显示背景 Markdown 效果） */}
                  <div
                    className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap font-mono text-sm leading-7 text-muted/30"
                    aria-hidden="true"
                  >
                    {article.split("\n").map((line, idx) => (
                      <div
                        key={idx}
                        className="min-h-[28px]"
                        dangerouslySetInnerHTML={{
                          __html: marked.parse(line || " ") as string
                        }}
                      />
                    ))}
                  </div>

                  {/* 即时行预览浮动层 - 在光标位置显示当前行的 Markdown 渲染 */}
                  {cursorPosition && currentLine.trim() && (
                    <div
                      className="pointer-events-none absolute z-10 rounded-md border border-border/50 bg-elevated/95 p-2 shadow-lg backdrop-blur-sm"
                      style={{
                        top: `${cursorPosition.top + 24}px`,
                        left: `${cursorPosition.left}px`,
                        maxWidth: "400px"
                      }}
                    >
                      <div
                        className="prose-lumina prose-lumina-sm max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: inlinePreviewHtml }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
