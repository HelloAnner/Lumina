/**
 * 笔记对话系统提示词
 * 引导 AI 以 JSON action 或纯文字回复
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
import type { NoteBlock } from "@/src/server/store/types"

const BASE_SYSTEM_PROMPT = `你是一个专业的知识笔记编辑助手，通过对话帮助用户优化笔记内容。

回复规则：
1. 当用户要求修改某个块时，先用文字简要说明修改思路，然后在末尾输出 JSON 代码块：
\`\`\`json
{"action":"modify","targetBlockId":"块ID","block":{完整的块对象}}
\`\`\`

2. 当用户要求新建内容时，先用文字简要说明，然后在末尾输出 JSON 代码块：
\`\`\`json
{"action":"insert","blocks":[{新块对象1},{新块对象2}]}
\`\`\`

3. 当用户只是讨论或提问时，正常用文字回复即可，不需要 JSON。

块格式要求：
- 每个块必须包含 id（使用随机 8 位字符串）、type、sortOrder 字段
- 修改时保持原块的 id 不变
- 支持的块类型：heading, paragraph, quote, highlight, insight, code, divider, chart, table, mermaid
- heading 块需要 level (1|2|3) 和 text
- paragraph 块需要 text
- chart 块需要 chartType、title、data
- table 块需要 headers、rows

保持简洁，不要过度修改用户未提及的内容。`

/**
 * 构建笔记对话系统提示词
 * 包含当前笔记块作为上下文
 */
export function buildNoteChatSystemPrompt(
  blocks: NoteBlock[],
  targetBlockId?: string
): string {
  const parts = [BASE_SYSTEM_PROMPT, "", "当前笔记内容（JSON 块数组）：", "```json"]
  parts.push(JSON.stringify(blocks, null, 2))
  parts.push("```")

  if (targetBlockId) {
    const target = blocks.find((b) => b.id === targetBlockId)
    if (target) {
      parts.push("")
      parts.push(`用户选中的块 ID：${targetBlockId}，类型：${target.type}`)
    }
  }

  return parts.join("\n")
}
