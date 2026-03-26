/**
 * 设置路由测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import test from "node:test"
import assert from "node:assert/strict"
import { encryptValue } from "@/src/server/lib/crypto"
import { repository } from "@/src/server/repositories"
import type { ModelConfig, ShareEndpointConfig } from "@/src/server/store/types"

import app from "./settings"

test("POST /models/test 会发送 hello 并在语言模型返回正常内容时通过", async (context) => {
  context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), "https://example.com/v1/chat/completions")
    assert.equal(init?.method, "POST")
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ role: string; content: string }>
    }
    assert.deepEqual(body.messages, [{ role: "user", content: "hello" }])

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "hello"
            }
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  })

  const response = await app.request("/models/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "demo",
      baseUrl: "https://example.com/v1",
      apiKey: "demo-key",
      modelName: "demo-model",
      category: "language"
    })
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { success: true })
})

test("POST /models/test 遇到语言模型空回包时不允许通过", async (context) => {
  context.mock.method(globalThis, "fetch", async () => {
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: ""
            }
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  })

  const response = await app.request("/models/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "demo",
      baseUrl: "https://example.com/v1",
      apiKey: "demo-key",
      modelName: "demo-model",
      category: "language"
    })
  })

  assert.equal(response.status, 400)
  assert.match((await response.json()).error, /language test failed/i)
})

test("POST /models/test 会返回上游语言模型的真实错误细节", async (context) => {
  context.mock.method(globalThis, "fetch", async () => {
    return new Response(
      JSON.stringify({
        error: {
          message: "Invalid API key provided: sk-demo",
          type: "invalid_request_error"
        }
      }),
      { status: 401, headers: { "content-type": "application/json" } }
    )
  })

  const response = await app.request("/models/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "demo",
      baseUrl: "https://example.com/v1",
      apiKey: "demo-key",
      modelName: "demo-model",
      category: "language"
    })
  })

  assert.equal(response.status, 400)
  assert.equal(
    (await response.json()).error,
    "language test failed (401): Invalid API key provided: sk-demo"
  )
})

test("POST /models/:id/test 会使用数据库中解密后的 apiKey", async (context) => {
  context.mock.method(repository, "listModelConfigs", () => [
    {
      id: "model-1",
      userId: "user-1",
      category: "language" as const,
      name: "demo",
      baseUrl: "https://example.com/v1",
      apiKey: encryptValue("demo-key"),
      modelName: "demo-model"
    }
  ])
  context.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal((init?.headers as Record<string, string>).authorization, "Bearer demo-key")
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "hello" } }]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  })

  const response = await app.request("/models/model-1/test", {
    method: "POST"
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { success: true })
})

test("PUT /models/:id 在 apiKey 留空时不会把已有密文再次传回保存层", async (context) => {
  const savedPayloads: Array<Record<string, unknown>> = []
  const encrypted = encryptValue("demo-key")

  context.mock.method(repository, "listModelConfigs", () => [
    {
      id: "model-1",
      userId: "user-1",
      category: "language" as const,
      name: "demo",
      baseUrl: "https://example.com/v1",
      apiKey: encrypted,
      modelName: "demo-model"
    }
  ])
  context.mock.method(
    repository,
    "saveModelConfig",
    (_userId: string, input: Omit<ModelConfig, "userId" | "id"> & { id?: string; apiKey?: string }) => {
    savedPayloads.push(input as Record<string, unknown>)
    return {
      id: "model-1",
      userId: "user-1",
      ...input
    }
    }
  )

  const response = await app.request("/models/model-1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "demo",
      baseUrl: "https://example.com/v1",
      apiKey: "",
      modelName: "demo-model",
      category: "language"
    })
  })

  assert.equal(response.status, 200)
  assert.equal(savedPayloads.length, 1)
  assert.equal(savedPayloads[0]?.apiKey, "")
})

test("GET /share-endpoint 返回全局分享地址配置", async (context) => {
  context.mock.method(repository, "getShareEndpointConfig", () => ({
    host: "192.168.31.18",
    port: 80
  }))

  const response = await app.request("/share-endpoint")

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    item: {
      host: "192.168.31.18",
      port: 80
    }
  })
})

test("PUT /share-endpoint 会保存全局分享地址配置", async (context) => {
  const savedPayloads: Array<Record<string, unknown>> = []

  context.mock.method(repository, "saveShareEndpointConfig", (input: ShareEndpointConfig) => {
    savedPayloads.push({ ...input })
    return input
  })

  const response = await app.request("/share-endpoint", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      host: "192.168.31.20",
      port: 8080
    })
  })

  assert.equal(response.status, 200)
  assert.equal(savedPayloads.length, 1)
  assert.deepEqual(savedPayloads[0], {
    host: "192.168.31.20",
    port: 8080
  })
})
