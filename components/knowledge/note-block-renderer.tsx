/**
 * 笔记块渲染器
 * Notion 风格连续编辑：Enter 新建段落，Backspace 删除空块，/ 实时过滤命令菜单
 * 使用 uncontrolled 模式避免 React 重渲染导致光标跳动
 *
 * @author Anner
 * @since 0.2.0
 * Created on 2026/3/24
 */
"use client"

import { memo, useCallback, useEffect, useRef, useState } from "react"
import {
  BookOpen,
  ExternalLink,
  Highlighter,
  Lightbulb,
  Quote,
  X
} from "lucide-react"
import { ImportedBlockItem } from "@/components/import/imported-note-blocks"
import { SlashCommandMenu } from "./slash-command-menu"
import { cn } from "@/src/lib/utils"
import type { NoteBlock, NoteBlockType } from "@/src/server/store/types"

/** 可编辑文本区域的通用样式 */
const editableClass =
  "outline-none rounded-sm transition-shadow duration-200 focus:ring-1 focus:ring-primary/15 focus:bg-primary/[0.02]"

/** 可编辑区域的 hover 提示 */
const editableHoverClass = "hover:bg-primary/[0.02]"

type SlashTriggerPayload = {
  blockId: string
  query: string
  rect: { top: number; left: number; bottom: number }
}

type EditableProps = {
  blockId: string
  text: string
  className?: string
  tag?: "p" | "span" | "h2" | "h3" | "h4" | "pre"
  /** 是否显示 placeholder（仅空段落） */
  placeholder?: string
  onTextChange?: (blockId: string, text: string) => void
  /** / 命令触发（含实时 query） */
  onSlashTrigger?: (payload: SlashTriggerPayload) => void
  /** / 命令关闭（文本不再以 / 开头） */
  onSlashClose?: () => void
  /** Enter 在当前块后新建段落 */
  onEnterNewBlock?: (blockId: string) => void
  /** Backspace 删除空块 */
  onBackspaceEmpty?: (blockId: string) => void
}

/**
 * 通用 contentEditable 文本区域
 * uncontrolled 模式：初始渲染后由 DOM 自行管理内容，避免光标跳动
 */
function EditableText({
  blockId,
  text,
  className,
  tag: Tag = "p",
  placeholder,
  onTextChange,
  onSlashTrigger,
  onSlashClose,
  onEnterNewBlock,
  onBackspaceEmpty,
}: EditableProps) {
  const ref = useRef<HTMLElement>(null)

  const handleInput = useCallback(() => {
    if (!ref.current || !onTextChange) {
      return
    }
    const content = ref.current.textContent ?? ""
    onTextChange(blockId, content)

    // 检测 / 触发：文本以 / 开头
    if (content.startsWith("/") && onSlashTrigger) {
      const query = content.slice(1)
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        onSlashTrigger({ blockId, query, rect: { top: rect.top, left: rect.left, bottom: rect.bottom } })
      }
    } else if (onSlashClose) {
      onSlashClose()
    }
  }, [blockId, onTextChange, onSlashTrigger, onSlashClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter（非 Shift）新建块
      if (e.key === "Enter" && !e.shiftKey && onEnterNewBlock) {
        e.preventDefault()
        onEnterNewBlock(blockId)
        return
      }
      // Backspace 在空块中删除
      if (e.key === "Backspace" && onBackspaceEmpty) {
        const content = ref.current?.textContent ?? ""
        if (content === "") {
          e.preventDefault()
          onBackspaceEmpty(blockId)
        }
      }
    },
    [blockId, onEnterNewBlock, onBackspaceEmpty]
  )

  return (
    <Tag
      ref={ref as React.RefObject<HTMLElement & HTMLParagraphElement & HTMLHeadingElement & HTMLPreElement>}
      className={cn(
        editableClass,
        editableHoverClass,
        placeholder && "empty:before:content-[attr(data-placeholder)] empty:before:text-muted/40 empty:before:pointer-events-none",
        className
      )}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
    >
      {text}
    </Tag>
  )
}

/**
 * 渲染单个笔记块
 */
export const NoteBlockItem = memo(function NoteBlockItem({
  block,
  hasAnnotation,
  isSelected,
  onSelectText,
  onTextChange,
  onDelete,
  onSlashTrigger,
  onSlashClose,
  onEnterNewBlock,
  onBackspaceEmpty,
  onBlockClick,
}: {
  block: NoteBlock
  hasAnnotation?: boolean
  /** 对话模式下是否被选中 */
  isSelected?: boolean
  onSelectText?: (blockId: string, text: string) => void
  onTextChange?: (blockId: string, text: string) => void
  onDelete?: (blockId: string) => void
  onSlashTrigger?: (payload: SlashTriggerPayload) => void
  onSlashClose?: () => void
  onEnterNewBlock?: (blockId: string) => void
  onBackspaceEmpty?: (blockId: string) => void
  /** 块点击回调，用于对话模式选块 */
  onBlockClick?: (blockId: string) => void
}) {
  const handleMouseUp = () => {
    if (!onSelectText) {
      return
    }
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    if (text && text.length > 0) {
      onSelectText(block.id, text)
    }
  }

  return (
    <div
      className={cn(
        "group/block relative",
        hasAnnotation && "note-block-annotated",
        isSelected && "rounded-lg ring-1 ring-primary/30"
      )}
      onMouseUp={handleMouseUp}
      onClick={() => onBlockClick?.(block.id)}
    >
      {hasAnnotation && (
        <div className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning/20 border border-warning/40">
          <div className="h-1.5 w-1.5 rounded-full bg-warning" />
        </div>
      )}
      {onDelete && (
        <button
          onClick={() => onDelete(block.id)}
          title="删除此块"
          className="absolute -right-2 top-0 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-surface text-muted opacity-0 shadow-sm transition hover:border-error/40 hover:bg-error/10 hover:text-error group-hover/block:opacity-100"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
      {renderBlock(block, onTextChange, onSlashTrigger, onSlashClose, onEnterNewBlock, onBackspaceEmpty)}
    </div>
  )
})

function renderBlock(
  block: NoteBlock,
  onTextChange?: (blockId: string, text: string) => void,
  onSlashTrigger?: (payload: SlashTriggerPayload) => void,
  onSlashClose?: () => void,
  onEnterNewBlock?: (blockId: string) => void,
  onBackspaceEmpty?: (blockId: string) => void,
) {
  switch (block.type) {
    case "heading":
      return <HeadingBlockView block={block} onTextChange={onTextChange} onSlashTrigger={onSlashTrigger} onSlashClose={onSlashClose} onEnterNewBlock={onEnterNewBlock} onBackspaceEmpty={onBackspaceEmpty} />
    case "paragraph":
      return <ParagraphBlockView block={block} onTextChange={onTextChange} onSlashTrigger={onSlashTrigger} onSlashClose={onSlashClose} onEnterNewBlock={onEnterNewBlock} onBackspaceEmpty={onBackspaceEmpty} />
    case "quote":
      return <QuoteBlockView block={block} onTextChange={onTextChange} onEnterNewBlock={onEnterNewBlock} onBackspaceEmpty={onBackspaceEmpty} />
    case "highlight":
      return <HighlightBlockView block={block} onTextChange={onTextChange} onEnterNewBlock={onEnterNewBlock} onBackspaceEmpty={onBackspaceEmpty} />
    case "insight":
      return <InsightBlockView block={block} onTextChange={onTextChange} onEnterNewBlock={onEnterNewBlock} onBackspaceEmpty={onBackspaceEmpty} />
    case "code":
      return <CodeBlockView block={block} onTextChange={onTextChange} onEnterNewBlock={onEnterNewBlock} />
    case "divider":
      return <hr className="my-4 border-border/30" />
    case "chart":
      return <ChartBlockPlaceholder block={block} />
    case "image":
    case "callout":
    case "task":
    case "table":
    case "mermaid":
    case "math":
    case "excalidraw":
      return <ImportedBlockItem block={block} />
    default:
      return null
  }
}

type TextBlockCallbacks = {
  onTextChange?: (blockId: string, text: string) => void
  onSlashTrigger?: (payload: SlashTriggerPayload) => void
  onSlashClose?: () => void
  onEnterNewBlock?: (blockId: string) => void
  onBackspaceEmpty?: (blockId: string) => void
}

function HeadingBlockView({
  block,
  ...cbs
}: {
  block: Extract<NoteBlock, { type: "heading" }>
} & TextBlockCallbacks) {
  const tags = { 1: "h2", 2: "h3", 3: "h4" } as const
  const sizes = {
    1: "text-xl font-bold text-foreground",
    2: "text-lg font-semibold text-foreground",
    3: "text-base font-semibold text-foreground/90"
  }
  return (
    <EditableText
      blockId={block.id}
      text={block.text}
      tag={tags[block.level]}
      className={sizes[block.level]}
      placeholder="标题"
      {...cbs}
    />
  )
}

function ParagraphBlockView({
  block,
  ...cbs
}: {
  block: Extract<NoteBlock, { type: "paragraph" }>
} & TextBlockCallbacks) {
  return (
    <EditableText
      blockId={block.id}
      text={block.text}
      className="text-sm leading-[1.8] text-secondary select-text"
      placeholder="输入文字，或输入 / 选择块类型"
      {...cbs}
    />
  )
}

function QuoteBlockView({
  block,
  onTextChange,
  onEnterNewBlock,
  onBackspaceEmpty,
}: {
  block: Extract<NoteBlock, { type: "quote" }>
  onTextChange?: (blockId: string, text: string) => void
  onEnterNewBlock?: (blockId: string) => void
  onBackspaceEmpty?: (blockId: string) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border/40 bg-surface transition-shadow duration-200 focus-within:ring-1 focus-within:ring-primary/15">
      <div className="w-[3px] shrink-0 bg-accent-blue" />
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Quote className="h-3 w-3 text-accent-blue" />
          <span className="text-[11px] font-semibold tracking-wide text-accent-blue">
            原文引用
          </span>
        </div>
        <EditableText
          blockId={block.id}
          text={block.text}
          className="text-[13px] italic leading-[1.7] text-foreground/80 select-text"
          placeholder="输入引用内容"
          onTextChange={onTextChange}
          onEnterNewBlock={onEnterNewBlock}
          onBackspaceEmpty={onBackspaceEmpty}
        />
        {block.sourceBookTitle && (
          <div className="flex items-center gap-1 text-muted">
            <ExternalLink className="h-2.5 w-2.5" />
            <span className="text-[11px]">
              来源：《{block.sourceBookTitle}》
              {block.sourceLocation ? ` ${block.sourceLocation}` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function HighlightBlockView({
  block,
  onTextChange,
  onEnterNewBlock,
  onBackspaceEmpty,
}: {
  block: Extract<NoteBlock, { type: "highlight" }>
  onTextChange?: (blockId: string, text: string) => void
  onEnterNewBlock?: (blockId: string) => void
  onBackspaceEmpty?: (blockId: string) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-primary/20 bg-primary/5 transition-shadow duration-200 focus-within:ring-1 focus-within:ring-primary/15">
      <div className="w-[3px] shrink-0 bg-primary" />
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Highlighter className="h-3 w-3 text-primary" />
          <span className="text-[11px] font-semibold tracking-wide text-primary">
            {block.label ?? "关键洞察"}
          </span>
        </div>
        <EditableText
          blockId={block.id}
          text={block.text}
          className="text-[13px] italic leading-[1.7] text-foreground/80 select-text"
          placeholder="输入内容"
          onTextChange={onTextChange}
          onEnterNewBlock={onEnterNewBlock}
          onBackspaceEmpty={onBackspaceEmpty}
        />
        {block.sourceBookTitle && (
          <div className="flex items-center gap-1 text-muted">
            <ExternalLink className="h-2.5 w-2.5" />
            <span className="text-[11px]">
              来源：《{block.sourceBookTitle}》
              {block.sourceLocation ? ` ${block.sourceLocation}` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function InsightBlockView({
  block,
  onTextChange,
  onEnterNewBlock,
  onBackspaceEmpty,
}: {
  block: Extract<NoteBlock, { type: "insight" }>
  onTextChange?: (blockId: string, text: string) => void
  onEnterNewBlock?: (blockId: string) => void
  onBackspaceEmpty?: (blockId: string) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-success/20 bg-success/5 transition-shadow duration-200 focus-within:ring-1 focus-within:ring-primary/15">
      <div className="w-[3px] shrink-0 bg-success" />
      <div className="flex flex-col gap-1.5 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Lightbulb className="h-3 w-3 text-success" />
          <span className="text-[11px] font-semibold tracking-wide text-success">
            {block.label ?? "AI 补充说明"}
          </span>
        </div>
        <EditableText
          blockId={block.id}
          text={block.text}
          className="text-[13px] leading-[1.7] text-secondary select-text"
          placeholder="输入内容"
          onTextChange={onTextChange}
          onEnterNewBlock={onEnterNewBlock}
          onBackspaceEmpty={onBackspaceEmpty}
        />
      </div>
    </div>
  )
}

function CodeBlockView({
  block,
  onTextChange,
  onEnterNewBlock,
}: {
  block: Extract<NoteBlock, { type: "code" }>
  onTextChange?: (blockId: string, text: string) => void
  onEnterNewBlock?: (blockId: string) => void
}) {
  const ref = useRef<HTMLElement>(null)

  const handleInput = useCallback(() => {
    if (!ref.current || !onTextChange) {
      return
    }
    onTextChange(block.id, ref.current.textContent ?? "")
  }, [block.id, onTextChange])

  /** 代码块中 Shift+Enter 才新建块（Enter 正常换行） */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && e.shiftKey && onEnterNewBlock) {
        e.preventDefault()
        onEnterNewBlock(block.id)
      }
    },
    [block.id, onEnterNewBlock]
  )

  return (
    <div className="overflow-hidden rounded-lg border border-border/40 bg-elevated transition-shadow duration-200 focus-within:ring-1 focus-within:ring-primary/15">
      {block.language && (
        <div className="border-b border-border/30 px-4 py-1.5">
          <span className="text-[11px] text-muted">{block.language}</span>
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code
          ref={ref as React.RefObject<HTMLElement>}
          className={cn(
            "text-[13px] leading-relaxed text-foreground/80 block whitespace-pre-wrap",
            editableClass,
            editableHoverClass
          )}
          contentEditable="plaintext-only"
          suppressContentEditableWarning
          spellCheck={false}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        >
          {block.code}
        </code>
      </pre>
    </div>
  )
}

function ChartBlockPlaceholder({ block }: { block: Extract<NoteBlock, { type: "chart" }> }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/40 bg-elevated/30 py-8">
      <BookOpen className="mb-2 h-6 w-6 text-muted/40" />
      <p className="text-[12px] text-muted">
        {block.title ?? "图表"} · {block.chartType}
      </p>
      <p className="text-[11px] text-muted">图表渲染即将支持</p>
    </div>
  )
}

/**
 * 渲染完整的笔记块列表
 * Notion 风格：连续编辑，Enter 新建段落，/ 唤出命令菜单
 */
export function NoteBlockList({
  blocks,
  annotatedBlockIds,
  chatSelectedBlockId,
  focusBlockId,
  onSelectText,
  onBlockTextChange,
  onBlockDelete,
  onBlockInsert,
  onBlockTypeChange,
  onEnterNewBlock,
  onBackspaceEmpty,
  onBlockClick,
}: {
  blocks: NoteBlock[]
  annotatedBlockIds?: Set<string>
  /** 对话模式下选中的块 ID */
  chatSelectedBlockId?: string
  /** 新建块后自动聚焦的块 ID */
  focusBlockId?: string
  onSelectText?: (blockId: string, text: string) => void
  onBlockTextChange?: (blockId: string, text: string) => void
  onBlockDelete?: (blockId: string) => void
  /** 插入新块（afterBlockId=null 表示插入到开头） */
  onBlockInsert?: (afterBlockId: string | null, type: NoteBlockType) => void
  /** 替换块类型（/ 选择后替换当前块） */
  onBlockTypeChange?: (blockId: string, type: NoteBlockType) => void
  /** Enter 新建段落 */
  onEnterNewBlock?: (blockId: string) => void
  /** Backspace 删除空块 */
  onBackspaceEmpty?: (blockId: string) => void
  /** 块点击回调，用于对话模式选块 */
  onBlockClick?: (blockId: string) => void
}) {
  const [slashMenu, setSlashMenu] = useState<{
    /** 触发斜杠命令的块 ID */
    blockId: string
    query: string
    rect: { top: number; left: number; bottom: number }
  } | null>(null)

  /** 自动聚焦新创建的块 */
  useEffect(() => {
    if (!focusBlockId) {
      return
    }
    // 用 requestAnimationFrame 等待 DOM 更新
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-block-id="${focusBlockId}"] [contenteditable]`) as HTMLElement
        ?? document.querySelector(`[data-block-id="${focusBlockId}"][contenteditable]`) as HTMLElement
      if (el) {
        el.focus()
        // 光标移到末尾
        const sel = window.getSelection()
        if (sel) {
          sel.selectAllChildren(el)
          sel.collapseToEnd()
        }
      }
    })
  }, [focusBlockId])

  /** 从 EditableText 的 / 输入触发（含实时 query） */
  const handleSlashTrigger = useCallback(
    (payload: SlashTriggerPayload) => {
      setSlashMenu({ blockId: payload.blockId, query: payload.query, rect: payload.rect })
    },
    []
  )

  /** 文本不再以 / 开头时关闭菜单 */
  const handleSlashClose = useCallback(() => {
    setSlashMenu(null)
  }, [])

  /** 选择块类型 → 替换当前块类型 */
  const handleSlashSelect = useCallback(
    (type: NoteBlockType) => {
      if (!slashMenu) {
        return
      }
      // 清空 / 文本
      onBlockTextChange?.(slashMenu.blockId, "")
      // 替换当前块类型
      if (onBlockTypeChange) {
        onBlockTypeChange(slashMenu.blockId, type)
      }
      setSlashMenu(null)
    },
    [slashMenu, onBlockTypeChange, onBlockTextChange]
  )

  if (blocks.length === 0) {
    return null
  }

  const sorted = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col">
      {sorted.map((block) => (
        <div key={block.id} data-block-id={block.id}>
          <NoteBlockItem
            block={block}
            hasAnnotation={annotatedBlockIds?.has(block.id)}
            isSelected={chatSelectedBlockId === block.id}
            onSelectText={onSelectText}
            onTextChange={onBlockTextChange}
            onDelete={onBlockDelete}
            onSlashTrigger={handleSlashTrigger}
            onSlashClose={handleSlashClose}
            onEnterNewBlock={onEnterNewBlock}
            onBackspaceEmpty={onBackspaceEmpty}
            onBlockClick={onBlockClick}
          />
        </div>
      ))}

      {/* 斜杠命令菜单 */}
      {slashMenu && (
        <SlashCommandMenu
          query={slashMenu.query}
          anchorRect={slashMenu.rect}
          onSelect={handleSlashSelect}
          onClose={() => setSlashMenu(null)}
        />
      )}
    </div>
  )
}
