/**
 * 阅读器正文渲染
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import type React from "react"
import { buildParagraphLayouts } from "@/components/reader/reader-highlight-utils"
import type { Book, ReaderSettings } from "@/src/server/store/types"

export function ReaderContent({
  book,
  isVertical,
  currentSection,
  currentParagraphs,
  pageIndex,
  safeParagraphIndex,
  visibleParagraphs,
  fontSize,
  lineHeight,
  letterSpacing,
  scrollContainerRef,
  sectionRefs,
  paragraphRefs,
  onScroll,
  onParagraphMouseUp,
  renderParagraphContent
}: {
  book: Book
  isVertical: boolean
  currentSection: Book["content"][number]
  currentParagraphs: string[]
  pageIndex: number
  safeParagraphIndex: number
  visibleParagraphs: ReturnType<typeof buildParagraphLayouts>
  fontSize: ReaderSettings["fontSize"]
  lineHeight: ReaderSettings["lineHeight"]
  letterSpacing: number
  scrollContainerRef: React.RefObject<HTMLDivElement>
  sectionRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>
  paragraphRefs: React.MutableRefObject<Record<string, HTMLParagraphElement | null>>
  onScroll: () => void
  onParagraphMouseUp: () => void
  renderParagraphContent: (
    paragraphText: string,
    paragraphStart: number,
    sectionIndex: number
  ) => React.ReactNode
}) {
  if (isVertical) {
    return (
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto px-12 py-10"
        onScroll={onScroll}
      >
        <div className="mx-auto max-w-2xl space-y-12">
          {book.content.map((section, sectionIndex) => {
            const paragraphs = buildParagraphLayouts(section.content)
            return (
              <div
                key={section.id}
                ref={(element) => {
                  sectionRefs.current[sectionIndex] = element
                }}
                data-section-index={sectionIndex}
              >
                <h2 className="mb-8 text-lg font-medium text-foreground">
                  {section.title}
                </h2>
                <div
                  className="text-reader-text selection:bg-amber-300/40"
                  style={{
                    fontSize,
                    lineHeight,
                    letterSpacing: `${letterSpacing}em`
                  }}
                >
                  {paragraphs.map((paragraph) => (
                    <p
                      key={`${section.id}-${paragraph.index}`}
                      ref={(element) => {
                        paragraphRefs.current[`${sectionIndex}-${paragraph.index}`] = element
                      }}
                      className="mb-5"
                      onMouseUp={onParagraphMouseUp}
                      data-section-index={sectionIndex}
                      data-paragraph-start={paragraph.start}
                    >
                      {renderParagraphContent(
                        paragraph.text,
                        paragraph.start,
                        sectionIndex
                      )}
                    </p>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full px-8 py-12">
      <div className="mx-auto flex h-full max-w-2xl flex-col justify-center">
        <div className="max-w-2xl">
          <h1 className="mb-10 text-xl font-medium text-foreground">
            {currentSection?.title ?? book.title}
          </h1>
          <div
            className="text-reader-text selection:bg-amber-300/40"
            style={{
              fontSize,
              lineHeight,
              letterSpacing: `${letterSpacing}em`
            }}
          >
            {visibleParagraphs.map((paragraph) => (
              <p
                key={`${currentSection.id}-${paragraph.index}`}
                className="mb-5"
                onMouseUp={onParagraphMouseUp}
                data-section-index={pageIndex}
                data-paragraph-start={paragraph.start}
              >
                {renderParagraphContent(paragraph.text, paragraph.start, pageIndex)}
              </p>
            ))}
          </div>
          <div className="mt-12 flex items-center justify-between text-xs text-secondary">
            <span>
              第 {pageIndex + 1} 章 · 段落{" "}
              {Math.min(safeParagraphIndex + 1, Math.max(1, currentParagraphs.length))}
            </span>
            <span>滚轮或触控板切换章节</span>
          </div>
        </div>
      </div>
    </div>
  )
}
