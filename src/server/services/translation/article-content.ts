/**
 * 文章翻译内容工具
 * 提取文章文本段落、计算内容摘要、将翻译结果回填到 ArticleSection 结构
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
import { createHash } from "node:crypto"
import type { ArticleSection } from "@/src/server/store/types"

const TEXT_TYPES = new Set(["paragraph", "heading", "blockquote"])

/** 提取所有需要翻译的文本段落（保持顺序） */
export function collectArticleParagraphs(sections: ArticleSection[]): string[] {
  const result: string[] = []
  for (const section of sections) {
    if (TEXT_TYPES.has(section.type) && section.text) {
      result.push(section.text)
    } else if (section.type === "list" && section.items?.length) {
      for (const item of section.items) {
        result.push(item)
      }
    }
  }
  return result
}

/** 计算文章内容的 SHA-1 摘要 */
export function buildArticleSourceHash(sections: ArticleSection[]): string {
  return createHash("sha1")
    .update(JSON.stringify(sections.map((s) => ({ type: s.type, text: s.text, items: s.items }))))
    .digest("hex")
}

/** 将翻译后的文本段落回填到原始 ArticleSection[] 结构 */
export function buildTranslatedArticleSections(
  original: ArticleSection[],
  translatedParagraphs: string[]
): ArticleSection[] {
  let cursor = 0
  return original.map((section) => {
    if (TEXT_TYPES.has(section.type) && section.text) {
      const translated = translatedParagraphs[cursor] ?? section.text
      cursor++
      return { ...section, text: translated }
    }
    if (section.type === "list" && section.items?.length) {
      const items = section.items.map(() => {
        const translated = translatedParagraphs[cursor] ?? ""
        cursor++
        return translated
      })
      return { ...section, items }
    }
    return section
  })
}
