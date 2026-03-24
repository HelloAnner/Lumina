/**
 * 笔记块渲染器
 * 根据块类型渲染不同的企业级富文本块组件
 *
 * @author Anner
 * @since 0.2.0
 * Created on 2026/3/24
 */
"use client"

import {
  BookOpen,
  ExternalLink,
  Highlighter,
  Lightbulb,
  Quote
} from "lucide-react"
import { cn } from "@/src/lib/utils"
import type { NoteBlock } from "@/src/server/store/types"

/**
 * 渲染单个笔记块
 */
export function NoteBlockItem({
  block,
  hasAnnotation,
  onSelectText
}: {
  block: NoteBlock
  hasAnnotation?: boolean
  onSelectText?: (blockId: string, text: string) => void
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
      className={cn("group relative", hasAnnotation && "note-block-annotated")}
      onMouseUp={handleMouseUp}
    >
      {hasAnnotation && (
        <div className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        </div>
      )}
      {renderBlock(block)}
    </div>
  )
}

function renderBlock(block: NoteBlock) {
  switch (block.type) {
    case "heading":
      return <HeadingBlockView block={block} />
    case "paragraph":
      return <ParagraphBlockView block={block} />
    case "quote":
      return <QuoteBlockView block={block} />
    case "highlight":
      return <HighlightBlockView block={block} />
    case "insight":
      return <InsightBlockView block={block} />
    case "code":
      return <CodeBlockView block={block} />
    case "divider":
      return <hr className="my-4 border-border/30" />
    case "chart":
      return <ChartBlockPlaceholder block={block} />
    default:
      return null
  }
}

function HeadingBlockView({ block }: { block: Extract<NoteBlock, { type: "heading" }> }) {
  const Tag = block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4"
  const sizes = {
    1: "text-xl font-bold text-foreground",
    2: "text-lg font-semibold text-foreground",
    3: "text-base font-semibold text-foreground/90"
  }
  return <Tag className={sizes[block.level]}>{block.text}</Tag>
}

function ParagraphBlockView({ block }: { block: Extract<NoteBlock, { type: "paragraph" }> }) {
  return (
    <p className="text-sm leading-[1.8] text-secondary select-text">
      {block.text}
    </p>
  )
}

function QuoteBlockView({ block }: { block: Extract<NoteBlock, { type: "quote" }> }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border/40 bg-surface">
      <div className="w-[3px] shrink-0 bg-blue-500" />
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Quote className="h-3 w-3 text-blue-500" />
          <span className="text-[11px] font-semibold tracking-wide text-blue-500">
            原文引用
          </span>
        </div>
        <p className="text-[13px] italic leading-[1.7] text-foreground/80 select-text">
          &ldquo;{block.text}&rdquo;
        </p>
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

function HighlightBlockView({ block }: { block: Extract<NoteBlock, { type: "highlight" }> }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-violet-500/20 bg-violet-500/5">
      <div className="w-[3px] shrink-0 bg-violet-500" />
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Highlighter className="h-3 w-3 text-violet-500" />
          <span className="text-[11px] font-semibold tracking-wide text-violet-500">
            {block.label ?? "关键洞察"}
          </span>
        </div>
        <p className="text-[13px] italic leading-[1.7] text-foreground/80 select-text">
          &ldquo;{block.text}&rdquo;
        </p>
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

function InsightBlockView({ block }: { block: Extract<NoteBlock, { type: "insight" }> }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-emerald-500/20 bg-emerald-500/5">
      <div className="w-[3px] shrink-0 bg-emerald-500" />
      <div className="flex flex-col gap-1.5 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Lightbulb className="h-3 w-3 text-emerald-500" />
          <span className="text-[11px] font-semibold tracking-wide text-emerald-500">
            {block.label ?? "AI 补充说明"}
          </span>
        </div>
        <p className="text-[13px] leading-[1.7] text-secondary select-text">
          {block.text}
        </p>
      </div>
    </div>
  )
}

function CodeBlockView({ block }: { block: Extract<NoteBlock, { type: "code" }> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/40 bg-elevated">
      {block.language && (
        <div className="border-b border-border/30 px-4 py-1.5">
          <span className="text-[11px] text-muted">{block.language}</span>
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code className="text-[13px] leading-relaxed text-foreground/80">
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
      <p className="text-[12px] text-muted/50">
        {block.title ?? "图表"} · {block.chartType}
      </p>
      <p className="text-[11px] text-muted/30">图表渲染即将支持</p>
    </div>
  )
}

/**
 * 渲染完整的笔记块列表
 */
export function NoteBlockList({
  blocks,
  annotatedBlockIds,
  onSelectText
}: {
  blocks: NoteBlock[]
  annotatedBlockIds?: Set<string>
  onSelectText?: (blockId: string, text: string) => void
}) {
  if (blocks.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted/40">暂无笔记内容</p>
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
        />
      ))}
    </div>
  )
}
