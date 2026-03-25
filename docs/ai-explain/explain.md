# 模块 04：AI 即时解释（ai-explain）

> 阶段：001
> 对应 PRD：§三.1 即时理解（选中文字后触发 AI 解释/扩展）
> 对应 Tech：§四 AI 即时解释（流式）

---

## 1. 模块职责

- 阅读器中用户选中文字并点击"🤖解释"后，触发流式 AI 解释
- 透传用户自己配置的模型（BYOK：Base URL + API Key + Model Name）
- 使用 Vercel AI SDK（`ai` 包）对接任意 OpenAI 兼容接口
- 后端以 SSE（Server-Sent Events）流式返回，前端逐 token 渲染
- 解释结果展示在阅读器右侧面板中

---

## 2. 流式响应架构

```
前端（阅读器）              API Server（Hono）           用户配置的 LLM
      │                          │                           │
      │ POST /api/ai/explain     │                           │
      │ { content, context }     │                           │
      │─────────────────────────→│                           │
      │                          │ 读取用户 explain 模型配置  │
      │                          │ 解密 API Key               │
      │                          │ Vercel AI SDK streamText()  │
      │                          │──────────────────────────→│
      │                          │ ←────────── SSE 流 ───────│
      │ ←── text/event-stream ───│                           │
      │ 逐 token 渲染到右侧面板   │                           │
```

---

## 3. 后端实现

```typescript
// POST /api/ai/explain
// 需要 JWT 鉴权
// 速率限制：30次/分钟（Redis）

import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { decrypt } from '../lib/crypto'
import { getUserModelConfig } from '../lib/llm'

app.post('/api/ai/explain', async (c) => {
  const userId = c.get('userId')
  const { content, context } = await c.req.json()

  // 读取用户配置的 explain 模型
  const config = await getUserModelConfig(userId, 'explain')
  if (!config) {
    return c.json({ error: '未配置解释模型，请前往设置配置' }, 400)
  }

  const result = streamText({
    model: createOpenAI({
      baseURL: config.baseUrl,
      apiKey: decrypt(config.apiKey),
    })(config.modelName),
    messages: [
      {
        role: 'user',
        content: `请对以下文字进行深度解析和扩展：\n\n"${content}"\n\n上下文：${context || '无'}`,
      },
    ],
    maxTokens: 1000,
  })

  return result.toTextStreamResponse()  // 返回 SSE Response
})
```

---

## 4. 前端实现

### 4.1 触发条件

用户在阅读器操作菜单中点击"🤖解释"按钮，传入：
- `content`：选中的文字（高亮原文）
- `context`：选中文字周围的段落文字（提升解释准确性，最多 500 字）

### 4.2 右侧面板

```tsx
// 右侧滑出面板，显示流式输出
<ExplainPanel
  isOpen={showExplain}
  onClose={() => setShowExplain(false)}
>
  <StreamingText content={streamContent} isLoading={isStreaming} />
</ExplainPanel>
```

### 4.3 流式读取

```typescript
async function explainText(content: string, context: string) {
  const response = await fetch('/api/ai/explain', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, context }),
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    setStreamContent(prev => prev + parseSSEChunk(chunk))
  }
}
```

---

## 5. 错误处理

| 场景 | 处理方式 |
|------|---------|
| 用户未配置 explain 模型 | 返回提示文案，引导到设置页 |
| 模型 API 返回错误 | 面板显示错误信息（非崩溃） |
| 网络中断 | 面板显示"连接中断，请重试" |
| 速率超限 | 返回 429，提示用户稍后再试 |

---

## 6. API 清单

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/ai/explain` | 即时解释（SSE 流式响应） |

**请求体：**
```json
{
  "content": "选中的原文",
  "context": "周围段落上下文（可选）"
}
```

---

## 7. 验收标准

- [ ] 在阅读器中选中文字，点击"🤖解释"，右侧面板展开并开始流式输出
- [ ] 文字逐 token 渲染，无抖动，用户可随时关闭面板
- [ ] 未配置模型时，面板显示引导提示而非报错
- [ ] API Key 在传输和存储中全程加密，日志中不出现明文
- [ ] 速率限制生效：单用户 30次/分钟 超出后返回 429
