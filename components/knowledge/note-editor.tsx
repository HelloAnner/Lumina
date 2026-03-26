/**
 * 知识库笔记编辑器
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
"use client"

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { EditorContent, useEditor } from "@tiptap/react"
import { common, createLowlight } from "lowlight"
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  GripVertical,
  Highlighter,
  Link2,
  Plus,
  Trash2
} from "lucide-react"
import { ContextMenu } from "@/components/ui/context-menu"
import {
  findNoteEditorCommand,
  type NoteEditorCommand
} from "@/components/knowledge/note-editor-commands"
import { NoteEditorCommandMenu } from "@/components/knowledge/note-editor-command-menu"
import {
  BlockIdExtension,
  HighlightBlock,
  InlineHighlightMark,
  ImportedBlock,
  InsightBlock,
  LuminaCodeBlock,
  QuoteBlock
} from "@/components/knowledge/note-editor-nodes"
import {
  DEFAULT_NOTE_EDITOR_SHORTCUTS,
  detectShortcutPlatform,
  formatShortcutForDisplay,
  getEffectiveKeyboardShortcuts,
  matchesShortcut
} from "@/src/lib/keyboard-shortcuts"
import {
  blocksToTipTapDoc,
  normalizeBlockOrder,
  tipTapDocToBlocks
} from "@/components/knowledge/note-editor-doc"
import {
  buildHeadingOutlineItems,
  resolveActiveHeadingId,
  type HeadingOutlineItem
} from "@/components/knowledge/note-outline-utils"
import { cn } from "@/src/lib/utils"
import type {
  AppKeyboardShortcuts,
  NoteBlock
} from "@/src/server/store/types"

const lowlight = createLowlight(common)

type SaveStatus = "idle" | "saving" | "saved"
type SlashMode = "replace" | "insert-after" | "turn-into"

type AnchorRect = {
  top: number
  left: number
  bottom: number
}

type FloatingMenuState = {
  blockId: string
  query: string
  mode: SlashMode
  anchorRect: AnchorRect
}

type GutterState = {
  blockId: string
  top: number
}

type DragState = {
  draggingId: string
  targetId: string
  placement: "before" | "after"
  top: number
}

type LinkMenuState = {
  href: string
  rect: AnchorRect
  mode: "preview" | "edit"
}

interface NoteEditorProps {
  viewpointId: string
  blocks: NoteBlock[]
  annotatedBlockIds: Set<string>
  keyboardShortcuts?: AppKeyboardShortcuts
  selectedBlockId?: string
  scrollContainerRef?: React.RefObject<HTMLDivElement>
  outlineCollapsed?: boolean
  onBlocksChange: (blocks: NoteBlock[]) => void
  onSelectText?: (blockId: string, text: string) => void
  onBlockClick?: (blockId: string) => void
  onOutlineCollapsedChange?: (collapsed: boolean) => void
  onActiveHeadingChange?: (headingId?: string) => void
  onSaveStatusChange: (status: SaveStatus) => void
}

/**
 * TipTap 笔记编辑器主体
 */
export function NoteEditor({
  viewpointId,
  blocks,
  annotatedBlockIds,
  keyboardShortcuts,
  selectedBlockId,
  scrollContainerRef,
  outlineCollapsed = false,
  onBlocksChange,
  onSelectText,
  onBlockClick,
  onOutlineCollapsedChange,
  onActiveHeadingChange,
  onSaveStatusChange
}: NoteEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAppliedRef = useRef("")
  const pendingFocusRef = useRef<string | null>(null)
  const hoveredElementRef = useRef<HTMLElement | null>(null)
  const [gutter, setGutter] = useState<GutterState | null>(null)
  const [slashMenu, setSlashMenu] = useState<FloatingMenuState | null>(null)
  const [bubbleRect, setBubbleRect] = useState<AnchorRect | null>(null)
  const [blockMenu, setBlockMenu] = useState<{ blockId: string; x: number; y: number } | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [linkMenu, setLinkMenu] = useState<LinkMenuState | null>(null)
  const [linkDraft, setLinkDraft] = useState("")
  const [activeOutlineBlockId, setActiveOutlineBlockId] = useState<string>()
  const shortcutPlatform = useMemo(() => detectShortcutPlatform(), [])
  const noteEditorShortcuts = useMemo(
    () => getEffectiveKeyboardShortcuts(keyboardShortcuts).noteEditor,
    [keyboardShortcuts]
  )

  const editor = useEditor({
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        codeBlock: false,
        history: {
          depth: 200,
          newGroupDelay: 500
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank"
        }
      }),
      Placeholder.configure({
        showOnlyCurrent: true,
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            const level = Number(node.attrs.level ?? 2)
            return `标题 ${Math.min(3, Math.max(1, level))}`
          }
          if (node.type.name === "codeBlock") {
            return "输入代码"
          }
          return "输入文字，或输入 / 选择块类型"
        }
      }),
      QuoteBlock,
      HighlightBlock,
      InlineHighlightMark,
      InsightBlock,
      ImportedBlock,
      LuminaCodeBlock.configure({ lowlight }),
      BlockIdExtension
    ],
    content: blocksToTipTapDoc(normalizeBlockOrder(blocks)),
    editorProps: {
      attributes: {
        class: "lumina-note-editor tiptap-editor outline-none"
      }
    },
    onCreate: ({ editor: instance }) => {
      lastAppliedRef.current = serializeBlocks(tipTapDocToBlocks(instance.getJSON()))
    },
    onUpdate: ({ editor: instance }) => {
      const nextBlocks = normalizeBlockOrder(tipTapDocToBlocks(instance.getJSON()))
      lastAppliedRef.current = serializeBlocks(nextBlocks)
      onBlocksChange(nextBlocks)
      scheduleSave(viewpointId, nextBlocks, onSaveStatusChange, saveTimerRef, savedTimerRef)
      syncSlashMenu(instance, setSlashMenu)
    },
    onSelectionUpdate: ({ editor: instance }) => {
      handleSelectionChange(instance, setBubbleRect, setLinkMenu)
      syncSlashMenu(instance, setSlashMenu)
    }
  })

  const currentBlocks = useMemo(
    () => normalizeBlockOrder(blocks),
    [blocks]
  )
  const outlineItems = useMemo(
    () => buildHeadingOutlineItems(currentBlocks),
    [currentBlocks]
  )

  const applyBlocks = useCallback((nextBlocks: NoteBlock[], focusBlockId?: string) => {
    if (!editor) {
      return
    }
    const normalized = normalizeBlockOrder(nextBlocks)
    pendingFocusRef.current = focusBlockId ?? null
    editor.commands.setContent(blocksToTipTapDoc(normalized), true)
  }, [editor])

  const applyCommand = useCallback((command: NoteEditorCommand, mode: SlashMode, blockId: string) => {
    if (!editor) {
      return
    }
    const sourceBlocks = normalizeBlockOrder(tipTapDocToBlocks(editor.getJSON()))
    const nextBlocks = mode === "insert-after"
      ? insertBlockAfter(sourceBlocks, blockId, command)
      : transformExistingBlock(sourceBlocks, blockId, command)
    const focusId = mode === "insert-after" ? nextBlocks.find((block) => block.id !== blockId && !sourceBlocks.some((item) => item.id === block.id))?.id : blockId
    applyBlocks(nextBlocks, focusId)
    setSlashMenu(null)
    setBlockMenu(null)
  }, [applyBlocks, editor])

  useEffect(() => {
    if (!editor) {
      return
    }
    const normalized = normalizeBlockOrder(blocks)
    const serialized = serializeBlocks(normalized)
    if (serialized === lastAppliedRef.current) {
      return
    }
    lastAppliedRef.current = serialized
    editor.commands.setContent(blocksToTipTapDoc(normalized), false)
  }, [blocks, editor, viewpointId])

  useEffect(() => {
    if (!editor || !pendingFocusRef.current) {
      return
    }
    const focusBlockId = pendingFocusRef.current
    pendingFocusRef.current = null
    requestAnimationFrame(() =>
      focusBlock(
        editor,
        focusBlockId,
        resolveScrollContainer(scrollContainerRef, scrollRef)
      )
    )
  }, [blocks, editor, scrollContainerRef])

  useEffect(() => {
    if (!editor) {
      return
    }
    syncBlockClasses(editor, annotatedBlockIds, selectedBlockId)
  }, [annotatedBlockIds, editor, selectedBlockId, blocks])

  useEffect(() => {
    if (!editor) {
      return
    }
    const dom = editor.view.dom
    const handleClick = (event: MouseEvent) => {
      const block = findBlockElement(event.target, dom)
      if (block) {
        onBlockClick?.(block.dataset.blockId ?? "")
      }
    }
    dom.addEventListener("click", handleClick)
    return () => dom.removeEventListener("click", handleClick)
  }, [editor, onBlockClick])

  useEffect(() => {
    const container = resolveScrollContainer(scrollContainerRef, scrollRef)
    if (!editor || !container) {
      return
    }
    const updateHover = (target: EventTarget | null) => {
      const block = findBlockElement(target, editor.view.dom)
      hoveredElementRef.current = block
      setGutter(block ? buildGutterState(block, container) : null)
    }
    const handleMouseMove = (event: MouseEvent) => updateHover(event.target)
    const handleMouseLeave = () => {
      hoveredElementRef.current = null
      setGutter(null)
    }
    const handleScroll = () => {
      if (hoveredElementRef.current) {
        setGutter(buildGutterState(hoveredElementRef.current, container))
      }
    }
    container.addEventListener("mousemove", handleMouseMove)
    container.addEventListener("mouseleave", handleMouseLeave)
    container.addEventListener("scroll", handleScroll)
    return () => {
      container.removeEventListener("mousemove", handleMouseMove)
      container.removeEventListener("mouseleave", handleMouseLeave)
      container.removeEventListener("scroll", handleScroll)
    }
  }, [editor, scrollContainerRef])

  useEffect(() => {
    const container = resolveScrollContainer(scrollContainerRef, scrollRef)
    if (!editor || !container) {
      return
    }
    const syncActiveHeading = () => {
      const next = resolveActiveHeadingId(
        measureHeadingPositions(editor, outlineItems, container),
        container.scrollTop
      )
      setActiveOutlineBlockId(next)
    }
    syncActiveHeading()
    container.addEventListener("scroll", syncActiveHeading, { passive: true })
    window.addEventListener("resize", syncActiveHeading)
    return () => {
      container.removeEventListener("scroll", syncActiveHeading)
      window.removeEventListener("resize", syncActiveHeading)
    }
  }, [editor, outlineItems, scrollContainerRef, blocks])

  useEffect(() => {
    onActiveHeadingChange?.(activeOutlineBlockId)
  }, [activeOutlineBlockId, onActiveHeadingChange])

  useEffect(() => {
    if (!editor) {
      return
    }
    const dom = editor.view.dom
    const handleKeyDown = (event: KeyboardEvent) => {
      if (handleEditorShortcuts(event, editor, currentBlocks, applyBlocks, setLinkMenu, setLinkDraft, noteEditorShortcuts, onSelectText)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    dom.addEventListener("keydown", handleKeyDown, true)
    return () => dom.removeEventListener("keydown", handleKeyDown, true)
  }, [applyBlocks, currentBlocks, editor, noteEditorShortcuts, onSelectText])

  if (!editor) {
    return null
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        "relative min-h-0 flex-1",
        !scrollContainerRef && "overflow-y-auto"
      )}
      onDragOver={(event) =>
        handleDragOver(
          event,
          editor,
          resolveScrollContainer(scrollContainerRef, scrollRef),
          setDragState
        )
      }
      onDrop={() => applyDrag(editor, dragState, applyBlocks, setDragState)}
      onDragEnd={() => setDragState(null)}
    >
      <div
        className={cn(
          "note-editor-layout mx-auto max-w-[1120px] px-8 py-8",
          outlineCollapsed && "is-outline-collapsed"
        )}
      >
        <div ref={rootRef} className="note-editor-shell note-editor-main">
          <EditorContent editor={editor} />
          {gutter ? (
            <BlockGutter
              top={gutter.top}
              onOpenInsert={() => setSlashMenu(createInsertMenuState(gutter.blockId, hoveredElementRef.current))}
              onOpenMenu={(x, y) => setBlockMenu({ blockId: gutter.blockId, x, y })}
              onDragStart={(event) => startDragging(event, gutter.blockId)}
            />
          ) : null}
          {dragState ? <DropIndicator top={dragState.top} /> : null}
        </div>
        <aside
          className={cn(
            "note-outline-panel",
            outlineCollapsed && "is-collapsed"
          )}
        >
          <button
            className="note-outline-toggle"
            onClick={() => onOutlineCollapsedChange?.(!outlineCollapsed)}
          >
            {outlineCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
            <span>{outlineCollapsed ? "展开目录" : "收起目录"}</span>
          </button>
          {!outlineCollapsed ? (
            <div className="note-outline-card">
              <div className="note-outline-head">
                <span>目录</span>
                <span>{outlineItems.length} 节</span>
              </div>
              <div className="note-outline-list">
                {outlineItems.map((item) => (
                  <button
                    key={item.blockId}
                    className={cn(
                      "note-outline-item",
                      item.blockId === activeOutlineBlockId && "is-active"
                    )}
                    style={{ paddingLeft: `${12 + item.depth * 14}px` }}
                    onClick={() =>
                      focusBlock(
                        editor,
                        item.blockId,
                        resolveScrollContainer(scrollContainerRef, scrollRef)
                      )
                    }
                  >
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
                {outlineItems.length === 0 ? (
                  <div className="note-outline-empty">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>添加标题后会在这里生成目录</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      {bubbleRect ? (
        <BubbleToolbar
          editor={editor}
          anchorRect={bubbleRect}
          shortcutPlatform={shortcutPlatform}
          shortcuts={noteEditorShortcuts}
          onAnnotate={() => triggerSelectionAnnotation(editor, onSelectText)}
          onLinkEdit={() => openLinkEditor(editor, setLinkMenu, setLinkDraft)}
          onTurnInto={(x, y) => {
            const blockId = getCurrentBlockId(editor)
            if (blockId) {
              setSlashMenu({
                blockId,
                query: "",
                mode: "turn-into",
                anchorRect: { top: y, left: x, bottom: y + 8 }
              })
            }
          }}
        />
      ) : null}

      {slashMenu ? (
        <NoteEditorCommandMenu
          query={slashMenu.query}
          anchorRect={slashMenu.anchorRect}
          onSelect={(commandKey) => {
            const command = findNoteEditorCommand(commandKey)
            if (command) {
              applyCommand(command, slashMenu.mode, slashMenu.blockId)
            }
          }}
          onClose={() => setSlashMenu(null)}
        />
      ) : null}

      {blockMenu ? (
        <ContextMenu
          position={{ x: blockMenu.x, y: blockMenu.y }}
          onClose={() => setBlockMenu(null)}
          items={[
            {
              label: "Turn into",
              icon: <ChevronRight className="h-3.5 w-3.5" />,
              onClick: () => {
                setSlashMenu({
                  blockId: blockMenu.blockId,
                  query: "",
                  mode: "turn-into",
                  anchorRect: { top: blockMenu.y, left: blockMenu.x + 180, bottom: blockMenu.y + 8 }
                })
              }
            },
            { type: "divider" },
            {
              label: "复制块",
              shortcut: formatShortcutForDisplay(
                noteEditorShortcuts.duplicateBlock,
                shortcutPlatform
              ),
              icon: <Copy className="h-3.5 w-3.5" />,
              onClick: () => applyBlocks(duplicateBlock(currentBlocks, blockMenu.blockId))
            },
            {
              label: "删除",
              shortcut: "⌫",
              icon: <Trash2 className="h-3.5 w-3.5" />,
              destructive: true,
              onClick: () => applyBlocks(deleteBlock(currentBlocks, blockMenu.blockId))
            }
          ]}
        />
      ) : null}

      {linkMenu ? (
        <LinkPopover
          editor={editor}
          draft={linkDraft}
          menu={linkMenu}
          onDraftChange={setLinkDraft}
          onOpenEdit={() => setLinkMenu({ ...linkMenu, mode: "edit" })}
          onClose={() => setLinkMenu(null)}
        />
      ) : null}
    </div>
  )
}

function BubbleToolbar({
  editor,
  anchorRect,
  shortcutPlatform,
  shortcuts,
  onAnnotate,
  onLinkEdit,
  onTurnInto
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>
  anchorRect: AnchorRect
  shortcutPlatform: "mac" | "windows"
  shortcuts: AppKeyboardShortcuts["noteEditor"]
  onAnnotate: () => void
  onLinkEdit: () => void
  onTurnInto: (x: number, y: number) => void
}) {
  const style = {
    left: anchorRect.left,
    top: anchorRect.top - 48
  }
  return (
    <div className="note-bubble-menu" style={style}>
      <ToolbarButton
        active={editor.isActive("bold")}
        hint={`加粗 ${formatShortcutForDisplay(shortcuts.bold, shortcutPlatform)}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        hint={`斜体 ${formatShortcutForDisplay(shortcuts.italic, shortcutPlatform)}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("highlight")}
        hint={`高亮 ${formatShortcutForDisplay(shortcuts.highlight, shortcutPlatform)}`}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        hint={`删除线 ${formatShortcutForDisplay(shortcuts.strike, shortcutPlatform)}`}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        S
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("code")}
        hint={`行内代码 ${formatShortcutForDisplay(shortcuts.code, shortcutPlatform)}`}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        &lt;&gt;
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("link")}
        hint={`链接 ${formatShortcutForDisplay(shortcuts.link, shortcutPlatform)}`}
        onClick={onLinkEdit}
      >
        <Link2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <span className="separator" />
      <button
        className="note-bubble-action"
        title={`批注 ${formatShortcutForDisplay(shortcuts.annotate, shortcutPlatform)}`}
        onClick={onAnnotate}
      >
        批注 {formatShortcutForDisplay(shortcuts.annotate, shortcutPlatform)}
      </button>
      <button
        className="note-bubble-action"
        title="转换块类型"
        onClick={() => onTurnInto(anchorRect.left + 112, anchorRect.top - 4)}
      >
        Turn into
      </button>
    </div>
  )
}

function ToolbarButton({
  active,
  hint,
  children,
  onClick
}: {
  active?: boolean
  hint?: string
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      className={cn("note-bubble-button", active && "is-active")}
      title={hint}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function BlockGutter({
  top,
  onOpenInsert,
  onOpenMenu,
  onDragStart
}: {
  top: number
  onOpenInsert: () => void
  onOpenMenu: (x: number, y: number) => void
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void
}) {
  return (
    <div className="note-block-gutter" style={{ top }}>
      <button className="gutter-button" onMouseDown={preventFocusLoss} onClick={onOpenInsert}>
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        draggable
        className="gutter-button"
        onMouseDown={preventFocusLoss}
        onClick={(event) => onOpenMenu(event.clientX, event.clientY)}
        onDragStart={onDragStart}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function DropIndicator({ top }: { top: number }) {
  return <div className="drop-indicator" style={{ top }} />
}

function LinkPopover({
  editor,
  draft,
  menu,
  onDraftChange,
  onOpenEdit,
  onClose
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>
  draft: string
  menu: LinkMenuState
  onDraftChange: (value: string) => void
  onOpenEdit: () => void
  onClose: () => void
}) {
  if (menu.mode === "preview") {
    return (
      <div className="note-link-popover" style={{ left: menu.rect.left, top: menu.rect.bottom + 8 }}>
        <button className="note-link-button" onClick={() => window.open(menu.href, "_blank", "noopener,noreferrer")}>
          <ExternalLink className="h-3.5 w-3.5" />
          {menu.href}
        </button>
        <button className="note-link-icon" onClick={() => { onDraftChange(menu.href); onOpenEdit() }}>
          编辑
        </button>
        <button className="note-link-icon" onClick={() => { editor.chain().focus().unsetLink().run(); onClose() }}>
          移除
        </button>
      </div>
    )
  }
  return (
    <div className="note-link-editor" style={{ left: menu.rect.left, top: menu.rect.bottom + 8 }}>
      <p className="mb-2 text-[12px] text-secondary">粘贴链接或输入 URL</p>
      <input
        autoFocus
        value={draft}
        className="note-link-input"
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            editor.chain().focus().extendMarkRange("link").setLink({ href: draft }).run()
            onClose()
          }
          if (event.key === "Escape") {
            onClose()
          }
        }}
      />
    </div>
  )
}

function scheduleSave(
  viewpointId: string,
  blocks: NoteBlock[],
  onSaveStatusChange: (status: SaveStatus) => void,
  saveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  savedTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
) {
  if (saveTimerRef.current) {
    clearTimeout(saveTimerRef.current)
  }
  onSaveStatusChange("idle")
  saveTimerRef.current = setTimeout(async () => {
    try {
      onSaveStatusChange("saving")
      await fetch(`/api/viewpoints/${viewpointId}/blocks`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blocks })
      })
      onSaveStatusChange("saved")
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current)
      }
      savedTimerRef.current = setTimeout(() => onSaveStatusChange("idle"), 1800)
    } catch {
      onSaveStatusChange("idle")
    }
  }, 800)
}

function handleSelectionChange(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  setBubbleRect: (rect: AnchorRect | null) => void,
  setLinkMenu: (menu: LinkMenuState | null) => void
) {
  const { from, to, empty } = editor.state.selection
  if (!empty) {
    const rect = createSelectionRect(editor, from, to)
    setBubbleRect(rect)
    setLinkMenu(null)
    return
  }
  setBubbleRect(null)
  const href = editor.getAttributes("link").href as string | undefined
  setLinkMenu(href ? { href, rect: createSelectionRect(editor, from, to), mode: "preview" } : null)
}

function syncSlashMenu(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  setSlashMenu: Dispatch<SetStateAction<FloatingMenuState | null>>
) {
  const currentBlockId = getCurrentBlockId(editor)
  const currentBlock = currentBlockId
    ? normalizeBlockOrder(tipTapDocToBlocks(editor.getJSON())).find((block) => block.id === currentBlockId)
    : null
  if (!currentBlock || !("text" in currentBlock) || !currentBlock.text.startsWith("/")) {
    setSlashMenu((value) => value?.mode === "replace" ? null : value)
    return
  }
  const { from } = editor.state.selection
  setSlashMenu({
    blockId: currentBlock.id,
    query: currentBlock.text.slice(1),
    mode: "replace",
    anchorRect: createSelectionRect(editor, from, from)
  })
}

function handleEditorShortcuts(
  event: KeyboardEvent,
  editor: NonNullable<ReturnType<typeof useEditor>>,
  blocks: NoteBlock[],
  applyBlocks: (blocks: NoteBlock[], focusBlockId?: string) => void,
  setLinkMenu: (menu: LinkMenuState | null) => void,
  setLinkDraft: (value: string) => void,
  bindings: AppKeyboardShortcuts["noteEditor"] = DEFAULT_NOTE_EDITOR_SHORTCUTS,
  onSelectText?: (blockId: string, text: string) => void
) {
  if (event.key === "Escape" && !editor.state.selection.empty) {
    collapseSelection(editor)
    return true
  }
  if (matchesShortcut(event, bindings.bold)) {
    editor.chain().focus().toggleBold().run()
    return true
  }
  if (matchesShortcut(event, bindings.italic)) {
    editor.chain().focus().toggleItalic().run()
    return true
  }
  if (matchesShortcut(event, bindings.highlight)) {
    editor.chain().focus().toggleHighlight().run()
    return true
  }
  if (matchesShortcut(event, bindings.strike)) {
    editor.chain().focus().toggleStrike().run()
    return true
  }
  if (matchesShortcut(event, bindings.code)) {
    editor.chain().focus().toggleCode().run()
    return true
  }
  if (matchesShortcut(event, bindings.annotate)) {
    return triggerSelectionAnnotation(editor, onSelectText)
  }
  if (matchesShortcut(event, bindings.link)) {
    openLinkEditor(editor, setLinkMenu, setLinkDraft)
    return true
  }
  if (matchesShortcut(event, bindings.duplicateBlock)) {
    const blockId = getCurrentBlockId(editor)
    if (blockId) {
      applyBlocks(duplicateBlock(blocks, blockId))
      return true
    }
  }
  if (matchesShortcut(event, bindings.moveBlockUp) || matchesShortcut(event, bindings.moveBlockDown)) {
    const blockId = getCurrentBlockId(editor)
    if (blockId) {
      applyBlocks(
        moveBlockByOffset(
          blocks,
          blockId,
          matchesShortcut(event, bindings.moveBlockUp) ? -1 : 1
        ),
        blockId
      )
      return true
    }
  }
  const commandKey = resolveShortcutCommandKey(event, bindings)
  if (commandKey) {
    const command = commandKey ? findNoteEditorCommand(commandKey) : undefined
    const blockId = getCurrentBlockId(editor)
    if (command && blockId) {
      applyBlocks(transformExistingBlock(blocks, blockId, command), blockId)
      return true
    }
  }
  return handleBlockBoundaryKeys(event, editor, blocks, applyBlocks)
}

function triggerSelectionAnnotation(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  onSelectText?: (blockId: string, text: string) => void
) {
  const { from, to, empty } = editor.state.selection
  if (empty) {
    return false
  }
  const blockId = getCurrentBlockId(editor)
  const text = editor.state.doc.textBetween(from, to).trim()
  if (!blockId || !text) {
    return false
  }
  onSelectText?.(blockId, text)
  return true
}

function collapseSelection(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const { to, empty } = editor.state.selection
  if (empty) {
    return
  }
  editor.chain().focus().setTextSelection(to).run()
}

function handleBlockBoundaryKeys(
  event: KeyboardEvent,
  editor: NonNullable<ReturnType<typeof useEditor>>,
  blocks: NoteBlock[],
  applyBlocks: (blocks: NoteBlock[], focusBlockId?: string) => void
) {
  const blockId = getCurrentBlockId(editor)
  if (!blockId) {
    return false
  }
  const block = blocks.find((item) => item.id === blockId)
  if (!block) {
    return false
  }
  if (shouldExitBlockOnEnter(event, editor, block)) {
    const paragraph = createEmptyParagraph(blocks.length + 1)
    applyBlocks(insertAfterBlockId(blocks, blockId, paragraph), paragraph.id)
    return true
  }
  if (shouldDowngradeOnBackspace(event, editor, block)) {
    const paragraph = findNoteEditorCommand("paragraph")
    if (paragraph) {
      applyBlocks(transformExistingBlock(blocks, blockId, paragraph), blockId)
      return true
    }
  }
  return false
}

function shouldExitBlockOnEnter(event: KeyboardEvent, editor: NonNullable<ReturnType<typeof useEditor>>, block: NoteBlock) {
  if (event.key !== "Enter") {
    return false
  }
  const selection = editor.state.selection
  const atEnd = selection.$from.parentOffset === selection.$from.parent.content.size
  if (!selection.empty || !atEnd) {
    return false
  }
  if (block.type === "heading" || block.type === "quote" || block.type === "highlight" || block.type === "insight") {
    return !event.shiftKey
  }
  if (block.type === "code") {
    return event.shiftKey || isMeta(event)
  }
  return false
}

function shouldDowngradeOnBackspace(event: KeyboardEvent, editor: NonNullable<ReturnType<typeof useEditor>>, block: NoteBlock) {
  if (event.key !== "Backspace" || !editor.state.selection.empty) {
    return false
  }
  const atStart = editor.state.selection.$from.parentOffset === 0
  if (!atStart) {
    return false
  }
  return block.type === "heading" || block.type === "quote" || block.type === "highlight" || block.type === "insight" || block.type === "code"
}

function insertBlockAfter(blocks: NoteBlock[], blockId: string, command: NoteEditorCommand) {
  const created = command.createBlock(crypto.randomUUID(), blocks.length + 1)
  return insertAfterBlockId(blocks, blockId, created)
}

function insertAfterBlockId(blocks: NoteBlock[], blockId: string, created: NoteBlock) {
  const index = blocks.findIndex((block) => block.id === blockId)
  const next = [...blocks]
  next.splice(index + 1, 0, created)
  return normalizeBlockOrder(next)
}

function transformExistingBlock(blocks: NoteBlock[], blockId: string, command: NoteEditorCommand) {
  return normalizeBlockOrder(blocks.map((block) => block.id === blockId ? command.transformBlock(block) : block))
}

function duplicateBlock(blocks: NoteBlock[], blockId: string) {
  const index = blocks.findIndex((block) => block.id === blockId)
  if (index < 0) {
    return blocks
  }
  const duplicated = structuredClone(blocks[index])
  duplicated.id = crypto.randomUUID()
  const next = [...blocks]
  next.splice(index + 1, 0, duplicated)
  return normalizeBlockOrder(next)
}

function deleteBlock(blocks: NoteBlock[], blockId: string) {
  const next = blocks.filter((block) => block.id !== blockId)
  return next.length > 0 ? normalizeBlockOrder(next) : [createEmptyParagraph(0)]
}

function moveBlockByOffset(blocks: NoteBlock[], blockId: string, offset: number) {
  const index = blocks.findIndex((block) => block.id === blockId)
  const target = index + offset
  if (index < 0 || target < 0 || target >= blocks.length) {
    return blocks
  }
  const next = [...blocks]
  const [block] = next.splice(index, 1)
  next.splice(target, 0, block)
  return normalizeBlockOrder(next)
}

function createEmptyParagraph(sortOrder: number): NoteBlock {
  return {
    id: crypto.randomUUID(),
    type: "paragraph",
    text: "",
    sortOrder
  }
}

function buildGutterState(block: HTMLElement, container: HTMLElement): GutterState {
  const rect = block.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return {
    blockId: block.dataset.blockId ?? "",
    top: rect.top - containerRect.top + container.scrollTop
  }
}

function createInsertMenuState(blockId: string, block: HTMLElement | null): FloatingMenuState {
  const rect = block?.getBoundingClientRect()
  return {
    blockId,
    query: "",
    mode: "insert-after",
    anchorRect: {
      top: rect?.top ?? 0,
      left: rect?.left ?? 0,
      bottom: (rect?.top ?? 0) + 24
    }
  }
}

function createSelectionRect(editor: NonNullable<ReturnType<typeof useEditor>>, from: number, to: number): AnchorRect {
  const start = editor.view.coordsAtPos(from)
  const end = editor.view.coordsAtPos(Math.max(from, to))
  return {
    top: Math.min(start.top, end.top),
    left: (start.left + end.right) / 2,
    bottom: Math.max(start.bottom, end.bottom)
  }
}

function getCurrentBlockId(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.attrs.blockId) {
      return String(node.attrs.blockId)
    }
  }
  return null
}

function openLinkEditor(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  setLinkMenu: (menu: LinkMenuState) => void,
  setLinkDraft: (value: string) => void
) {
  const { from, to } = editor.state.selection
  const href = String(editor.getAttributes("link").href ?? "")
  setLinkDraft(href)
  setLinkMenu({
    href,
    rect: createSelectionRect(editor, from, to),
    mode: "edit"
  })
}

function focusBlock(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  blockId: string,
  container?: HTMLDivElement | null
) {
  const target = editor.view.dom.querySelector(
    `[data-block-id="${blockId}"]`
  ) as HTMLElement | null
  if (!target) {
    editor.commands.focus("end")
    return
  }
  scrollBlockIntoView(target, container)
  const textTarget = target.querySelector("[contenteditable=true]") as HTMLElement | null
  const focusTarget = textTarget ?? target
  focusTarget.focus()
  const selection = window.getSelection()
  if (selection) {
    selection.selectAllChildren(focusTarget)
    selection.collapseToEnd()
  }
}

function scrollBlockIntoView(
  target: HTMLElement,
  container?: HTMLDivElement | null
) {
  if (!container) {
    target.scrollIntoView({ block: "start", behavior: "smooth" })
    return
  }
  const targetRect = target.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const top =
    targetRect.top - containerRect.top + container.scrollTop - 72
  container.scrollTo({
    top: Math.max(0, top),
    behavior: "smooth"
  })
}

function findBlockElement(target: EventTarget | null, root: HTMLElement) {
  if (!(target instanceof HTMLElement)) {
    return null
  }
  const block = target.closest("[data-block-id]") as HTMLElement | null
  return block && root.contains(block) ? block : null
}

function startDragging(event: React.DragEvent<HTMLButtonElement>, blockId: string) {
  event.dataTransfer.effectAllowed = "move"
  event.dataTransfer.setData("text/plain", blockId)
}

function handleDragOver(
  event: React.DragEvent<HTMLDivElement>,
  editor: NonNullable<ReturnType<typeof useEditor>>,
  container: HTMLDivElement | null,
  setDragState: (state: DragState | null) => void
) {
  const draggingId = event.dataTransfer.getData("text/plain")
  if (!draggingId || !container) {
    return
  }
  const block = findBlockElement(event.target, editor.view.dom)
  if (!block || block.dataset.blockId === draggingId) {
    return
  }
  event.preventDefault()
  const rect = block.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const placement = event.clientY < rect.top + rect.height / 2 ? "before" : "after"
  const top = (placement === "before" ? rect.top : rect.bottom) - containerRect.top + container.scrollTop
  setDragState({
    draggingId,
    targetId: block.dataset.blockId ?? "",
    placement,
    top
  })
}

function applyDrag(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  dragState: DragState | null,
  applyBlocks: (blocks: NoteBlock[]) => void,
  setDragState: (state: DragState | null) => void
) {
  if (!dragState) {
    return
  }
  const blocks = normalizeBlockOrder(tipTapDocToBlocks(editor.getJSON()))
  const sourceIndex = blocks.findIndex((block) => block.id === dragState.draggingId)
  const targetIndex = blocks.findIndex((block) => block.id === dragState.targetId)
  if (sourceIndex < 0 || targetIndex < 0) {
    setDragState(null)
    return
  }
  const next = [...blocks]
  const [dragging] = next.splice(sourceIndex, 1)
  const insertIndex = dragState.placement === "before"
    ? next.findIndex((block) => block.id === dragState.targetId)
    : next.findIndex((block) => block.id === dragState.targetId) + 1
  next.splice(insertIndex, 0, dragging)
  applyBlocks(normalizeBlockOrder(next))
  setDragState(null)
}

function syncBlockClasses(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  annotatedBlockIds: Set<string>,
  selectedBlockId?: string
) {
  const nodes = editor.view.dom.querySelectorAll("[data-block-id]")
  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return
    }
    const blockId = node.dataset.blockId ?? ""
    node.classList.toggle("note-block-annotated", annotatedBlockIds.has(blockId))
    node.classList.toggle("note-block-selected", blockId === selectedBlockId)
  })
}

function serializeBlocks(blocks: NoteBlock[]) {
  return JSON.stringify(blocks)
}

function resolveScrollContainer(
  scrollContainerRef: React.RefObject<HTMLDivElement> | undefined,
  localScrollRef: React.RefObject<HTMLDivElement>
) {
  return scrollContainerRef?.current ?? localScrollRef.current
}

function measureHeadingPositions(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  outlineItems: HeadingOutlineItem[],
  container: HTMLDivElement
) {
  return outlineItems
    .map((item) => {
      const node = editor.view.dom.querySelector(
        `[data-block-id="${item.blockId}"]`
      ) as HTMLElement | null
      if (!node) {
        return null
      }
      const rect = node.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      return {
        blockId: item.blockId,
        top: rect.top - containerRect.top + container.scrollTop
      }
    })
    .filter(Boolean) as Array<{ blockId: string; top: number }>
}

function preventFocusLoss(event: React.MouseEvent) {
  event.preventDefault()
}

function isMeta(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey
}

function resolveShortcutCommandKey(
  event: KeyboardEvent,
  bindings: AppKeyboardShortcuts["noteEditor"]
) {
  if (matchesShortcut(event, bindings.heading1)) {
    return "heading-1"
  }
  if (matchesShortcut(event, bindings.heading2)) {
    return "heading-2"
  }
  if (matchesShortcut(event, bindings.heading3)) {
    return "heading-3"
  }
  if (matchesShortcut(event, bindings.paragraph)) {
    return "paragraph"
  }
  return undefined
}
