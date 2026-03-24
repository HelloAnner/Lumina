/**
 * PDF 阅读降级视图
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { ReaderClientProps } from "@/components/reader/reader-types"

export function PdfReaderFallback({
  book,
  message
}: Pick<ReaderClientProps, "book"> & { message: string }) {
  return (
    <div className="min-h-screen bg-base px-8 py-8">
      <div className="mx-auto max-w-5xl">
        <Link
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
          href="/library"
        >
          <ArrowLeft className="h-4 w-4" />
          返回书库
        </Link>
        <div className="rounded-2xl border border-border/60 bg-surface p-6">
          <div className="text-lg font-medium text-foreground">{book.title}</div>
          <div className="mt-2 text-sm leading-7 text-secondary">{message}</div>
        </div>
        {book.content.length > 0 ? (
          <div className="mt-6 space-y-6">
            {book.content.map((section) => (
              <section key={section.id} className="rounded-2xl border border-border/60 bg-surface p-6">
                <h2 className="mb-3 text-base font-medium text-foreground">
                  {section.title}
                </h2>
                <div className="whitespace-pre-wrap text-sm leading-7 text-reader-text">
                  {section.content}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
