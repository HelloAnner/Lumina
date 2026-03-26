/**
 * 文章阅读器正文渲染
 * 渲染 ArticleSection[] 块列表，支持高亮叠加
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import type React from "react"
import { buildArticleTextBlocks } from "@/components/articles/article-highlight-utils"
import { ImageActionBar } from "@/components/reader/image-action-bar"
import type { ArticleSection, ReaderSettings } from "@/src/server/store/types"

const FONT_FAMILY_MAP: Record<ReaderSettings["fontFamily"], string> = {
  system: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  serif: "'Noto Serif SC', 'Source Serif 4', Georgia, serif",
  sans: "Inter, 'SF Pro', -apple-system, sans-serif"
}

interface Props {
  sections: ArticleSection[]
  fontSize: ReaderSettings["fontSize"]
  lineHeight: ReaderSettings["lineHeight"]
  fontFamily?: ReaderSettings["fontFamily"]
  letterSpacing: number
  scrollContainerRef: React.RefObject<HTMLDivElement>
  paragraphRefs: React.MutableRefObject<Record<string, HTMLElement | null>>
  onScroll: () => void
  onParagraphMouseUp: () => void
  renderParagraphContent: (
    text: string,
    start: number,
    sectionIndex: number
  ) => React.ReactNode
  onImageCollect?: (input: {
    sectionIndex: number
    imageUrl: string
    imageAlt?: string
    imageObjectKey?: string
  }) => void
  onImageTransfer?: (input: {
    sectionIndex: number
    imageUrl: string
    imageAlt?: string
    imageObjectKey?: string
  }) => void
}

export function ArticleReaderContent({
  sections,
  fontSize,
  lineHeight,
  fontFamily,
  letterSpacing,
  scrollContainerRef,
  paragraphRefs,
  onScroll,
  onParagraphMouseUp,
  renderParagraphContent,
  onImageCollect,
  onImageTransfer
}: Props) {
  const textBlocks = buildArticleTextBlocks(sections)
  const textBlockMap = new Map(textBlocks.map((b) => [b.blockIndex, b]))
  let textBlockCounter = 0

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-auto bg-reader-sidebar px-8 py-8"
      onScroll={onScroll}
      onMouseUp={onParagraphMouseUp}
    >
      <div className="mx-auto max-w-[720px] rounded-xl bg-reader-card px-12 py-10 shadow-sm">
        <div
          className="text-reader-text selection:bg-[rgba(108,142,239,0.3)]"
          style={{
            fontSize,
            lineHeight,
            letterSpacing: `${letterSpacing}em`,
            fontFamily: fontFamily ? FONT_FAMILY_MAP[fontFamily] : undefined
          }}
        >
          {sections.map((section, idx) => {
            const tb = textBlockMap.get(idx)

            switch (section.type) {
              case "heading": {
                const refIdx = textBlockCounter++
                const Tag = section.level === 1 ? "h2" : section.level === 2 ? "h3" : "h4"
                const cls =
                  section.level === 1
                    ? "mb-4 mt-8 text-[20px] font-semibold text-foreground"
                    : section.level === 2
                      ? "mb-3 mt-6 text-[17px] font-medium text-foreground"
                      : "mb-2 mt-4 text-[15px] font-medium text-foreground"
                return (
                  <Tag
                    key={section.id}
                    ref={(el) => { paragraphRefs.current[`0-${refIdx}`] = el }}
                    data-article-section-index={idx}
                    data-article-section-id={section.id}
                    data-section-index={0}
                    data-paragraph-start={tb?.start ?? 0}
                    className={cls}
                  >
                    {tb ? renderParagraphContent(section.text ?? "", tb.start, 0) : section.text}
                  </Tag>
                )
              }

              case "paragraph": {
                const refIdx = textBlockCounter++
                return (
                  <p
                    key={section.id}
                    ref={(el) => { paragraphRefs.current[`0-${refIdx}`] = el }}
                    data-article-section-index={idx}
                    data-article-section-id={section.id}
                    data-section-index={0}
                    data-paragraph-start={tb?.start ?? 0}
                    className="mb-4 text-[15px] leading-[1.75] text-foreground/90"
                  >
                    {tb ? renderParagraphContent(section.text ?? "", tb.start, 0) : section.text}
                  </p>
                )
              }

              case "blockquote": {
                const refIdx = textBlockCounter++
                return (
                  <blockquote
                    key={section.id}
                    ref={(el) => { paragraphRefs.current[`0-${refIdx}`] = el }}
                    data-article-section-index={idx}
                    data-article-section-id={section.id}
                    data-section-index={0}
                    data-paragraph-start={tb?.start ?? 0}
                    className="mb-4 border-l-2 border-primary/30 pl-4 text-[14px] italic text-muted"
                  >
                    {tb ? renderParagraphContent(section.text ?? "", tb.start, 0) : section.text}
                  </blockquote>
                )
              }

              case "list": {
                if (!section.items?.length) {
                  return null
                }
                return (
                  <ul key={section.id} className="mb-4 ml-5 list-disc text-[15px] leading-[1.75] text-foreground/90">
                    {section.items.map((item, i) => {
                      const refIdx = textBlockCounter++
                      const itemTb = textBlocks.find((b) => b.blockIndex === idx && b.text.includes(item))
                      return (
                        <li
                          key={i}
                          ref={(el) => { paragraphRefs.current[`0-${refIdx}`] = el }}
                          data-article-section-index={idx}
                          data-article-section-id={section.id}
                          data-section-index={0}
                          data-paragraph-start={itemTb?.start ?? 0}
                        >
                          {itemTb ? renderParagraphContent(item, itemTb.start, 0) : item}
                        </li>
                      )
                    })}
                  </ul>
                )
              }

              case "image":
                return (
                  <figure
                    key={section.id}
                    className="mb-4"
                    data-article-section-index={idx}
                    data-article-section-id={section.id}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={section.src}
                      alt={section.alt ?? ""}
                      className="max-w-full rounded-lg"
                    />
                    {onImageCollect && onImageTransfer && section.src ? (
                      <ImageActionBar
                        onCollect={() =>
                          onImageCollect({
                            sectionIndex: idx,
                            imageUrl: section.src!,
                            imageAlt: section.alt,
                            imageObjectKey: section.objectKey
                          })
                        }
                        onTransfer={() =>
                          onImageTransfer({
                            sectionIndex: idx,
                            imageUrl: section.src!,
                            imageAlt: section.alt,
                            imageObjectKey: section.objectKey
                          })
                        }
                      />
                    ) : null}
                    {section.alt && (
                      <figcaption className="mt-1 text-center text-[12px] text-muted">
                        {section.alt}
                      </figcaption>
                    )}
                  </figure>
                )

              case "code":
                return (
                  <pre
                    key={section.id}
                    className="mb-4 overflow-x-auto rounded-lg bg-overlay/60 p-4 text-[13px]"
                    data-article-section-index={idx}
                    data-article-section-id={section.id}
                  >
                    <code>{section.text}</code>
                  </pre>
                )

              default:
                return null
            }
          })}
        </div>
      </div>
    </div>
  )
}
