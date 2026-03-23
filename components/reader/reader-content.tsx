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
import type {
  Book,
  ReaderSectionBlock,
  ReaderSettings
} from "@/src/server/store/types"

interface RenderableBlock {
  key: string
  type: ReaderSectionBlock["type"]
  text?: string
  start?: number
  paragraphIndex?: number
  src?: string
  alt?: string
  width?: number
  height?: number
}

function buildRenderableBlocks(section: Book["content"][number]): RenderableBlock[] {
  if (!section.blocks?.length) {
    return buildParagraphLayouts(section.content).map((paragraph) => ({
      key: `${section.id}-${paragraph.index}`,
      type: "paragraph" as const,
      text: paragraph.text,
      start: paragraph.start,
      paragraphIndex: paragraph.index
    }))
  }

  const paragraphs = buildParagraphLayouts(section.content)
  let paragraphCursor = 0
  const renderableBlocks: RenderableBlock[] = []
  section.blocks.forEach((block, blockIndex) => {
    if (block.type === "image") {
      renderableBlocks.push({
        key: `${section.id}-image-${blockIndex}`,
        type: "image",
        src: block.src,
        alt: block.alt,
        width: block.width,
        height: block.height
      })
      return
    }

    const paragraph = paragraphs[paragraphCursor]
    paragraphCursor += 1
    if (!paragraph) {
      return
    }
    renderableBlocks.push({
      key: `${section.id}-${paragraph.index}`,
      type: "paragraph",
      text: paragraph.text,
      start: paragraph.start,
      paragraphIndex: paragraph.index
    })
  })
  return renderableBlocks
}

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
  function renderBlock(
    block: RenderableBlock,
    sectionIndex: number
  ) {
    if (block.type === "image") {
      return (
        <div
          key={block.key}
          className="my-6 flex justify-center"
        >
          <img
            src={block.src}
            alt={block.alt ?? "章节插图"}
            width={block.width}
            height={block.height}
            className="max-h-[70vh] max-w-full rounded-lg border border-border/50 bg-surface/40 object-contain"
            draggable={false}
          />
        </div>
      )
    }

    return (
      <p
        key={block.key}
        ref={(element) => {
          if (typeof block.paragraphIndex === "number") {
            paragraphRefs.current[`${sectionIndex}-${block.paragraphIndex}`] = element
          }
        }}
        className="mb-5"
        onMouseUp={onParagraphMouseUp}
        data-section-index={sectionIndex}
        data-paragraph-start={block.start}
      >
        {renderParagraphContent(block.text ?? "", block.start ?? 0, sectionIndex)}
      </p>
    )
  }

  if (isVertical) {
    return (
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto px-12 py-10"
        onScroll={onScroll}
      >
        <div className="mx-auto max-w-2xl space-y-12">
          {book.content.map((section, sectionIndex) => {
            const blocks = buildRenderableBlocks(section)
            return (
              <div
                key={section.id}
                ref={(element) => {
                  sectionRefs.current[sectionIndex] = element
                }}
                data-section-index={sectionIndex}
              >
                {sectionIndex > 0 ? (
                  <div className="mb-8 border-t border-border/60" />
                ) : null}
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
                  {blocks.map((block) => renderBlock(block, sectionIndex))}
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
            {currentSection.blocks?.length
              ? buildRenderableBlocks(currentSection).map((block) => renderBlock(block, pageIndex))
              : visibleParagraphs.map((paragraph) => (
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
