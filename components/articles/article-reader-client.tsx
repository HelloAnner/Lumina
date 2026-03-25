/**
 * 文章阅读器
 * 将 ScoutArticle 内容渲染为可阅读的段落视图
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ChevronUp,
  ExternalLink,
  Highlighter
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Toast } from "@/components/ui/toast"
import { cn } from "@/src/lib/utils"
import type { ScoutArticle, ArticleSection, HighlightColor } from "@/src/server/store/types"

interface Props {
  article: ScoutArticle
}

const HIGHLIGHT_COLORS: { value: HighlightColor; bg: string }[] = [
  { value: "yellow", bg: "bg-yellow-500/20" },
  { value: "green", bg: "bg-green-500/20" },
  { value: "blue", bg: "bg-blue-500/20" },
  { value: "pink", bg: "bg-pink-500/20" },
]

export function ArticleReaderClient({ article }: Props) {
  const router = useRouter()
  const [toast, setToast] = useState<{ title: string; tone: "success" | "error" } | null>(null)
  const [selectedText, setSelectedText] = useState("")

  const handleHighlight = useCallback(async (color: HighlightColor) => {
    if (!selectedText) {
      return
    }
    try {
      const res = await fetch(`/api/articles/${article.id}/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: selectedText, color })
      })
      if (res.ok) {
        setToast({ title: "高亮已保存", tone: "success" })
        setSelectedText("")
        window.getSelection()?.removeAllRanges()
      }
    } catch {
      setToast({ title: "保存失败", tone: "error" })
    }
  }, [selectedText, article.id])

  const handleTextSelect = useCallback(() => {
    const sel = window.getSelection()
    if (sel && sel.toString().trim().length > 0) {
      setSelectedText(sel.toString().trim())
    }
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 顶栏 */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/articles")}
            className="h-7 px-2"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            返回
          </Button>
          <span className="text-[13px] text-muted line-clamp-1 max-w-[400px]">
            {article.title}
          </span>
        </div>
        {article.sourceUrl && (
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[12px] text-muted hover:text-primary transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            原文
          </a>
        )}
      </header>

      {/* 选中工具栏 */}
      {selectedText && (
        <div className="absolute top-14 right-4 z-20 flex items-center gap-1 rounded-lg border border-border bg-card p-1.5 shadow-lg">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => handleHighlight(c.value)}
              className={cn(
                "h-6 w-6 rounded-md transition-opacity hover:opacity-80",
                c.bg
              )}
            />
          ))}
        </div>
      )}

      {/* 阅读区域 */}
      <div
        className="flex-1 overflow-y-auto"
        onMouseUp={handleTextSelect}
      >
        <article className="mx-auto max-w-[680px] px-6 py-10">
          {/* 文章标题 */}
          <h1 className="mb-4 text-[24px] font-semibold leading-tight text-foreground">
            {article.title}
          </h1>

          {/* 元信息 */}
          <div className="mb-8 flex items-center gap-3 text-[13px] text-muted">
            {article.author && <span>{article.author}</span>}
            {article.channelName && <span>{article.channelName}</span>}
            {article.publishedAt && (
              <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
            )}
          </div>

          {/* 正文 */}
          {article.content.map((section, i) => (
            <SectionBlock key={section.id || i} section={section} />
          ))}
        </article>
      </div>

      {toast && (
        <Toast
          title={toast.title}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

function SectionBlock({ section }: { section: ArticleSection }) {
  switch (section.type) {
    case "heading":
      if (section.level === 1) {
        return <h2 className="mb-4 mt-8 text-[20px] font-semibold text-foreground">{section.text}</h2>
      }
      if (section.level === 2) {
        return <h3 className="mb-3 mt-6 text-[17px] font-medium text-foreground">{section.text}</h3>
      }
      return <h4 className="mb-2 mt-4 text-[15px] font-medium text-foreground">{section.text}</h4>

    case "paragraph":
      return (
        <p className="mb-4 text-[15px] leading-[1.75] text-foreground/90">
          {section.text}
        </p>
      )

    case "blockquote":
      return (
        <blockquote className="mb-4 border-l-2 border-primary/30 pl-4 text-[14px] italic text-muted">
          {section.text}
        </blockquote>
      )

    case "code":
      return (
        <pre className="mb-4 overflow-x-auto rounded-lg bg-overlay/60 p-4 text-[13px]">
          <code>{section.text}</code>
        </pre>
      )

    case "image":
      return (
        <figure className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={section.src}
            alt={section.alt ?? ""}
            className="max-w-full rounded-lg"
          />
          {section.alt && (
            <figcaption className="mt-1 text-center text-[12px] text-muted">
              {section.alt}
            </figcaption>
          )}
        </figure>
      )

    case "list":
      return (
        <ul className="mb-4 ml-5 list-disc text-[15px] leading-[1.75] text-foreground/90">
          {section.items?.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )

    default:
      return null
  }
}
