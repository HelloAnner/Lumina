/**
 * 阅读翻译请求工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import { decryptValue } from "@/src/server/lib/crypto"
import type { ModelConfig } from "@/src/server/store/types"

const DEFAULT_MAX_BATCH_PARAGRAPHS = 8
const DEFAULT_MAX_BATCH_CHARS = 1800

interface TranslationBatch {
  startIndex: number
  paragraphs: string[]
}

interface TranslationBatchOptions {
  maxParagraphs?: number
  maxChars?: number
}

type TranslationFetcher = typeof fetch

function buildPayloadItems(paragraphs: string[]) {
  return paragraphs.map((text, index) => ({
    index,
    text
  }))
}

function shouldStartNewBatch(
  currentParagraphs: string[],
  currentChars: number,
  paragraph: string,
  options: Required<TranslationBatchOptions>
) {
  if (currentParagraphs.length === 0) {
    return false
  }
  if (currentParagraphs.length >= options.maxParagraphs) {
    return true
  }
  return currentChars + paragraph.length > options.maxChars
}

export function buildTranslationBatches(
  paragraphs: string[],
  options: TranslationBatchOptions = {}
) {
  const resolvedOptions = {
    maxParagraphs: options.maxParagraphs ?? DEFAULT_MAX_BATCH_PARAGRAPHS,
    maxChars: options.maxChars ?? DEFAULT_MAX_BATCH_CHARS
  }
  const batches: TranslationBatch[] = []
  let startIndex = 0
  let currentParagraphs: string[] = []
  let currentChars = 0

  paragraphs.forEach((paragraph, index) => {
    if (shouldStartNewBatch(currentParagraphs, currentChars, paragraph, resolvedOptions)) {
      batches.push({ startIndex, paragraphs: currentParagraphs })
      startIndex = index
      currentParagraphs = []
      currentChars = 0
    }
    currentParagraphs.push(paragraph)
    currentChars += paragraph.length
  })

  if (currentParagraphs.length > 0) {
    batches.push({ startIndex, paragraphs: currentParagraphs })
  }
  return batches
}

export function buildModelRequest(
  paragraphs: string[],
  model: ModelConfig,
  targetLanguage: string
) {
  return {
    url: `${model.baseUrl.replace(/\/$/, "")}/chat/completions`,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${decryptValue(model.apiKey)}`
    },
    body: {
      model: model.modelName,
      messages: [
        {
          role: "system",
          content: `你是专业图书翻译助手。请把输入数组逐段翻译为 ${targetLanguage}，保持一一对应，不要合并、删减、解释或补充。只输出 JSON，格式为 {"items":[{"index":0,"translation":"..."}]}。`
        },
        {
          role: "user",
          content: JSON.stringify({
            targetLanguage,
            items: buildPayloadItems(paragraphs)
          })
        }
      ],
      stream: false
    }
  }
}

function extractJsonText(content: string) {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }
  const objectMatch = content.match(/\{[\s\S]*\}/)
  return objectMatch?.[0] ?? content.trim()
}

function ensureParsedItems(
  items: unknown,
  expectedCount: number
) {
  if (!Array.isArray(items) || items.length !== expectedCount) {
    throw new Error("模型未返回完整翻译结果")
  }
  return [...items]
    .sort((left, right) => Number((left as { index: number }).index) - Number((right as { index: number }).index))
    .map((item, expectedIndex) => {
      const index = Number((item as { index: number }).index)
      const translation = String((item as { translation: string }).translation ?? "").trim()
      if (index !== expectedIndex || !translation) {
        throw new Error("模型返回的翻译结果顺序或内容无效")
      }
      return translation
    })
}

function parseTranslatedParagraphs(content: string, expectedCount: number) {
  const parsed = JSON.parse(extractJsonText(content)) as {
    items?: Array<{ index: number; translation: string }>
  }
  return ensureParsedItems(parsed.items, expectedCount)
}

function looksLikeHtmlDocument(content: string) {
  return /^\s*<!doctype html/i.test(content) || /^\s*<html/i.test(content)
}

export async function extractModelMessageContent(response: Response) {
  const rawText = await response.text()
  if (looksLikeHtmlDocument(rawText)) {
    throw new Error("翻译服务返回了页面内容，请检查 Base URL 是否填写到兼容 OpenAI 的 /v1 接口。")
  }
  try {
    const data = JSON.parse(rawText)
    return data.choices?.[0]?.message?.content ?? ""
  } catch {
    throw new Error("翻译模型返回内容无法解析，请检查模型网关返回格式。")
  }
}

async function requestTranslatedBatch(
  paragraphs: string[],
  model: ModelConfig,
  targetLanguage: string,
  fetcher: TranslationFetcher
) {
  const request = buildModelRequest(paragraphs, model, targetLanguage)
  const response = await fetcher(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body)
  })
  if (!response.ok) {
    throw new Error("翻译模型调用失败")
  }
  const content = await extractModelMessageContent(response)
  return parseTranslatedParagraphs(content, paragraphs.length)
}

export async function requestTranslatedParagraphs(
  paragraphs: string[],
  model: ModelConfig,
  targetLanguage: string,
  fetcher: TranslationFetcher = fetch,
  options?: TranslationBatchOptions
) {
  if (paragraphs.length === 0) {
    return []
  }
  const batches = buildTranslationBatches(paragraphs, options)
  const translated: string[] = []

  for (const batch of batches) {
    const batchResult = await requestTranslatedBatch(
      batch.paragraphs,
      model,
      targetLanguage,
      fetcher
    )
    translated.push(...batchResult)
  }
  return translated
}
