/**
 * 阅读翻译内容工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import { createHash } from "node:crypto"
import { buildFallbackParagraphBlocksFromContent } from "@/src/lib/book-content"
import type {
  Book,
  ReaderSection,
  ReaderSectionBlock,
  TocItem,
  TocTranslationItem
} from "@/src/server/store/types"

function ensureSectionBlocks(section: ReaderSection) {
  return section.blocks?.length
    ? section.blocks
    : buildFallbackParagraphBlocksFromContent(section.content)
}

export function buildSectionSourceHash(section: ReaderSection) {
  return createHash("sha1")
    .update(
      JSON.stringify({
        content: section.content,
        blocks: ensureSectionBlocks(section)
      })
    )
    .digest("hex")
}

export function buildTocSourceHash(toc: TocItem[]) {
  return createHash("sha1")
    .update(
      JSON.stringify(
        toc.map((item) => ({
          id: item.id,
          title: item.title,
          pageIndex: item.pageIndex,
          href: item.href,
          level: item.level
        }))
      )
    )
    .digest("hex")
}

export function collectSectionParagraphs(section: ReaderSection) {
  return ensureSectionBlocks(section)
    .filter((block): block is Extract<ReaderSectionBlock, { type: "paragraph" }> => {
      return block.type === "paragraph"
    })
    .map((block) => block.text)
}

export function collectTocTitles(toc: TocItem[]) {
  return toc.map((item) => item.title)
}

export function buildTranslatedSectionSnapshot(
  section: ReaderSection,
  translatedParagraphs: string[]
) {
  const sourceBlocks = ensureSectionBlocks(section)
  if (translatedParagraphs.length === 0) {
    return {
      content: section.content,
      blocks: sourceBlocks
    }
  }
  let paragraphIndex = 0

  const blocks = sourceBlocks.map((block) => {
    if (block.type === "image") {
      return block
    }
    const text = translatedParagraphs[paragraphIndex] ?? block.text
    paragraphIndex += 1
    return {
      type: "paragraph",
      text
    } satisfies ReaderSectionBlock
  })

  return {
    content: translatedParagraphs.join("\n\n"),
    blocks
  }
}

export function buildTranslatedSection(
  section: Book["content"][number],
  translated: { content: string; blocks?: ReaderSectionBlock[] } | null
) {
  if (!translated) {
    return section
  }
  return {
    ...section,
    content: translated.content,
    blocks: translated.blocks
  }
}

export function buildTranslatedTocItems(
  toc: TocItem[],
  translatedTitles: string[]
) {
  return toc.map((item, index) => ({
    id: item.id,
    title: translatedTitles[index] ?? item.title
  }) satisfies TocTranslationItem)
}
