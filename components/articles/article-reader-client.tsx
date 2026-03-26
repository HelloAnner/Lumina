/**
 * 文章阅读器
 * 三栏布局：左侧大纲、中间正文（支持划词高亮/翻译）、右侧高亮面板
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  ExternalLink,
  Languages,
  Moon,
  PanelLeftOpen,
  PanelRightOpen,
  RefreshCw,
  Star,
  Sun,
  Type
} from "lucide-react"
import { ShareLinkButton } from "@/components/share/share-link-button"
import { cn } from "@/src/lib/utils"
import { Toast } from "@/components/ui/toast"
import { ReaderSelectionToolbar } from "@/components/reader/reader-selection-toolbar"
import { ReaderHighlightPanel } from "@/components/reader/reader-highlight-panel"
import { ReaderNoteComposer } from "@/components/reader/reader-note-composer"
import { ReaderFontPanel } from "@/components/reader/reader-font-panel"
import { ArticleReaderContent } from "@/components/articles/article-reader-content"
import { formatArticlePublishedAt } from "@/components/articles/article-published-at"
import {
  readGuestArticleOutlineCollapsed,
  saveGuestArticleOutlineCollapsed
} from "@/components/reader/reader-width-storage"
import {
  useArticleReaderController,
  type ArticleReaderProps
} from "@/components/articles/use-article-reader-controller"
import { useReaderShortcuts } from "@/components/reader/use-reader-shortcuts"
import { useTheme } from "@/components/theme-provider"

export function ArticleReaderClient(props: ArticleReaderProps) {
  const reader = useArticleReaderController(props)
  const readOnly = props.sharedView?.readOnly ?? false
  const { theme, setTheme } = useTheme()
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [highlightsCollapsed, setHighlightsCollapsed] = useState(false)

  useEffect(() => {
    if (!readOnly) {
      return
    }
    setOutlineCollapsed(readGuestArticleOutlineCollapsed())
  }, [readOnly])

  useEffect(() => {
    if (!readOnly) {
      return
    }
    saveGuestArticleOutlineCollapsed(outlineCollapsed)
  }, [outlineCollapsed, readOnly])

  const { showShortcutHint, dismissShortcutHint } = useReaderShortcuts({
    selectedText: reader.selectedText,
    shortcuts: props.settings?.highlightShortcuts,
    keyboardShortcuts: props.settings?.keyboardShortcuts,
    onHighlight: reader.createHighlight,
    onNote: () => reader.setComposerOpen(true)
  })

  /** 阅读器主题变更时同步全局 light/dark class */
  function handleReaderThemeChange(t: typeof reader.readerTheme) {
    reader.setReaderTheme(t)
    if (t === "night") {
      setTheme("dark")
    } else if (t === "day") {
      setTheme("light")
    }
  }

  // 把全局 toggleTheme 也保留（顶栏月亮/太阳按钮）
  function toggleTheme() {
    if (theme === "light") {
      setTheme("dark")
      reader.setReaderTheme("night")
    } else {
      setTheme("light")
      reader.setReaderTheme("day")
    }
  }

  return (
    <div className={cn("flex h-screen flex-col overflow-hidden bg-reader-sidebar", reader.readerTheme === "sepia" && "sepia")}>
      {reader.toast && !/失败|错误|请检查/.test(reader.toast) ? (
        <Toast
          title={reader.toast}
          tone="success"
          onClose={() => reader.setToast("")}
        />
      ) : null}

      {/* 顶部导航栏 48px */}
      <div className="flex min-h-12 items-center justify-between border-b border-border/60 bg-elevated px-5 py-2">
        <div className="mr-4 flex items-center gap-3">
          <Link
            className="flex shrink-0 items-center gap-1.5 text-muted transition-colors hover:text-foreground"
            href="/articles"
          >
            <ArrowLeft className="h-[15px] w-[15px]" />
            <span className="text-[13px]">文章库</span>
          </Link>
          <span className="h-4 w-px shrink-0 bg-border/60" />
          <span className="text-[14px] font-medium leading-snug text-foreground">
            {reader.displayTitle}
          </span>
          {formatArticlePublishedAt(reader.article.publishedAt) ? (
            <span className="text-[11px] text-muted">
              {formatArticlePublishedAt(reader.article.publishedAt)}
            </span>
          ) : null}
          {readOnly ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              共享查看 · {props.sharedView?.ownerName}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
          {!readOnly ? (
            <button
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition",
                reader.article.favorite
                  ? "text-amber-300 hover:bg-overlay"
                  : "text-muted hover:bg-overlay hover:text-amber-200"
              )}
              onClick={reader.toggleFavorite}
              title={reader.article.favorite ? "取消收藏" : "收藏"}
            >
              <Star className={cn("h-4 w-4", reader.article.favorite && "fill-current")} />
            </button>
          ) : null}
          {!readOnly ? (
            <ShareLinkButton
              resourceType="article"
              resourceId={reader.article.id}
              onToast={reader.setToast}
            />
          ) : null}
          {reader.article.sourceUrl && (
            <>
              {!readOnly ? (
                <button
                  onClick={reader.handleRefetch}
                  disabled={reader.refetching}
                  title="重新拉取文章"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-overlay hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", reader.refetching && "animate-spin")} />
                </button>
              ) : null}
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(reader.article.sourceUrl)
                  reader.setToast("链接已复制")
                }}
                title="复制原文链接"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-overlay hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <a
                href={reader.article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="查看原文"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-overlay hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          )}
          <span className="text-xs tabular-nums text-muted">
            {reader.scrollProgress}%
          </span>
        </div>
      </div>

      {/* 阅读进度条 2px */}
      <div className="h-[2px] w-full overflow-hidden bg-border/40">
        {reader.isTranslating ? (
          <div className="h-full w-1/4 animate-indeterminate-slide bg-primary/80" />
        ) : (
          <div
            className="h-full bg-primary transition-all duration-150"
            style={{ width: `${reader.scrollProgress}%` }}
          />
        )}
      </div>

      {/* 主体三栏 */}
      <div className="flex min-h-0 flex-1">
        {/* 左侧大纲 */}
        {!outlineCollapsed && reader.outlineEntries.length > 0 && (
          <aside
            className="relative flex shrink-0 flex-col border-r border-border/60 bg-elevated"
            style={{ width: reader.outlineWidth }}
          >
            <div className="flex h-9 items-center justify-between px-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">大纲</span>
              <button
                className="flex h-5 w-5 items-center justify-center rounded text-muted hover:text-foreground transition"
                onClick={() => setOutlineCollapsed(true)}
              >
                <PanelLeftOpen className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {reader.outlineEntries.map((entry) => (
                <button
                  key={entry.index}
                  className="block w-full rounded-md px-2 py-1.5 text-left text-[12px] leading-relaxed text-secondary transition hover:bg-overlay hover:text-foreground"
                  style={{ paddingLeft: `${8 + (entry.level - 1) * 12}px` }}
                  onClick={() => {
                    const el = reader.scrollContainerRef.current?.querySelector(
                      `[data-article-section-index="${entry.index}"]`
                    ) as HTMLElement | null
                    el?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }}
                >
                  {entry.title}
                </button>
              ))}
            </div>
            <div
              className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-secondary/30"
              onMouseDown={reader.createResizeHandler(
                reader.outlineWidth,
                reader.setOutlineWidth,
                { min: 180, max: 360 }
              )}
            />
          </aside>
        )}

        {/* 中间正文区 */}
        <main
          ref={reader.readerMainRef}
          className="relative min-w-0 flex-1 overflow-hidden bg-reader-sidebar"
        >
          {/* 大纲收起时的浮动展开按钮 */}
          {outlineCollapsed && reader.outlineEntries.length > 0 && (
            <button
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex h-14 w-7 items-center justify-center rounded-r-lg border border-l-0 border-border/60 bg-reader-card text-muted shadow-md transition hover:text-foreground"
              onClick={() => setOutlineCollapsed(false)}
              title="展开大纲"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </button>
          )}
          {/* 高亮面板收起时的浮动展开按钮 */}
          {highlightsCollapsed && (
            <button
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex h-14 w-7 items-center justify-center rounded-l-lg border border-r-0 border-border/60 bg-reader-card text-muted shadow-md transition hover:text-foreground"
              onClick={() => setHighlightsCollapsed(false)}
              title="展开划线面板"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
            </button>
          )}

          {!readOnly ? (
            <ReaderSelectionToolbar
              selectionRect={reader.selectionRect}
              onHighlight={(color) => reader.createHighlight(color)}
              onNote={() => reader.setComposerOpen(true)}
            />
          ) : null}

          <ArticleReaderContent
            sections={reader.displayContent}
            fontSize={reader.fontSize}
            lineHeight={reader.lineHeight}
            fontFamily={reader.fontFamily}
            letterSpacing={reader.letterSpacing}
            scrollContainerRef={reader.scrollContainerRef}
            paragraphRefs={reader.paragraphRefs}
            onScroll={reader.handleScroll}
            onParagraphMouseUp={reader.handleMouseUp}
            renderParagraphContent={reader.renderParagraphContent}
            onImageCollect={(input) => {
              void reader.createImageHighlight(input, false)
            }}
            onImageTransfer={(input) => {
              void reader.createImageHighlight(input, true)
            }}
          />

          {/* 翻译失败提示 */}
          {reader.translationError ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
              <div className="mx-4 flex max-w-sm flex-col items-center gap-3 rounded-xl border border-error/30 bg-surface p-6 shadow-xl">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10">
                  <AlertTriangle className="h-5 w-5 text-error" />
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
            fontFamily={reader.fontFamily}
            readerTheme={reader.readerTheme}
            translationView={reader.translationView}
            onFontSizeChange={reader.setFontSize}
            onLineHeightChange={reader.setLineHeight}
            onLetterSpacingChange={reader.setLetterSpacing}
            onFontFamilyChange={reader.setFontFamily}
            onReaderThemeChange={handleReaderThemeChange}
            onToggleTranslation={reader.toggleTranslationView}
          />
        </main>

        {/* 右侧高亮面板 */}
        {!readOnly ? (
          <ReaderHighlightPanel
            width={reader.highlightsWidth}
            collapsed={highlightsCollapsed}
            items={reader.groupedHighlights}
            resolvedHighlights={reader.resolvedHighlights}
            readOnly={readOnly}
            onOpenHighlight={reader.openHighlight}
            onEditHighlight={reader.openHighlightNoteComposer}
            onDeleteHighlight={reader.deleteHighlight}
            onToggleCollapse={() => setHighlightsCollapsed(true)}
            onResizeStart={reader.createResizeHandler(
              reader.highlightsWidth,
              (w) => reader.setHighlightsWidth(w),
              { min: 260, max: 480 },
              true
            )}
          />
        ) : null}
      </div>

      {!readOnly ? (
        <ReaderNoteComposer
          open={reader.composerOpen}
          selectedText={reader.selectedText}
          noteDraft={reader.noteDraft}
          onChange={reader.setNoteDraft}
          onCancel={() => {
            reader.setComposerOpen(false)
            reader.setEditingHighlightId(null)
          }}
          onSave={reader.saveNote}
        />
      ) : null}

      {/* 快捷键提示条 */}
      {showShortcutHint && (
        <div className="absolute inset-x-0 bottom-6 z-40 flex justify-center" onClick={dismissShortcutHint}>
          <div className="flex items-center gap-4 rounded-full border border-border/40 bg-surface/95 px-5 py-2.5 shadow-panel backdrop-blur-sm">
            <span className="flex items-center gap-1.5 text-xs text-secondary">
              <kbd className="rounded bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-foreground">1</kbd>
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            </span>
            <span className="flex items-center gap-1.5 text-xs text-secondary">
              <kbd className="rounded bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-foreground">2</kbd>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="flex items-center gap-1.5 text-xs text-secondary">
              <kbd className="rounded bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-foreground">3</kbd>
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
            </span>
            <span className="flex items-center gap-1.5 text-xs text-secondary">
              <kbd className="rounded bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-foreground">4</kbd>
              <span className="h-2.5 w-2.5 rounded-full bg-pink-400" />
            </span>
            <span className="h-3 w-px bg-border/40" />
            <span className="flex items-center gap-1.5 text-xs text-secondary">
              <kbd className="rounded bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-foreground">N</kbd>
              笔记
            </span>
            <span className="h-3 w-px bg-border/40" />
            <span className="text-[11px] text-muted">按 ? 关闭</span>
          </div>
        </div>
      )}
    </div>
  )
}
