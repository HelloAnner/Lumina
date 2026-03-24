/**
 * EPUB 阅读器页面容器
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import Link from "next/link"
import { AlertTriangle, ArrowLeft, Languages, Moon, Sun, Type } from "lucide-react"
import { Toast } from "@/components/ui/toast"
import { ReaderSidebar } from "@/components/reader/reader-sidebar"
import { ReaderSelectionToolbar } from "@/components/reader/reader-selection-toolbar"
import { ReaderContent } from "@/components/reader/reader-content"
import { ReaderFontPanel } from "@/components/reader/reader-font-panel"
import { ReaderHighlightPanel } from "@/components/reader/reader-highlight-panel"
import { ReaderNoteComposer } from "@/components/reader/reader-note-composer"
import type { ReaderClientProps } from "@/components/reader/reader-types"
import { useReaderController } from "@/components/reader/use-reader-controller"
import { useTheme } from "@/components/theme-provider"

export function EpubReaderClient(props: ReaderClientProps) {
  const reader = useReaderController(props)
  const { theme, setTheme } = useTheme()

  const progress = Math.round(
    ((reader.pageIndex + 1) / Math.max(reader.book.content.length, 1)) * 100
  )
  const total = reader.book.content.length

  function toggleTheme() {
    setTheme(theme === "light" ? "dark" : "light")
  }

  return (
    <div className="h-screen overflow-hidden bg-reader-sidebar">
      {reader.toast && !/失败|错误|请检查/.test(reader.toast) ? (
        <Toast
          title={reader.toast}
          tone="success"
          onClose={() => reader.setToast("")}
        />
      ) : null}

      {/* 顶部导航栏 48px */}
      <div className="flex h-12 items-center justify-between border-b border-border/60 bg-elevated px-5">
        <div className="flex items-center gap-3">
          <Link
            className="flex items-center gap-1.5 text-muted transition-colors hover:text-foreground"
            href="/library"
          >
            <ArrowLeft className="h-[15px] w-[15px]" />
            <span className="text-[13px]">书库</span>
          </Link>
          <span className="h-4 w-px bg-border/60" />
          <span className="text-[14px] font-medium text-foreground">{reader.book.title}</span>
          {reader.currentSection?.title ? (
            <span className="hidden text-[13px] text-muted md:inline">
              ·&nbsp;&nbsp;{reader.currentSection.title}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
              reader.translationView === "translation"
                ? "bg-primary/10 text-primary"
                : "text-muted hover:bg-overlay hover:text-foreground"
            }`}
            onClick={reader.toggleTranslationView}
            title={reader.translationView === "translation" ? "切换到原文" : "切换到译文"}
          >
            <Languages className="h-3.5 w-3.5" />
            {reader.translationView === "translation" ? "译文" : "原文"}
          </button>
          <button
            className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
              reader.showFontPanel
                ? "bg-elevated text-foreground"
                : "text-muted hover:bg-elevated hover:text-foreground"
            }`}
            onClick={() => reader.setShowFontPanel((prev) => !prev)}
            title="字体设置"
          >
            <Type className="h-[15px] w-[15px]" />
          </button>
          <span className="h-4 w-px bg-border/60" />
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-overlay hover:text-foreground"
            onClick={toggleTheme}
            title="切换主题"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <span className="text-xs tabular-nums text-muted">
            {progress}%&nbsp;&nbsp;·&nbsp;&nbsp;{reader.pageIndex + 1} / {total}
          </span>
        </div>
      </div>

      {/* 阅读进度条 3px */}
      <div className="h-[3px] w-full bg-border/40">
        <div
          className="h-full bg-primary transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 主体三栏 */}
      <div className="flex h-[calc(100vh-51px)]">
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
          className="relative min-w-0 flex-1 overflow-hidden bg-reader-sidebar"
          onWheel={reader.handleWheel}
        >
          <ReaderSelectionToolbar
            selectionRect={reader.selectionRect}
            onHighlight={() => reader.createHighlight("yellow")}
            onNote={() => reader.setComposerOpen(true)}
          />

          <ReaderContent
            book={reader.book}
            displayContent={reader.displayContent}
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

          {/* 翻译失败中间提示 */}
          {reader.translationError ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
              <div className="mx-4 flex max-w-sm flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-surface p-6 shadow-xl">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-center text-sm font-medium text-foreground">翻译失败</p>
                <p className="text-center text-xs leading-5 text-secondary">{reader.translationError}</p>
                <button
                  className="mt-1 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white transition hover:bg-primary/90"
                  onClick={reader.clearTranslationError}
                >
                  知道了
                </button>
              </div>
            </div>
          ) : null}

          <ReaderFontPanel
            open={reader.showFontPanel}
            fontPanelRef={reader.fontPanelRef}
            fontSize={reader.fontSize}
            lineHeight={reader.lineHeight}
            letterSpacing={reader.letterSpacing}
            translationView={reader.translationView}
            isCurrentSectionTranslating={reader.isCurrentSectionTranslating}
            onFontSizeChange={reader.setFontSize}
            onLineHeightChange={reader.setLineHeight}
            onLetterSpacingChange={reader.setLetterSpacing}
            onToggleTranslation={reader.toggleTranslationView}
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
