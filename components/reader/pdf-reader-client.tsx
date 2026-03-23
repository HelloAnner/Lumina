/**
 * PDF 阅读器页面容器
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Toast } from "@/components/ui/toast"
import { ReaderSidebar } from "@/components/reader/reader-sidebar"
import { ReaderSelectionToolbar } from "@/components/reader/reader-selection-toolbar"
import { ReaderNoteComposer } from "@/components/reader/reader-note-composer"
import { PdfPageView } from "@/components/reader/pdf-page-view"
import { PdfHighlightPanel } from "@/components/reader/pdf-highlight-panel"
import { PdfReaderFallback } from "@/components/reader/pdf-reader-fallback"
import type { ReaderClientProps } from "@/components/reader/reader-types"
import { usePdfReaderController } from "@/components/reader/use-pdf-reader-controller"

export function PdfReaderClient(props: ReaderClientProps) {
  const reader = usePdfReaderController(props)

  if (reader.fallbackMessage) {
    return <PdfReaderFallback book={props.book} message={reader.fallbackMessage} />
  }

  return (
    <div className="h-screen overflow-hidden bg-base">
      {reader.toast ? (
        <Toast title={reader.toast} tone="success" onClose={() => reader.setToast("")} />
      ) : null}

      <div className="flex h-14 items-center justify-between border-b border-border/60 bg-surface px-5">
        <div className="flex items-center gap-4 text-sm">
          <Link className="flex items-center gap-2 text-muted transition-colors hover:text-foreground" href="/library">
            <ArrowLeft className="h-4 w-4" />
            书库
          </Link>
          <span className="h-4 w-px bg-border/60" />
          <span className="font-medium text-foreground">{reader.book.title}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          {reader.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-secondary/60" />}
          {reader.currentPageIndex + 1} / {reader.pageCount}
        </div>
      </div>

      <div className="flex h-[calc(100vh-52px)]">
        <ReaderSidebar
          width={reader.tocWidth}
          nodes={reader.sidebarEntries}
          activeIndex={reader.currentPageIndex}
          onNavigate={reader.goPage}
          itemRefs={reader.tocItemRefs}
          onResizeStart={reader.createResizeHandler(
            reader.tocWidth,
            reader.setTocWidth,
            { min: 200, max: 420 }
          )}
        />

        <main ref={reader.readerMainRef} className="relative min-w-0 flex-1 overflow-hidden bg-reader-sidebar">
          <ReaderSelectionToolbar
            selectionRect={reader.selectionRect}
            onHighlight={() => reader.createHighlight("yellow")}
            onNote={() => reader.setComposerOpen(true)}
          />

          <div ref={reader.scrollContainerRef} className="h-full overflow-y-auto px-8 py-8" onScroll={reader.handleScroll}>
            <div className="mx-auto max-w-[980px]">
              {reader.pageNumbers.map((pageNumber) => (
                <PdfPageView
                  key={pageNumber}
                  pdfDocument={reader.pdfDocument}
                  pageNumber={pageNumber}
                  highlights={reader.highlightsByPage.get(pageNumber) ?? []}
                  onPageMouseUp={reader.handlePageMouseUp}
                  pageRef={(element) => reader.setPageRef(pageNumber - 1, element)}
                />
              ))}
            </div>
          </div>
        </main>

        <PdfHighlightPanel
          width={reader.highlightsWidth}
          items={reader.panelItems}
          currentPageIndex={reader.currentPageIndex}
          onOpenHighlight={reader.openHighlight}
          onResizeStart={reader.createResizeHandler(
            reader.highlightsWidth,
            reader.setHighlightsWidth,
            { min: 260, max: 480 },
            true
          )}
        />
      </div>

      <ReaderNoteComposer
        open={reader.composerOpen}
        selectedText={reader.selectedText}
        noteDraft={reader.noteDraft}
        onChange={reader.setNoteDraft}
        onCancel={() => reader.setComposerOpen(false)}
        onSave={() => reader.createHighlight("yellow", reader.noteDraft)}
      />
    </div>
  )
}
