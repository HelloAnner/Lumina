/**
 * EPUB 阅读器页面容器
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Toast } from "@/components/ui/toast"
import { ReaderSidebar } from "@/components/reader/reader-sidebar"
import { ReaderSelectionToolbar } from "@/components/reader/reader-selection-toolbar"
import { ReaderContent } from "@/components/reader/reader-content"
import { ReaderFontPanel } from "@/components/reader/reader-font-panel"
import { ReaderHighlightPanel } from "@/components/reader/reader-highlight-panel"
import { ReaderNoteComposer } from "@/components/reader/reader-note-composer"
import type { ReaderClientProps } from "@/components/reader/reader-types"
import { useReaderController } from "@/components/reader/use-reader-controller"

export function EpubReaderClient(props: ReaderClientProps) {
  const reader = useReaderController(props)

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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs tabular-nums">
            <span className="text-muted">{Math.round(((reader.pageIndex + 1) / Math.max(reader.book.content.length, 1)) * 100)}%</span>
            <span className="text-secondary">{reader.pageIndex + 1}</span>
            <span className="text-muted">/</span>
            <span className="text-secondary">{reader.book.content.length}</span>
          </div>
        </div>
      </div>
      <div className="h-[2px] w-full bg-transparent">
        <div
          className="h-full bg-primary/60 transition-all duration-150"
          style={{ width: `${((reader.pageIndex + 1) / Math.max(reader.book.content.length, 1)) * 100}%` }}
        />
      </div>

      <div className="flex h-[calc(100vh-58px)]">
        <ReaderSidebar
          width={reader.tocWidth}
          nodes={reader.sidebarEntries}
          activeIndex={reader.pageIndex}
          onNavigate={reader.goSection}
          itemRefs={reader.tocItemRefs}
          onResizeStart={reader.createResizeHandler(
            reader.tocWidth,
            reader.setTocWidth,
            { min: 200, max: 420 }
          )}
        />

        <main
          ref={reader.readerMainRef}
          className="relative min-w-0 flex-1 overflow-hidden bg-surface"
          onWheel={reader.handleWheel}
        >
          <ReaderSelectionToolbar
            selectionRect={reader.selectionRect}
            onHighlight={() => reader.createHighlight("yellow")}
            onNote={() => reader.setComposerOpen(true)}
          />

          <ReaderContent
            book={reader.book}
            isVertical={reader.isVertical}
            currentSection={reader.currentSection}
            currentParagraphs={reader.currentParagraphs}
            pageIndex={reader.pageIndex}
            safeParagraphIndex={reader.safeParagraphIndex}
            visibleParagraphs={reader.visibleParagraphs}
            fontSize={reader.fontSize}
            lineHeight={reader.lineHeight}
            letterSpacing={reader.letterSpacing}
            scrollContainerRef={reader.scrollContainerRef}
            sectionRefs={reader.sectionRefs}
            paragraphRefs={reader.paragraphRefs}
            onScroll={reader.handleScroll}
            onParagraphMouseUp={reader.handleMouseUp}
            renderParagraphContent={reader.renderParagraphContent}
          />

          <ReaderFontPanel
            open={reader.showFontPanel}
            fontPanelRef={reader.fontPanelRef}
            fontSize={reader.fontSize}
            lineHeight={reader.lineHeight}
            letterSpacing={reader.letterSpacing}
            onFontSizeChange={reader.setFontSize}
            onLineHeightChange={reader.setLineHeight}
            onLetterSpacingChange={reader.setLetterSpacing}
            onToggle={() => reader.setShowFontPanel((current) => !current)}
          />
        </main>

        <ReaderHighlightPanel
          width={reader.highlightsWidth}
          items={reader.groupedHighlights}
          currentPageIndex={reader.currentSection?.pageIndex}
          resolvedHighlights={reader.resolvedHighlights}
          onOpenHighlight={reader.openHighlight}
          onDeleteHighlight={reader.deleteHighlight}
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
