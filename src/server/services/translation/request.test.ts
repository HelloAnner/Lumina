/**
 * 阅读翻译请求层测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import test, { mock } from "node:test"
import assert from "node:assert/strict"
import { encryptValue } from "@/src/server/lib/crypto"
import type { ModelConfig } from "@/src/server/store/types"

const demoModel: ModelConfig = {
  id: "model-1",
  userId: "user-1",
  category: "language",
  name: "翻译模型",
  baseUrl: "https://example.com/v1",
  apiKey: encryptValue("demo-key"),
  modelName: "demo-model"
}

test("buildModelRequest 会透传目标语言并保留段落索引", async () => {
  const { buildModelRequest } = await import("./request")

  const request = buildModelRequest(["First paragraph."], demoModel, "ja-JP")
  const userMessage = request.body.messages[1]
  const payload = JSON.parse(String(userMessage.content))

  assert.equal(payload.targetLanguage, "ja-JP")
  assert.deepEqual(payload.items, [
    {
      index: 0,
      text: "First paragraph."
    }
  ])
})

test("buildTranslationBatches 会按段落数和字符数拆分批次", async () => {
  const { buildTranslationBatches } = await import("./request")

  const batches = buildTranslationBatches(
    ["123456", "abcdef", "XYZ"],
    { maxParagraphs: 2, maxChars: 10 }
  )

  assert.deepEqual(batches, [
    {
      startIndex: 0,
      paragraphs: ["123456"]
    },
    {
      startIndex: 1,
      paragraphs: ["abcdef", "XYZ"]
    }
  ])
})

test("requestTranslatedParagraphs 会按批次顺序回拼结果", async () => {
  const { requestTranslatedParagraphs } = await import("./request")
  const fetchMock = mock.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ role: string; content: string }>
    }
    const payload = JSON.parse(body.messages[1]!.content) as {
      items: Array<{ index: number; text: string }>
    }
    const items = payload.items.map((item) => ({
      index: item.index,
      translation: `译文-${item.text}`
    }))

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ items })
              }
            }
          ]
        })
    } as Response
  })

  const translated = await requestTranslatedParagraphs(
    ["A", "B", "C"],
    demoModel,
    "zh-CN",
    fetchMock,
    { maxParagraphs: 2, maxChars: 20 }
  )

  assert.deepEqual(translated, ["译文-A", "译文-B", "译文-C"])
  assert.equal(fetchMock.mock.callCount(), 2)
})
