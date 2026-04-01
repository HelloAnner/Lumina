/**
 * PDF 阅读器页面容器
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  Languages,
  Loader2,
  Moon,
  PanelLeftOpen,
  PanelRightOpen,
  Sun,
  Type
} from "lucide-react"
import { ShareLinkButton } from "@/components/share/share-link-button"
import { Switch } from "@/components/ui/switch"
import { Toast } from "@/components/ui/toast"
import { ReaderSidebar } from "@/components/reader/reader-sidebar"
import { ReaderSelectionToolbar } from "@/components/reader/reader-selection-toolbar"
import { ReaderContent } from "@/components/reader/reader-content"
import { ReaderFontPanel } from "@/components/reader/reader-font-panel"
import { ReaderHighlightPanel } from "@/components/reader/reader-highlight-panel"
import { ReaderNoteComposer } from "@/components/reader/reader-note-composer"
import { PdfPageView } from "@/components/reader/pdf-page-view"
import { PdfHighlightPanel } from "@/components/reader/pdf-highlight-panel"
import {
  readGuestReaderNotesCollapsed,
  readGuestReaderTocCollapsed,
  saveGuestReaderNotesCollapsed,
  saveGuestReaderTocCollapsed
} from "@/components/reader/reader-width-storage"
import { usePdfReaderController } from "@/components/reader/use-pdf-reader-controller"
import { useReaderController } from "@/components/reader/use-reader-controller"
import type { ReaderClientProps } from "@/components/reader/reader-types"
import { useTheme } from "@/components/theme-provider"

type PdfDisplayMode = "parsed" | "source"

function PdfSourcePlaceholder({
  title,
  message
}: {
  title: string
  message: string
}) {
  return (
    <div className="flex h-full items-center justify-center px-8 py-8">
      <div className="w-full max-w-3xl rounded-2xl border border-border/60 bg-surface p-6">
        <div className="text-lg font-medium text-foreground">{title}</div>
        <div className="mt-2 text-sm leading-7 text-secondary">{message}</div>
      </div>
    </div>
  )
}

export function PdfReaderClient(props: ReaderClientProps) {
  const readOnly = props.sharedView?.readOnly ?? false
  const [mode, setMode] = useState<PdfDisplayMode>("parsed")
  const [parsedBook, setParsedBook] = useState(props.book)
  const [isBackfillingImages, setIsBackfillingImages] = useState(false)
  const [pageImageAttempted, setPageImageAttempted] = useState(false)
  const [tocCollapsed, setTocCollapsed] = useState(props.initialLayout.outlineCollapsed)
  const [highlightsCollapsed, setHighlightsCollapsed] = useState(
    props.initialLayout.notesCollapsed
  )
  const layoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const layoutReadyRef = useRef(false)
  const parsedReader = useReaderController({
    ...props,
    book: parsedBook
  })
  const sourceReader = usePdfReaderController(props)
  const needsPageImages = useMemo(
    () =>
      !parsedBook.content.some((section) =>
        section.blocks?.some((block) => block.type === "image")
      ),
    [parsedBook.content]
  )

  useEffect(() => {
    setParsedBook(props.book)
    setPageImageAttempted(false)
  }, [props.book])

  useEffect(() => {
    if (!readOnly) {
      return
    }
    setTocCollapsed(readGuestReaderTocCollapsed())
    setHighlightsCollapsed(readGuestReaderNotesCollapsed())
  }, [readOnly])

  useEffect(() => {
    if (!layoutReadyRef.current) {
      layoutReadyRef.current = true
      return
    }
    if (layoutTimerRef.current) {
      clearTimeout(layoutTimerRef.current)
    }
    layoutTimerRef.current = setTimeout(() => {
      if (readOnly) {
        saveGuestReaderTocCollapsed(tocCollapsed)
        saveGuestReaderNotesCollapsed(highlightsCollapsed)
        return
      }
      void fetch("/api/preferences/reader-layout", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resourceType: "book",
          resourceId: props.book.id,
          outlineCollapsed: tocCollapsed,
          notesCollapsed: highlightsCollapsed
        })
      })
    }, 180)
    return () => {
      if (layoutTimerRef.current) {
        clearTimeout(layoutTimerRef.current)
      }
    }
  }, [highlightsCollapsed, props.book.id, readOnly, tocCollapsed])

  useEffect(() => {
    if (readOnly || !needsPageImages || isBackfillingImages || pageImageAttempted) {
      return
    }
    let disposed = false
    setIsBackfillingImages(true)
    setPageImageAttempted(true)
    fetch(`/api/books/${props.book.id}/pdf-page-images/rebuild`, {
      method: "POST"
    })
      .then(async (response) => {
        if (!response.ok) {
          return null
        }
        return response.json()
      })
      .then((data) => {
        if (!disposed && data?.item) {
          setParsedBook(data.item)
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!disposed) {
          setIsBackfillingImages(false)
        }
      })

    return () => {
      disposed = true
    }
  }, [isBackfillingImages, needsPageImages, pageImageAttempted, props.book.id, readOnly])

  const isSourceMode = mode === "source"
  const activeToast = isSourceMode ? sourceReader.toast : parsedReader.toast
  const activeSidebarWidth = isSourceMode ? sourceReader.tocWidth : parsedReader.tocWidth
  const activeSidebarEntries = isSourceMode
    ? sourceReader.sidebarEntries
    : parsedReader.sidebarEntries
  const activeSidebarIndex = isSourceMode
    ? sourceReader.currentPageIndex
    : parsedReader.pageIndex
  const activeSidebarRefs = isSourceMode ? sourceReader.tocItemRefs : parsedReader.tocItemRefs
  const activeHighlightsWidth = isSourceMode
    ? sourceReader.highlightsWidth
    : parsedReader.highlightsWidth
  const progressPercent = isSourceMode
    ? Math.round(
        ((sourceReader.currentPageIndex + 1) / Math.max(sourceReader.pageCount, 1)) * 100
      )
    : Math.round(
        ((parsedReader.pageIndex + 1) / Math.max(parsedReader.book.content.length, 1)) * 100
      )
  const progressCurrent = isSourceMode
    ? sourceReader.currentPageIndex + 1
    : parsedReader.pageIndex + 1
  const progressTotal = isSourceMode
    ? sourceReader.pageCount
    : parsedReader.book.content.length

  const { theme, setTheme } = useTheme()

  function toggleMode() {
    setMode((current) => (current === "parsed" ? "source" : "parsed"))
  }

  function toggleTheme() {
    setTheme(theme === "light" ? "dark" : "light")
  }

  return (
    <div className="h-screen overflow-hidden bg-reader-sidebar">
      {activeToast && !/失败|错误|请检查/.test(activeToast) ? (
        <Toast
          title={activeToast}
          tone="success"
          onClose={() => {
            if (isSourceMode) {
              sourceReader.setToast("")
              return
            }
            parsedReader.setToast("")
          }}
        />
      ) : null}

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
          <span className="text-[14px] font-medium text-foreground">
            {isSourceMode ? sourceReader.book.title : parsedReader.book.title}
          </span>
          {readOnly ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              共享查看 · {props.sharedView?.ownerName}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {!isSourceMode ? (
            <>
              <button
                className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
                  parsedReader.translationView === "translation"
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-overlay hover:text-foreground"
                }`}
                onClick={parsedReader.toggleTranslationView}
                title={parsedReader.translationView === "translation" ? "切换到原文" : "切换到译文"}
              >
                <Languages className="h-3.5 w-3.5" />
                {parsedReader.translationView === "translation" ? "译文" : "原文"}
              </button>
              <button
                className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                  parsedReader.showFontPanel
                    ? "bg-elevated text-foreground"
                    : "text-muted hover:bg-elevated hover:text-foreground"
                }`}
                onClick={() => parsedReader.setShowFontPanel((prev) => !prev)}
                title="字体设置"
              >
                <Type className="h-[15px] w-[15px]" />
              </button>
              <span className="h-4 w-px bg-border/60" />
            </>
          ) : null}
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-overlay hover:text-foreground"
            onClick={toggleTheme}
            title="切换主题"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          {!readOnly ? (
            <ShareLinkButton
              resourceType="book"
              resourceId={props.book.id}
              onToast={(message) => {
                if (isSourceMode) {
                  sourceReader.setToast(message)
                  return
                }
                parsedReader.setToast(message)
              }}
            />
          ) : null}
          <Switch
            checked={isSourceMode}
            onCheckedChange={toggleMode}
            title={isSourceMode ? "切换到解析模式" : "切换到原文模式"}
          />
          <span className="text-xs tabular-nums text-muted">
            {isSourceMode && sourceReader.loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>{progressPercent}%&nbsp;&nbsp;·&nbsp;&nbsp;{progressCurrent} / {progressTotal}</>
            )}
          </span>
        </div>
      </div>
      <div className="h-[2px] w-full bg-border/40">
        <div
          className="h-full bg-primary transition-all duration-150"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex h-[calc(100vh-50px)]">
        <ReaderSidebar
          width={activeSidebarWidth}
          collapsed={tocCollapsed}
          nodes={activeSidebarEntries}
          activeIndex={activeSidebarIndex}
          onNavigate={isSourceMode ? sourceReader.goPage : parsedReader.goSection}
          itemRefs={activeSidebarRefs}
          onToggleCollapse={() => setTocCollapsed(true)}
          onResizeStart={
            isSourceMode
              ? sourceReader.createResizeHandler(
                  sourceReader.tocWidth,
                  sourceReader.setTocWidth,
                  { min: 200, max: 420 }
                )
              : parsedReader.createResizeHandler(
                  parsedReader.tocWidth,
                  parsedReader.setTocWidth,
                  { min: 200, max: 420 }
                )
          }
        />

        <main
          ref={isSourceMode ? sourceReader.readerMainRef : parsedReader.readerMainRef}
          className="relative min-w-0 flex-1 overflow-hidden bg-reader-sidebar"
          onWheel={isSourceMode ? undefined : parsedReader.handleWheel}
        >
          {tocCollapsed && (
            <button
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex h-14 w-7 items-center justify-center rounded-r-lg border border-l-0 border-border/60 bg-reader-card text-muted shadow-md transition hover:text-foreground"
              onClick={() => setTocCollapsed(false)}
              title="展开目录"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </button>
          )}
          {highlightsCollapsed && (
            <button
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex h-14 w-7 items-center justify-center rounded-l-lg border border-r-0 border-border/60 bg-reader-card text-muted shadow-md transition hover:text-foreground"
              onClick={() => setHighlightsCollapsed(false)}
              title="展开划线面板"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
            </button>
          )}
          {isSourceMode ? (
            <>
              {!readOnly ? (
                <ReaderSelectionToolbar
                  selectionRect={sourceReader.selectionRect}
                  onHighlight={(color) => sourceReader.createHighlight(color)}
                  onNote={() => sourceReader.setComposerOpen(true)}
                />
              ) : null}
              {sourceReader.fallbackMessage ? (
                <PdfSourcePlaceholder
                  title={sourceReader.book.title}
                  message={sourceReader.fallbackMessage}
                />
              ) : (
                <div
                  ref={sourceReader.scrollContainerRef}
                  className="h-full overflow-y-auto px-8 py-8"
                  onScroll={sourceReader.handleScroll}
                >
                  <div className="mx-auto max-w-[980px]">
                    {sourceReader.pageNumbers.map((pageNumber) => (
                      <PdfPageView
                        key={pageNumber}
                        pdfDocument={sourceReader.pdfDocument}
                        pageNumber={pageNumber}
                        highlights={sourceReader.highlightsByPage.get(pageNumber) ?? []}
                        boxSelectionEnabled={sourceReader.boxSelectionEnabled}
                        onPageMouseUp={sourceReader.handlePageMouseUp}
                        onPageBoxSelect={sourceReader.handlePageBoxSelect}
                        pageRef={(element) => sourceReader.setPageRef(pageNumber - 1, element)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {!readOnly ? (
                <ReaderSelectionToolbar
                  selectionRect={parsedReader.selectionRect}
                  onHighlight={(color) => parsedReader.createHighlight(color)}
                  onNote={() => parsedReader.setComposerOpen(true)}
                />
              ) : null}
              <ReaderContent
                book={parsedReader.book}
                displayContent={parsedReader.displayContent}
                isVertical={parsedReader.isVertical}
                currentSection={parsedReader.currentSection}
                currentParagraphs={parsedReader.currentParagraphs}
                pageIndex={parsedReader.pageIndex}
                safeParagraphIndex={parsedReader.safeParagraphIndex}
                visibleParagraphs={parsedReader.visibleParagraphs}
                fontSize={parsedReader.fontSize}
                lineHeight={parsedReader.lineHeight}
                letterSpacing={parsedReader.letterSpacing}
                scrollContainerRef={parsedReader.scrollContainerRef}
                sectionRefs={parsedReader.sectionRefs}
                paragraphRefs={parsedReader.paragraphRefs}
                onScroll={parsedReader.handleScroll}
                onParagraphMouseUp={parsedReader.handleMouseUp}
                renderParagraphContent={parsedReader.renderParagraphContent}
                onImageCollect={(input) => {
                  void parsedReader.createImageHighlight(input, false)
                }}
                onImageTransfer={(input) => {
                  void parsedReader.createImageHighlight(input, true)
                }}
              />

              {/* 翻译失败中间提示 */}
              {parsedReader.translationError ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                  <div className="mx-4 flex max-w-sm flex-col items-center gap-3 rounded-xl border border-error/30 bg-surface p-6 shadow-xl">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10">
                      <AlertTriangle className="h-5 w-5 text-error" />
                    </div>
                    <p className="text-center text-sm font-medium text-foreground">翻译失败</p>
                    <p className="text-center text-xs leading-5 text-secondary">{parsedReader.translationError}</p>
                    <button
                      className="mt-1 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white transition hover:bg-primary/90"
                      onClick={parsedReader.clearTranslationError}
                    >
                      知道了
                    </button>
                  </div>
                </div>
              ) : null}
              <ReaderFontPanel
                open={parsedReader.showFontPanel}
                fontPanelRef={parsedReader.fontPanelRef}
                fontSize={parsedReader.fontSize}
                lineHeight={parsedReader.lineHeight}
                letterSpacing={parsedReader.letterSpacing}
                translationView={parsedReader.translationView}
                isCurrentSectionTranslating={parsedReader.isCurrentSectionTranslating}
                onFontSizeChange={parsedReader.setFontSize}
                onLineHeightChange={parsedReader.setLineHeight}
                onLetterSpacingChange={parsedReader.setLetterSpacing}
                onToggleTranslation={parsedReader.toggleTranslationView}
              />
            </>
          )}
        </main>

        {!readOnly && isSourceMode ? (
          <PdfHighlightPanel
            width={activeHighlightsWidth}
            collapsed={highlightsCollapsed}
            items={sourceReader.panelItems}
            currentPageIndex={sourceReader.currentPageIndex}
            readOnly={readOnly}
            onOpenHighlight={sourceReader.openHighlight}
            onEditHighlight={sourceReader.openHighlightNoteComposer}
            onDeleteHighlight={sourceReader.deleteHighlight}
            onResizeStart={sourceReader.createResizeHandler(
              sourceReader.highlightsWidth,
              sourceReader.setHighlightsWidth,
              { min: 260, max: 480 },
              true
            )}
            onToggleCollapse={() => setHighlightsCollapsed(true)}
          />
        ) : !readOnly ? (
          <ReaderHighlightPanel
            width={activeHighlightsWidth}
            collapsed={highlightsCollapsed}
            items={parsedReader.groupedHighlights}
            currentPageIndex={parsedReader.currentSection?.pageIndex}
            resolvedHighlights={parsedReader.resolvedHighlights}
            readOnly={readOnly}
            onOpenHighlight={parsedReader.openHighlight}
            onEditHighlight={parsedReader.openHighlightNoteComposer}
            onDeleteHighlight={parsedReader.deleteHighlight}
            onResizeStart={parsedReader.createResizeHandler(
              parsedReader.highlightsWidth,
              parsedReader.setHighlightsWidth,
              { min: 260, max: 480 },
              true
            )}
            onToggleCollapse={() => setHighlightsCollapsed(true)}
          />
        ) : null}
      </div>

      {!readOnly ? (
        <ReaderNoteComposer
          open={isSourceMode ? sourceReader.composerOpen : parsedReader.composerOpen}
          selectedText={isSourceMode ? sourceReader.selectedText : parsedReader.selectedText}
          noteDraft={isSourceMode ? sourceReader.noteDraft : parsedReader.noteDraft}
          onChange={isSourceMode ? sourceReader.setNoteDraft : parsedReader.setNoteDraft}
          onCancel={() => {
            if (isSourceMode) {
              sourceReader.setComposerOpen(false)
              sourceReader.setEditingHighlightId(null)
              return
            }
            parsedReader.setComposerOpen(false)
            parsedReader.setEditingHighlightId(null)
          }}
          onSave={() => {
            if (isSourceMode) {
              void sourceReader.saveNote()
              return
            }
            void parsedReader.saveNote()
          }}
        />
      ) : null}
    </div>
  )
}
