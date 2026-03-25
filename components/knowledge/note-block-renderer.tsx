/**
 * 笔记块渲染器
 * 所有文本块支持 contentEditable 就地编辑
 * 使用 uncontrolled 模式避免 React 重渲染导致光标跳动
 *
 * @author Anner
 * @since 0.2.0
 * Created on 2026/3/24
 */
"use client"

import { useCallback, useRef } from "react"
import {
  BookOpen,
  ExternalLink,
  Highlighter,
  Lightbulb,
  Quote
} from "lucide-react"
import { cn } from "@/src/lib/utils"
import type { NoteBlock } from "@/src/server/store/types"

/** 可编辑文本区域的通用样式 */
const editableClass =
  "outline-none rounded-sm transition-shadow duration-200 focus:ring-1 focus:ring-primary/15 focus:bg-primary/[0.02]"

/** 可编辑区域的 hover 提示 */
const editableHoverClass = "hover:bg-primary/[0.02]"

type EditableProps = {
  blockId: string
  text: string
  className?: string
  tag?: "p" | "span" | "h2" | "h3" | "h4" | "pre"
  onTextChange?: (blockId: string, text: string) => void
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
  onTextChange
}: EditableProps) {
  const ref = useRef<HTMLElement>(null)

  const handleInput = useCallback(() => {
    if (!ref.current || !onTextChange) {
      return
    }
    const content = ref.current.textContent ?? ""
    onTextChange(blockId, content)
  }, [blockId, onTextChange])

  return (
    <Tag
      ref={ref as React.RefObject<HTMLElement & HTMLParagraphElement & HTMLHeadingElement & HTMLPreElement>}
      className={cn(editableClass, editableHoverClass, className)}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      onInput={handleInput}
    >
      {text}
    </Tag>
  )
}

/**
 * 渲染单个笔记块
 */
export function NoteBlockItem({
  block,
  hasAnnotation,
  onSelectText,
  onTextChange
}: {
  block: NoteBlock
  hasAnnotation?: boolean
  onSelectText?: (blockId: string, text: string) => void
  onTextChange?: (blockId: string, text: string) => void
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
      className={cn("group/block relative", hasAnnotation && "note-block-annotated")}
      onMouseUp={handleMouseUp}
    >
      {hasAnnotation && (
        <div className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning/20 border border-warning/40">
          <div className="h-1.5 w-1.5 rounded-full bg-warning" />
        </div>
      )}
      {renderBlock(block, onTextChange)}
    </div>
  )
}

function renderBlock(
  block: NoteBlock,
  onTextChange?: (blockId: string, text: string) => void
) {
  switch (block.type) {
    case "heading":
      return <HeadingBlockView block={block} onTextChange={onTextChange} />
    case "paragraph":
      return <ParagraphBlockView block={block} onTextChange={onTextChange} />
    case "quote":
      return <QuoteBlockView block={block} onTextChange={onTextChange} />
    case "highlight":
      return <HighlightBlockView block={block} onTextChange={onTextChange} />
    case "insight":
      return <InsightBlockView block={block} onTextChange={onTextChange} />
    case "code":
      return <CodeBlockView block={block} onTextChange={onTextChange} />
    case "divider":
      return <hr className="my-4 border-border/30" />
    case "chart":
      return <ChartBlockPlaceholder block={block} />
    default:
      return null
  }
}

function HeadingBlockView({
  block,
  onTextChange
}: {
  block: Extract<NoteBlock, { type: "heading" }>
  onTextChange?: (blockId: string, text: string) => void
}) {
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
      onTextChange={onTextChange}
    />
  )
}

function ParagraphBlockView({
  block,
  onTextChange
}: {
  block: Extract<NoteBlock, { type: "paragraph" }>
  onTextChange?: (blockId: string, text: string) => void
}) {
  return (
    <EditableText
      blockId={block.id}
      text={block.text}
      className="text-sm leading-[1.8] text-secondary select-text"
      onTextChange={onTextChange}
    />
  )
}

function QuoteBlockView({
  block,
  onTextChange
}: {
  block: Extract<NoteBlock, { type: "quote" }>
  onTextChange?: (blockId: string, text: string) => void
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
          onTextChange={onTextChange}
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
  onTextChange
}: {
  block: Extract<NoteBlock, { type: "highlight" }>
  onTextChange?: (blockId: string, text: string) => void
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
          onTextChange={onTextChange}
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
  onTextChange
}: {
  block: Extract<NoteBlock, { type: "insight" }>
  onTextChange?: (blockId: string, text: string) => void
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
          onTextChange={onTextChange}
        />
      </div>
    </div>
  )
}

function CodeBlockView({
  block,
  onTextChange
}: {
  block: Extract<NoteBlock, { type: "code" }>
  onTextChange?: (blockId: string, text: string) => void
}) {
  const ref = useRef<HTMLElement>(null)

  const handleInput = useCallback(() => {
    if (!ref.current || !onTextChange) {
      return
    }
    onTextChange(block.id, ref.current.textContent ?? "")
  }, [block.id, onTextChange])

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
 */
export function NoteBlockList({
  blocks,
  annotatedBlockIds,
  onSelectText,
  onBlockTextChange
}: {
  blocks: NoteBlock[]
  annotatedBlockIds?: Set<string>
  onSelectText?: (blockId: string, text: string) => void
  onBlockTextChange?: (blockId: string, text: string) => void
}) {
  if (blocks.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted">暂无笔记内容</p>
      </div>
    )
  }

  const sorted = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col gap-5">
      {sorted.map((block) => (
        <NoteBlockItem
          key={block.id}
          block={block}
          hasAnnotation={annotatedBlockIds?.has(block.id)}
          onSelectText={onSelectText}
          onTextChange={onBlockTextChange}
        />
      ))}
    </div>
  )
}
