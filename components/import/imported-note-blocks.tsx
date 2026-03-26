/**
 * 导入笔记块渲染器
 * 支持 Obsidian 特有块类型：image, callout, task, table, mermaid, math, excalidraw
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Circle,
  FileQuestion,
  Info,
  Lightbulb,
  MinusCircle,
  Quote,
  Square,
  Timer,
  XCircle
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/src/lib/utils"
import type { NoteBlock } from "@/src/server/store/types"

/** 渲染导入笔记的单个块 */
export function ImportedBlockItem({ block }: { block: NoteBlock }) {
  switch (block.type) {
    case "heading":
      return <ImportHeading block={block} />
    case "paragraph":
      return <ImportParagraph block={block} />
    case "quote":
      return <ImportQuote block={block} />
    case "code":
      return <ImportCode block={block} />
    case "divider":
      return <hr className="my-3 border-border/30" />
    case "image":
      return <ImportImage block={block} />
    case "callout":
      return <ImportCallout block={block} />
    case "task":
      return <ImportTask block={block} />
    case "table":
      return <ImportTable block={block} />
    case "mermaid":
      return <ImportMermaid block={block} />
    case "math":
      return <ImportMath block={block} />
    case "excalidraw":
      return <ImportExcalidraw block={block} />
    default:
      return null
  }
}

/** 渲染导入笔记的完整块列表 */
export function ImportedBlockList({ blocks }: { blocks: NoteBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-sm text-muted">笔记内容为空</p>
      </div>
    )
  }

  const sorted = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col gap-4">
      {sorted.map((block) => (
        <ImportedBlockItem key={block.id} block={block} />
      ))}
    </div>
  )
}

// ─── 基础块 ───

function ImportHeading({ block }: { block: Extract<NoteBlock, { type: "heading" }> }) {
  const styles = {
    1: "text-xl font-bold text-foreground",
    2: "text-lg font-semibold text-foreground",
    3: "text-base font-semibold text-foreground/90"
  }
  return <div className={styles[block.level]}>{block.text}</div>
}

function ImportParagraph({ block }: { block: Extract<NoteBlock, { type: "paragraph" }> }) {
  return (
    <p className="text-sm leading-[1.8] text-secondary whitespace-pre-wrap select-text">
      {block.text}
    </p>
  )
}

function ImportQuote({ block }: { block: Extract<NoteBlock, { type: "quote" }> }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border/40 bg-surface">
      <div className="w-[3px] shrink-0 bg-accent-blue" />
      <div className="flex flex-col gap-1 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Quote className="h-3 w-3 text-accent-blue" />
          <span className="text-[11px] font-medium text-accent-blue">引用</span>
        </div>
        <p className="text-[13px] italic leading-[1.7] text-foreground/80 whitespace-pre-wrap select-text">
          {block.text}
        </p>
      </div>
    </div>
  )
}

function ImportCode({ block }: { block: Extract<NoteBlock, { type: "code" }> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/40 bg-elevated">
      {block.language && (
        <div className="border-b border-border/30 px-4 py-1.5">
          <span className="text-[11px] text-muted">{block.language}</span>
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code className="text-[13px] leading-relaxed text-foreground/80 block whitespace-pre-wrap select-text">
          {block.code}
        </code>
      </pre>
    </div>
  )
}

// ─── Obsidian 特有块 ───

function ImportImage({ block }: { block: Extract<NoteBlock, { type: "image" }> }) {
  const src = block.externalUrl
    ? block.externalUrl
    : block.objectKey
      ? `/api/import/images/${block.objectKey}`
      : null

  if (!src) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/40 bg-elevated/30 px-4 py-3">
        <FileQuestion className="h-4 w-4 text-muted/50" />
        <span className="text-xs text-muted">{block.originalName ?? "图片不可用"}</span>
      </div>
    )
  }

  return (
    <figure className="my-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={block.alt || block.originalName || ""}
        className="rounded-lg max-w-full"
        style={block.displayWidth ? { width: block.displayWidth } : undefined}
        loading="lazy"
      />
      {(block.sourceBookTitle || block.sourceLocation) && (
        <div className="mt-2 text-[11px] text-muted">
          来源：{block.sourceBookTitle ? `《${block.sourceBookTitle}》` : ""}
          {block.sourceLocation ? ` ${block.sourceLocation}` : ""}
        </div>
      )}
      {block.alt && (
        <figcaption className="mt-1.5 text-center text-xs text-muted">{block.alt}</figcaption>
      )}
    </figure>
  )
}

const CALLOUT_STYLES: Record<string, { icon: React.ReactNode; border: string; bg: string; color: string }> = {
  note: { icon: <Info className="h-3.5 w-3.5" />, border: "border-accent-blue/30", bg: "bg-accent-blue/5", color: "text-accent-blue" },
  info: { icon: <Info className="h-3.5 w-3.5" />, border: "border-accent-blue/30", bg: "bg-accent-blue/5", color: "text-accent-blue" },
  tip: { icon: <Lightbulb className="h-3.5 w-3.5" />, border: "border-success/30", bg: "bg-success/5", color: "text-success" },
  warning: { icon: <AlertTriangle className="h-3.5 w-3.5" />, border: "border-warning/30", bg: "bg-warning/5", color: "text-warning" },
  danger: { icon: <XCircle className="h-3.5 w-3.5" />, border: "border-error/30", bg: "bg-error/5", color: "text-error" },
  error: { icon: <XCircle className="h-3.5 w-3.5" />, border: "border-error/30", bg: "bg-error/5", color: "text-error" },
  success: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, border: "border-success/30", bg: "bg-success/5", color: "text-success" },
  question: { icon: <FileQuestion className="h-3.5 w-3.5" />, border: "border-accent-purple/30", bg: "bg-accent-purple/5", color: "text-accent-purple" },
  example: { icon: <Lightbulb className="h-3.5 w-3.5" />, border: "border-accent-purple/30", bg: "bg-accent-purple/5", color: "text-accent-purple" }
}

function ImportCallout({ block }: { block: Extract<NoteBlock, { type: "callout" }> }) {
  const style = CALLOUT_STYLES[block.calloutType] ?? CALLOUT_STYLES.note
  const [expanded, setExpanded] = useState(!block.defaultFolded)

  return (
    <div className={cn("rounded-lg border", style.border, style.bg)}>
      <button
        onClick={block.foldable ? () => setExpanded(!expanded) : undefined}
        className={cn(
          "flex w-full items-center gap-2 px-4 py-2.5",
          block.foldable && "cursor-pointer"
        )}
      >
        <span className={style.color}>{style.icon}</span>
        <span className={cn("text-[13px] font-medium flex-1 text-left", style.color)}>
          {block.title ?? block.calloutType.toUpperCase()}
        </span>
        {block.foldable && (
          expanded
            ? <ChevronDown className={cn("h-3.5 w-3.5", style.color)} />
            : <ChevronRight className={cn("h-3.5 w-3.5", style.color)} />
        )}
      </button>
      {expanded && block.children && block.children.length > 0 && (
        <div className="border-t border-border/20 px-4 py-3">
          <ImportedBlockList blocks={block.children} />
        </div>
      )}
    </div>
  )
}

function ImportTask({ block }: { block: Extract<NoteBlock, { type: "task" }> }) {
  return (
    <div className="space-y-1">
      {block.items.map((item, idx) => (
        <div
          key={idx}
          className="flex items-start gap-2"
          style={{ paddingLeft: item.indent * 16 }}
        >
          <TaskStatusIcon status={item.status} />
          <span className={cn(
            "text-sm leading-relaxed select-text",
            item.status === "checked" && "line-through text-muted",
            item.status === "cancelled" && "line-through text-muted"
          )}>
            {item.text}
          </span>
          {item.reminderDate && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-accent-warm">
              <Timer className="h-3 w-3" />
              {item.reminderDate}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "checked":
      return <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-success" />
    case "deferred":
      return <Timer className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue" />
    case "cancelled":
      return <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
    default:
      return <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
  }
}

function ImportTable({ block }: { block: Extract<NoteBlock, { type: "table" }> }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/40">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40 bg-elevated/50">
            {block.headers.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "px-3 py-2 text-xs font-medium text-muted",
                  block.alignments?.[i] === "center" && "text-center",
                  block.alignments?.[i] === "right" && "text-right"
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/20 last:border-0">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    "px-3 py-2 text-secondary",
                    block.alignments?.[ci] === "center" && "text-center",
                    block.alignments?.[ci] === "right" && "text-right"
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ImportMermaid({ block }: { block: Extract<NoteBlock, { type: "mermaid" }> }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/40 bg-elevated/30 py-6">
      <span className="text-xs text-muted">Mermaid 图表</span>
      <pre className="mt-2 max-w-full overflow-x-auto px-4 text-xs text-muted/70">
        {block.code.length > 200 ? `${block.code.slice(0, 200)}...` : block.code}
      </pre>
    </div>
  )
}

function ImportMath({ block }: { block: Extract<NoteBlock, { type: "math" }> }) {
  return (
    <div className={cn(
      "rounded-lg border border-border/40 bg-elevated/30 px-4 py-3",
      block.inline ? "inline-block" : "block text-center"
    )}>
      <code className="text-sm text-foreground/80 font-mono select-text">{block.latex}</code>
    </div>
  )
}

function ImportExcalidraw({ block }: { block: Extract<NoteBlock, { type: "excalidraw" }> }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/40 bg-elevated/30 py-6">
      <span className="text-xs text-muted">{block.fallbackText ?? "Excalidraw 图形"}</span>
    </div>
  )
}
