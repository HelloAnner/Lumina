/**
 * 书籍正文规整工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: `"`,
  apos: "'",
  nbsp: " "
}

const BLOCK_TAG_PATTERN =
  /<\/?(address|article|aside|blockquote|body|caption|div|dl|dt|dd|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|html|main|nav|p|pre|section|table|tbody|thead|tfoot|tr)[^>]*>/gi

function collapseInlineSpaces(value: string) {
  return value.replace(/[ \t\f\v]+/g, " ").trim()
}

function splitDenseParagraph(paragraph: string) {
  const compact = collapseInlineSpaces(paragraph)
  if (!compact || compact.length < 30) {
    return compact ? [compact] : []
  }

  const sentences =
    compact.match(/[^。！？!?；;]+[。！？!?；;]?/g)?.map((item) => item.trim()).filter(Boolean) ??
    []
  if (sentences.length < 4) {
    return [compact]
  }

  const chunks: string[] = []
  let buffer = ""
  let sentenceCount = 0

  sentences.forEach((sentence) => {
    buffer += sentence
    sentenceCount += 1
    if ((buffer.length >= 32 && sentenceCount >= 2) || buffer.length >= 60) {
      chunks.push(buffer)
      buffer = ""
      sentenceCount = 0
    }
  })

  if (buffer) {
    chunks.push(buffer)
  }

  return chunks.length > 1 ? chunks : [compact]
}

export function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : full
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : full
    }
    return NAMED_ENTITIES[entity] ?? full
  })
}

export function normalizeStoredSectionContent(content: string) {
  const normalized = decodeHtmlEntities(content)
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")

  const blocks = normalized
    .split(/\n{2,}/)
    .flatMap((block) => {
      const lines = block
        .split("\n")
        .map((line) => collapseInlineSpaces(line))
        .filter(Boolean)

      if (lines.length === 0) {
        return []
      }
      if (lines.length > 1) {
        return [lines.join("\n")]
      }
      return splitDenseParagraph(lines[0])
    })

  return blocks.join("\n\n").trim()
}

export function extractReadableTextFromHtml(html: string) {
  const withBreaks = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "")
    .replace(BLOCK_TAG_PATTERN, "\n\n")

  const withoutTags = withBreaks.replace(/<[^>]+>/g, " ")
  return normalizeStoredSectionContent(withoutTags)
}
