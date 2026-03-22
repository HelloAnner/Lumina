import path from "node:path"
import JSZip from "jszip"
import { XMLParser } from "fast-xml-parser"
import type { BookFormat, ReaderSection } from "@/src/server/store/types"

interface ParsedEntries {
  containerXml: string
  opfXml: string
  sections: Record<string, string>
  navXml?: string
  ncxXml?: string
}

export interface HardParsedBookMetadata {
  title: string
  author: string
  format: BookFormat
  tags: string[]
  sections: ReaderSection[]
  totalPages: number
  synopsis: string
  toc: { id: string; title: string; href?: string; pageIndex?: number }[]
}

interface DeriveBookMetadataInput {
  fileName: string
  userId: string
  hardParsed: HardParsedBookMetadata
  llmConfig:
    | null
    | {
        baseUrl: string
        apiKey: string
        modelName: string
      }
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true
})

function normalizeTextValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim()
  }
  if (typeof value === "number") {
    return String(value)
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    const preferred =
      normalizeTextValue(record["#text"]) ||
      normalizeTextValue(record.text) ||
      normalizeTextValue(record.value)
    if (preferred) {
      return preferred
    }
  }
  return ""
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function deriveSectionTitle(html: string, href: string, index: number) {
  const matched = html.match(/<h1[^>]*>(.*?)<\/h1>/i) ?? html.match(/<title[^>]*>(.*?)<\/title>/i)
  if (matched?.[1]) {
    return stripHtml(matched[1])
  }
  const fileName = path.basename(href, path.extname(href))
  return fileName || `Chapter ${index + 1}`
}

function buildNavMap(entries: ParsedEntries) {
  const navMap = new Map<string, { title: string; level: number }>()

  function walkLinks(value: any, level: number) {
    if (!value) {
      return
    }
    const nodes = ensureArray(value)
    nodes.forEach((node) => {
      const item = node?.a ?? node
      const href = normalizeTextValue(item?.href)
      const title = normalizeTextValue(item?.["#text"] ?? item?.span ?? item?.text)
      if (href && title) {
        navMap.set(href.split("#")[0], { title, level })
      }
      walkLinks(node?.ol?.li ?? node?.li, level + 1)
    })
  }

  try {
    if (entries.navXml) {
      const parsed = xmlParser.parse(entries.navXml)
      const navs = ensureArray(parsed?.html?.body?.nav)
      navs.forEach((nav) => {
        walkLinks(nav?.ol?.li ?? nav?.li, 0)
      })
    }
    if (entries.ncxXml) {
      const parsed = xmlParser.parse(entries.ncxXml)
      const navPoints = ensureArray(parsed?.ncx?.navMap?.navPoint)
      const walkNcx = (points: any[], level: number) => {
        points.forEach((point) => {
          const src = normalizeTextValue(point?.content?.src).split("#")[0]
          const title = normalizeTextValue(point?.navLabel?.text)
          if (src && title) {
            navMap.set(src, { title, level })
          }
          walkNcx(ensureArray(point?.navPoint), level + 1)
        })
      }
      walkNcx(navPoints, 0)
    }
  } catch {
    return navMap
  }

  return navMap
}

function createSynopsis(title: string, sections: ReaderSection[]) {
  const sample = sections
    .map((item) => item.content)
    .join(" ")
    .slice(0, 140)
  if (sample) {
    return sample
  }
  return `${title} 已完成基础解析，可继续在阅读器中查看与划线。`
}

function extractTitlesFromContentsSection(content: string) {
  const compact = content.replace(/\s+/g, " ").trim()
  const chapterMatches = Array.from(
    compact.matchAll(/第\s*\d+\s*章\s*[^第图片致谢注释]+/g)
  )
    .map((item) => item[0].trim())
    .filter(Boolean)

  const appendixTitles = ["图片来源", "致谢", "注释"].filter((item) =>
    compact.includes(item)
  )

  return [...chapterMatches, ...appendixTitles]
}

function deriveFallbackTitle(content: string, href: string, index: number) {
  const firstSentence = content
    .split(/(?<=[。！？.!?])/)
    .map((item) => item.trim())
    .find(Boolean)
  if (firstSentence && firstSentence.length <= 28) {
    return firstSentence
  }
  return path.basename(href, path.extname(href)) || `Chapter ${index + 1}`
}

export function parseEpubMetadataFromEntries(entries: ParsedEntries): HardParsedBookMetadata {
  const container = xmlParser.parse(entries.containerXml)
  const opf = xmlParser.parse(entries.opfXml)
  const rootfile = ensureArray(container?.container?.rootfiles?.rootfile)[0]
  const opfBasePath = rootfile?.["full-path"]
    ? path.posix.dirname(rootfile["full-path"])
    : "OEBPS"
  const metadata = opf?.package?.metadata ?? {}
  const manifestItems = ensureArray(opf?.package?.manifest?.item)
  const spineItems = ensureArray(opf?.package?.spine?.itemref)
  const manifestMap = new Map(
    manifestItems.map((item: Record<string, string>) => [item.id, item])
  )

  const title =
    normalizeTextValue(metadata?.title ?? metadata?.["dc:title"]) || "未命名书籍"
  const author =
    normalizeTextValue(metadata?.creator ?? metadata?.["dc:creator"]) || "未知作者"
  const rawSubjects = ensureArray(metadata?.subject ?? metadata?.["dc:subject"])
  const tags = rawSubjects
    .map((item) => normalizeTextValue(item))
    .filter(Boolean)
    .slice(0, 6)

  const sections: ReaderSection[] = []
  const toc: { id: string; title: string; href?: string; pageIndex?: number; level?: number }[] = []
  const navMap = buildNavMap(entries)
  const genericIndexes: number[] = []

  spineItems.forEach((spineItem: Record<string, string>, index: number) => {
    const manifestItem = manifestMap.get(spineItem.idref)
    if (!manifestItem?.href) {
      return
    }
    const fullHref = path.posix.join(opfBasePath, manifestItem.href)
    const html = entries.sections[fullHref] ?? entries.sections[manifestItem.href] ?? ""
    const navInfo =
      navMap.get(manifestItem.href) ?? navMap.get(fullHref) ?? navMap.get(path.posix.basename(manifestItem.href))
    const content = stripHtml(html)
    const derivedTitle = deriveSectionTitle(html, manifestItem.href, index)
    const sectionTitle =
      navInfo?.title ||
      (/^(text\d+|cover\d*|chapter\d+)$/i.test(derivedTitle)
        ? deriveFallbackTitle(content, manifestItem.href, index)
        : derivedTitle)
    sections.push({
      id: crypto.randomUUID(),
      title: sectionTitle,
      pageIndex: index + 1,
      content: content || `${sectionTitle} 暂无可渲染文本。`,
      href: manifestItem.href
    })
    toc.push({
      id: crypto.randomUUID(),
      title: sectionTitle,
      href: manifestItem.href,
      pageIndex: index + 1,
      level: navInfo?.level ?? 0
    })
    if (/^(text\d+|cover\d*|chapter\d+)$/i.test(derivedTitle)) {
      genericIndexes.push(index)
    }
  })

  const contentsSection = sections.find((item) => item.title === "目录" || item.content.includes("Contents 目录"))
  const inferredTitles = contentsSection ? extractTitlesFromContentsSection(contentsSection.content) : []
  if (inferredTitles.length > 0) {
    let inferredIndex = 0
    genericIndexes.forEach((sectionIndex) => {
      const section = sections[sectionIndex]
      const tocItem = toc[sectionIndex]
      if (!section || !tocItem) {
        return
      }
      const currentTitle = section.title
      if (currentTitle === "目录") {
        return
      }
      if (/^(Cover|text\d+|chapter\d+)$/i.test(currentTitle)) {
        const nextTitle = inferredTitles[inferredIndex]
        if (nextTitle) {
          section.title = nextTitle
          tocItem.title = nextTitle
          inferredIndex += 1
        }
      }
    })
  }

  return {
    title,
    author,
    format: "EPUB",
    tags,
    sections,
    totalPages: Math.max(sections.length, 1),
    synopsis: createSynopsis(title, sections),
    toc
  }
}

export async function extractEpubMetadata(
  buffer: Buffer,
  fileName: string
): Promise<HardParsedBookMetadata> {
  const zip = await JSZip.loadAsync(buffer)
  const containerXml = await zip.file("META-INF/container.xml")?.async("string")
  if (!containerXml) {
    return {
      title: fileName.replace(/\.epub$/i, ""),
      author: "未知作者",
      format: "EPUB",
      tags: ["EPUB"],
      sections: [
        {
          id: crypto.randomUUID(),
          title: "导入内容",
          pageIndex: 1,
          content: "该 EPUB 缺少标准 container.xml，已使用文件名完成硬解析。"
        }
      ],
      totalPages: 1,
      synopsis: "该 EPUB 缺少标准 container.xml，已使用文件名完成硬解析。",
      toc: [{ id: crypto.randomUUID(), title: "导入内容", pageIndex: 1 }]
    }
  }

  const container = xmlParser.parse(containerXml)
  const rootfile = ensureArray(container?.container?.rootfiles?.rootfile)[0]
  const opfPath = rootfile?.["full-path"]
  if (!opfPath) {
    return {
      title: fileName.replace(/\.epub$/i, ""),
      author: "未知作者",
      format: "EPUB",
      tags: ["EPUB"],
      sections: [
        {
          id: crypto.randomUUID(),
          title: "导入内容",
          pageIndex: 1,
          content: "该 EPUB 缺少 OPF 根文件路径，已完成基础硬解析。"
        }
      ],
      totalPages: 1,
      synopsis: "该 EPUB 缺少 OPF 根文件路径，已完成基础硬解析。",
      toc: [{ id: crypto.randomUUID(), title: "导入内容", pageIndex: 1 }]
    }
  }

  const opfXml = await zip.file(opfPath)?.async("string")
  if (!opfXml) {
    throw new Error("无法读取 EPUB OPF 元数据")
  }

  const sectionEntries: Record<string, string> = {}
  let navXml = ""
  let ncxXml = ""
  await Promise.all(
    Object.keys(zip.files)
      .filter((entry) => /\.(xhtml|html|htm)$/i.test(entry))
      .map(async (entry) => {
        sectionEntries[entry] = await zip.file(entry)!.async("string")
      })
  )

  await Promise.all(
    Object.keys(zip.files)
      .filter((entry) => /\.(ncx)$/i.test(entry) || /nav\.(xhtml|html)$/i.test(entry))
      .map(async (entry) => {
        const content = await zip.file(entry)!.async("string")
        if (/\.ncx$/i.test(entry)) {
          ncxXml = content
        } else {
          navXml = content
        }
      })
  )

  const hardParsed = parseEpubMetadataFromEntries({
    containerXml,
    opfXml,
    sections: sectionEntries,
    navXml,
    ncxXml
  })

  if (hardParsed.sections.length === 0) {
    hardParsed.sections.push({
      id: crypto.randomUUID(),
      title: hardParsed.title,
      pageIndex: 1,
      content: `${hardParsed.title} 已成功导入，但暂未提取到章节文本。`
    })
    hardParsed.toc.push({
      id: crypto.randomUUID(),
      title: hardParsed.title,
      pageIndex: 1
    })
    hardParsed.totalPages = 1
  }

  if (hardParsed.tags.length === 0) {
    hardParsed.tags = ["EPUB"]
  }

  return hardParsed
}

export async function deriveBookMetadata(input: DeriveBookMetadataInput) {
  const hardResult = {
    ...input.hardParsed,
    parseMode: "hard" as const,
    toastMessage: "未配置大模型，已帮你自动硬解析"
  }

  if (!input.llmConfig?.baseUrl || !input.llmConfig.apiKey || !input.llmConfig.modelName) {
    return hardResult
  }

  try {
    const response = await fetch(
      `${input.llmConfig.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${input.llmConfig.apiKey}`
        },
        body: JSON.stringify({
          model: input.llmConfig.modelName,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "你是图书元数据整理助手。请基于输入信息返回 JSON：title、author、tags。不要输出其它文本。"
            },
            {
              role: "user",
              content: JSON.stringify({
                fileName: input.fileName,
                hardParsed: {
                  title: input.hardParsed.title,
                  author: input.hardParsed.author,
                  tags: input.hardParsed.tags,
                  synopsis: input.hardParsed.synopsis
                }
              })
            }
          ]
        })
      }
    )

    if (!response.ok) {
      throw new Error(`LLM parse failed: ${response.status}`)
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    const parsed = typeof content === "string" ? JSON.parse(content) : {}

    return {
      ...input.hardParsed,
      title: parsed.title || input.hardParsed.title,
      author: parsed.author || input.hardParsed.author,
      tags: Array.isArray(parsed.tags) && parsed.tags.length > 0
        ? parsed.tags.slice(0, 8)
        : input.hardParsed.tags,
      parseMode: "llm" as const,
      toastMessage: ""
    }
  } catch {
    return {
      ...input.hardParsed,
      parseMode: "hard" as const,
      toastMessage: "模型解析失败，已回退为硬解析"
    }
  }
}
