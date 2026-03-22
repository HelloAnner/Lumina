"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Lightbulb,
  ListTree
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Toast } from "@/components/ui/toast"
import type { Book, Highlight, ReaderSettings } from "@/src/server/store/types"

const COLORS = {
  yellow: "rgba(251,191,36,0.35)",
  green: "rgba(52,211,153,0.35)",
  blue: "rgba(96,165,250,0.35)",
  pink: "rgba(244,114,182,0.35)"
} as const

export function ReaderClient({
  book,
  highlights,
  settings
}: {
  book: Book
  highlights: Highlight[]
  settings?: ReaderSettings
}) {
  const [pageIndex, setPageIndex] = useState(0)
  const [selectedText, setSelectedText] = useState("")
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [composerOpen, setComposerOpen] = useState(false)
  const [panelItems, setPanelItems] = useState(highlights)
  const [toast, setToast] = useState("")

  const currentSection = book.content[pageIndex] ?? book.content[0]
  const direction = settings?.navigationMode ?? "horizontal"

  useEffect(() => {
    const progress = (pageIndex + 1) / Math.max(book.content.length, 1)
    fetch(`/api/books/${book.id}/progress`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ progress })
    }).catch(() => undefined)
  }, [book.content.length, book.id, pageIndex])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (direction === "horizontal") {
        if (event.key === "ArrowRight" || event.key === " ") {
          setPageIndex((current) => Math.min(book.content.length - 1, current + 1))
        }
        if (event.key === "ArrowLeft") {
          setPageIndex((current) => Math.max(0, current - 1))
        }
      } else {
        if (event.key === "ArrowDown" || event.key === " ") {
          setPageIndex((current) => Math.min(book.content.length - 1, current + 1))
        }
        if (event.key === "ArrowUp") {
          setPageIndex((current) => Math.max(0, current - 1))
        }
      }
    }
    window.addEventListener("keydown", handleKeydown)
    return () => window.removeEventListener("keydown", handleKeydown)
  }, [book.content.length, direction])

  const groupedHighlights = useMemo(
    () => panelItems.filter((item) => item.pageIndex === currentSection?.pageIndex || !item.pageIndex),
    [currentSection?.pageIndex, panelItems]
  )

  async function createHighlight(color: keyof typeof COLORS, note?: string) {
    if (!selectedText) {
      return
    }
    const response = await fetch("/api/highlights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookId: book.id,
        format: book.format,
        pageIndex: currentSection.pageIndex,
        content: selectedText,
        note,
        color
      })
    })
    const data = await response.json()
    if (response.ok) {
      setPanelItems((current) => [data.item, ...current])
      setToast(note ? "想法已记录" : "高亮已添加")
    }
    setSelectedText("")
    setSelectionRect(null)
    setComposerOpen(false)
    setNoteDraft("")
    window.getSelection()?.removeAllRanges()
  }

  function handleMouseUp() {
    const selection = window.getSelection()
    const text = selection?.toString().trim() ?? ""
    if (!text || !selection || selection.rangeCount === 0) {
      setSelectedText("")
      setSelectionRect(null)
      return
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    setSelectedText(text)
    setSelectionRect({
      top: rect.top + window.scrollY - 54,
      left: rect.left + window.scrollX + rect.width / 2 - 54
    })
  }

  return (
    <div className="h-screen overflow-hidden bg-base">
      {toast ? <Toast title={toast} tone="success" onClose={() => setToast("")} /> : null}
      <div className="flex h-[52px] items-center justify-between border-b border-border bg-surface px-5">
        <div className="flex items-center gap-4 text-sm text-secondary">
          <Link className="flex items-center gap-2 hover:text-foreground" href="/library">
            <ArrowLeft className="h-4 w-4" />
            书库
          </Link>
          <span>{book.title}</span>
        </div>
        <div className="text-xs text-secondary">
          {pageIndex + 1} / {book.content.length}
        </div>
      </div>

      <div className="grid h-[calc(100vh-52px)] grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="border-r border-border bg-[#0D0D0F]">
          <div className="flex h-12 items-center gap-2 border-b border-border px-4 text-sm font-medium">
            <ListTree className="h-4 w-4 text-primary" />
            目录
          </div>
          <div className="space-y-1 p-2">
            {book.toc.map((item, index) => (
              <button
                key={item.id}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                  index === pageIndex
                    ? "bg-elevated text-foreground"
                    : "text-secondary hover:bg-overlay hover:text-foreground"
                }`}
                onClick={() => setPageIndex(index)}
              >
                <span className="truncate">{item.title}</span>
                <span className="ml-2 text-xs">{index + 1}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="relative flex h-full items-center justify-center overflow-hidden bg-[#0D0D0F]">
          {selectionRect ? (
            <div
              className="absolute z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3 py-2 shadow-panel"
              style={{ top: selectionRect.top, left: selectionRect.left }}
            >
              <button
                className="rounded-full bg-primary/15 p-2 text-primary transition hover:bg-primary/20"
                onClick={() => createHighlight("yellow")}
                title="高亮"
              >
                <Highlighter className="h-4 w-4" />
              </button>
              <button
                className="rounded-full bg-elevated p-2 text-foreground transition hover:bg-overlay"
                onClick={() => setComposerOpen(true)}
                title="想法"
              >
                <Lightbulb className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="absolute inset-y-0 left-0 flex items-center pl-4">
            <Button
              variant="ghost"
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            >
              {direction === "horizontal" ? (
                <ChevronLeft className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5 rotate-90" />
              )}
            </Button>
          </div>

          <div className="h-full w-full max-w-4xl px-14 py-12">
            <div className="mx-auto flex h-full max-w-3xl flex-col justify-center">
              <div className="rounded-[28px] border border-white/6 bg-[#111113] px-14 py-16 shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
                <h1 className="mb-10 text-[28px] font-semibold leading-tight text-foreground">
                  {currentSection?.title ?? book.title}
                </h1>
                <div
                  className="space-y-8 text-[19px] leading-[2.15] text-[#F5F5F5] selection:bg-amber-300/40"
                  onMouseUp={handleMouseUp}
                >
                  {currentSection?.content
                    .split(/\n+/)
                    .filter(Boolean)
                    .map((paragraph, index) => (
                      <p key={`${currentSection.id}-${index}`}>{paragraph}</p>
                    ))}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute inset-y-0 right-0 flex items-center pr-4">
            <Button
              variant="ghost"
              onClick={() =>
                setPageIndex((current) => Math.min(book.content.length - 1, current + 1))
              }
            >
              {direction === "horizontal" ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5 rotate-90" />
              )}
            </Button>
          </div>
        </main>

        <aside className="border-l border-border bg-surface">
          <div className="flex h-12 items-center justify-between border-b border-border px-4 text-sm">
            <span>划线与想法</span>
            <span>{panelItems.length}</span>
          </div>
          <div className="h-[calc(100%-48px)] space-y-3 overflow-y-auto p-4">
            {groupedHighlights.map((item) => (
              <Card key={item.id} className="space-y-3 p-4">
                <div
                  className="rounded-md px-3 py-2 text-sm leading-6 text-foreground"
                  style={{ backgroundColor: COLORS[item.color] }}
                >
                  {item.content}
                </div>
                {item.note ? (
                  <div className="text-sm leading-6 text-secondary">{item.note}</div>
                ) : null}
              </Card>
            ))}
          </div>
        </aside>
      </div>

      {composerOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45">
          <Card className="w-full max-w-xl space-y-4 p-6">
            <div className="text-lg font-medium">记录想法</div>
            <div className="rounded-xl bg-elevated px-4 py-3 text-sm leading-6 text-foreground">
              {selectedText}
            </div>
            <Textarea
              placeholder="写下你此刻的理解、联想或问题……"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setComposerOpen(false)}>
                取消
              </Button>
              <Button onClick={() => createHighlight("yellow", noteDraft)}>保存想法</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
