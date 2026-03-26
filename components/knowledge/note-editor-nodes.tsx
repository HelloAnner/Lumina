/**
 * 笔记编辑器 TipTap 节点定义
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
"use client"

import { useState } from "react"
import {
  Extension,
  Mark,
  mergeAttributes,
  Node,
  nodeInputRule
} from "@tiptap/core"
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import { ReactNodeViewRenderer, NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import { Plugin } from "@tiptap/pm/state"
import { BookOpen, Copy, Highlighter, Lightbulb, Quote } from "lucide-react"
import { ImportedBlockItem } from "@/components/import/imported-note-blocks"
import type { NoteBlock } from "@/src/server/store/types"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    highlight: {
      toggleHighlight: () => ReturnType
      setHighlight: () => ReturnType
      unsetHighlight: () => ReturnType
    }
  }
}

export const QuoteBlock = Node.create({
  name: "quoteBlock",
  group: "block",
  content: "inline*",
  addAttributes() {
    return createBlockAttrs({
      sourceBookTitle: { default: "" },
      sourceLocation: { default: "" },
      highlightId: { default: null }
    })
  },
  parseHTML() {
    return [{ tag: 'div[data-type="quoteBlock"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "quoteBlock" }), 0]
  },
  addInputRules() {
    return [
      nodeInputRule({ find: /^>\s$/, type: this.type }),
      nodeInputRule({ find: /^"\s$/, type: this.type })
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(QuoteBlockView)
  }
})

export const HighlightBlock = Node.create({
  name: "highlightBlock",
  group: "block",
  content: "inline*",
  addAttributes() {
    return createBlockAttrs({
      label: { default: "" },
      sourceBookTitle: { default: "" },
      sourceLocation: { default: "" },
      highlightId: { default: null }
    })
  },
  parseHTML() {
    return [{ tag: 'div[data-type="highlightBlock"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "highlightBlock" }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(HighlightBlockView)
  }
})

export const InsightBlock = Node.create({
  name: "insightBlock",
  group: "block",
  content: "inline*",
  addAttributes() {
    return createBlockAttrs({
      label: { default: "" }
    })
  },
  parseHTML() {
    return [{ tag: 'div[data-type="insightBlock"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "insightBlock" }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(InsightBlockView)
  }
})

export const ImportedBlock = Node.create({
  name: "importedBlock",
  group: "block",
  atom: true,
  addAttributes() {
    return createBlockAttrs({
      blockData: { default: "{}" }
    })
  },
  parseHTML() {
    return [{ tag: 'div[data-type="importedBlock"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "importedBlock" })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImportedBlockView)
  }
})

export const LuminaCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      blockId: {
        default: () => crypto.randomUUID()
      }
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  }
})

export const InlineHighlightMark = Mark.create({
  name: "highlight",
  parseHTML() {
    return [{ tag: "mark[data-note-highlight]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "mark",
      mergeAttributes(HTMLAttributes, {
        "data-note-highlight": "true",
        class: "note-inline-highlight"
      }),
      0
    ]
  },
  addCommands() {
    return {
      toggleHighlight:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
      setHighlight:
        () =>
        ({ commands }) =>
          commands.setMark(this.name),
      unsetHighlight:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name)
    }
  }
})

export const BlockIdExtension = Extension.create({
  name: "blockIdExtension",
  addGlobalAttributes() {
    return [
      {
        types: [
          "heading",
          "paragraph",
          "quoteBlock",
          "highlightBlock",
          "insightBlock",
          "codeBlock",
          "horizontalRule",
          "importedBlock"
        ],
        attributes: {
          blockId: {
            default: () => crypto.randomUUID(),
            renderHTML: (attrs) => ({ "data-block-id": attrs.blockId })
          }
        }
      }
    ]
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(transactions, _oldState, newState) {
        if (!transactions.some((transaction) => transaction.docChanged)) {
          return null
        }
        const tr = newState.tr
        const seen = new Set<string>()
        let changed = false
        newState.doc.descendants((node, pos) => {
          const id = node.attrs.blockId
          if (!id) {
            return
          }
          if (seen.has(id)) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: crypto.randomUUID() })
            changed = true
            return
          }
          seen.add(id)
        })
        return changed ? tr : null
      }
    })]
  }
})

function QuoteBlockView(props: Parameters<typeof ReactNodeViewRenderer>[0] extends never ? never : any) {
  return (
    <NodeViewWrapper className="custom-block">
      <DecorativeBlock
        tone="quote"
        label="原文引用"
        meta={buildSourceMeta(props.node.attrs.sourceBookTitle, props.node.attrs.sourceLocation)}
        icon={<Quote className="h-3 w-3" />}
      >
        <NodeViewContent as="div" className="note-block-content note-block-quote" />
      </DecorativeBlock>
    </NodeViewWrapper>
  )
}

function HighlightBlockView(props: Parameters<typeof ReactNodeViewRenderer>[0] extends never ? never : any) {
  return (
    <NodeViewWrapper className="custom-block">
      <DecorativeBlock
        tone="highlight"
        label={props.node.attrs.label || "关键洞察"}
        meta={buildSourceMeta(props.node.attrs.sourceBookTitle, props.node.attrs.sourceLocation)}
        icon={<Highlighter className="h-3 w-3" />}
      >
        <NodeViewContent as="div" className="note-block-content note-block-highlight" />
      </DecorativeBlock>
    </NodeViewWrapper>
  )
}

function InsightBlockView(props: Parameters<typeof ReactNodeViewRenderer>[0] extends never ? never : any) {
  return (
    <NodeViewWrapper className="custom-block">
      <DecorativeBlock
        tone="insight"
        label={props.node.attrs.label || "AI 补充说明"}
        icon={<Lightbulb className="h-3 w-3" />}
      >
        <NodeViewContent as="div" className="note-block-content note-block-insight" />
      </DecorativeBlock>
    </NodeViewWrapper>
  )
}

function ImportedBlockView(props: Parameters<typeof ReactNodeViewRenderer>[0] extends never ? never : any) {
  const block = parseImportedBlock(props.node.attrs.blockData)
  if (!block) {
    return <NodeViewWrapper className="custom-block" />
  }
  return (
    <NodeViewWrapper className="custom-block">
      <div className="rounded-[18px] border border-dashed border-border/40 bg-elevated/40 px-4 py-3">
        <ImportedBlockItem block={block} />
      </div>
    </NodeViewWrapper>
  )
}

function CodeBlockView(props: Parameters<typeof ReactNodeViewRenderer>[0] extends never ? never : any) {
  const [copied, setCopied] = useState(false)
  const languages = props.extension.options.lowlight.listLanguages()
  return (
    <NodeViewWrapper className="custom-block">
      <div className="overflow-hidden rounded-[18px] border border-border/30 bg-elevated/90">
        <div className="flex items-center justify-between border-b border-border/20 px-4 py-2">
          <select
            value={props.node.attrs.language || ""}
            className="bg-transparent text-[11px] text-muted outline-none"
            onChange={(event) => props.updateAttributes({ language: event.target.value })}
          >
            <option value="">plain text</option>
            {languages.map((language: string) => (
              <option key={language} value={language}>{language}</option>
            ))}
          </select>
          <button className="note-code-copy" onClick={() => copyCode(props, setCopied, copied)}>
            <Copy className="h-3 w-3" />
            {copied ? "已复制" : "复制"}
          </button>
        </div>
        <pre className="overflow-x-auto p-4">
          <NodeViewContent as="code" className="note-code-content" />
        </pre>
      </div>
    </NodeViewWrapper>
  )
}

function DecorativeBlock({
  children,
  icon,
  label,
  meta,
  tone
}: {
  children: React.ReactNode
  icon: React.ReactNode
  label: string
  meta?: string
  tone: "quote" | "highlight" | "insight"
}) {
  return (
    <div className={`note-decorative-block note-decorative-${tone}`}>
      <div className="note-decorative-rail" />
      <div className="note-decorative-body">
        <div className="note-decorative-label">
          {icon}
          <span>{label}</span>
        </div>
        {children}
        {meta ? (
          <div className="note-decorative-meta">
            <BookOpen className="h-2.5 w-2.5" />
            <span>{meta}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function copyCode(props: { node: { textContent: string } }, setCopied: (value: boolean) => void, copied: boolean) {
  if (copied) {
    return
  }
  void navigator.clipboard.writeText(props.node.textContent || "")
  setCopied(true)
  window.setTimeout(() => setCopied(false), 1200)
}

function buildSourceMeta(title?: string, location?: string) {
  if (!title) {
    return undefined
  }
  return `来源：《${title}》${location ? ` · ${location}` : ""}`
}

function createBlockAttrs(extra: Record<string, unknown>) {
  return {
    blockId: { default: () => crypto.randomUUID() },
    ...extra
  }
}

function parseImportedBlock(blockData: unknown): NoteBlock | null {
  try {
    return JSON.parse(String(blockData ?? "{}")) as NoteBlock
  } catch {
    return null
  }
}
