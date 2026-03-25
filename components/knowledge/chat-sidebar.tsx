/**
 * 笔记对话面板
 * 支持选中块针对性优化、通过对话新建块，使用流式 SSE 响应
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, MessageSquare, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/src/lib/utils"
import type {
  NoteChatAction,
  NoteChatMessage,
  NoteBlock
} from "@/src/server/store/types"
import { ChatMessage } from "./chat-message"

interface ChatSidebarProps {
  viewpointId: string | undefined
  blocks: NoteBlock[]
  selectedBlock: NoteBlock | null
  onClearBlock: () => void
  onBlocksUpdate: (blocks: NoteBlock[]) => void
}

/** 从 AI 回复中提取 JSON action */
function parseActionFromContent(content: string): {
  text: string
  action?: NoteChatAction
} {
  const match = content.match(/```json\s*([\s\S]*?)```/)
  if (!match) {
    return { text: content }
  }

  try {
    const parsed = JSON.parse(match[1].trim())
    const textBeforeJson = content.slice(0, match.index).trim()

    if (parsed.action === "modify" && parsed.targetBlockId && parsed.block) {
      return {
        text: textBeforeJson || "已生成修改建议：",
        action: {
          type: "modify",
          targetBlockId: parsed.targetBlockId,
          block: parsed.block
        }
      }
    }

    if (parsed.action === "insert" && Array.isArray(parsed.blocks)) {
      return {
        text: textBeforeJson || "已生成新内容：",
        action: {
          type: "insert",
          blocks: parsed.blocks
        }
      }
    }
  } catch {
    /* JSON 解析失败，当作纯文字 */
  }

  return { text: content }
}

/** 生成简短随机 ID */
function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * 对话面板主组件
 */
export function ChatSidebar({
  viewpointId,
  blocks,
  selectedBlock,
  onClearBlock,
  onBlocksUpdate
}: ChatSidebarProps) {
  const [messages, setMessages] = useState<NoteChatMessage[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [streamContent, setStreamContent] = useState("")
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 切换观点时清空对话
  useEffect(() => {
    setMessages([])
    setInput("")
    setStreaming(false)
    setStreamContent("")
  }, [viewpointId])

  // 自动滚到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, streamContent])

  /** 应用修改块操作 */
  const handleApplyModify = useCallback(
    (targetBlockId: string, block: NoteBlock) => {
      const updated = blocks.map((b) => (b.id === targetBlockId ? block : b))
      onBlocksUpdate(updated)
    },
    [blocks, onBlocksUpdate]
  )

  /** 应用插入块操作 */
  const handleApplyInsert = useCallback(
    (newBlocks: NoteBlock[]) => {
      const maxOrder = blocks.reduce(
        (max, b) => Math.max(max, b.sortOrder),
        0
      )
      const withOrder = newBlocks.map((b, i) => ({
        ...b,
        sortOrder: maxOrder + i + 1
      }))
      onBlocksUpdate([...blocks, ...withOrder])
    },
    [blocks, onBlocksUpdate]
  )

  /** 发送消息 */
  const sendMessage = async () => {
    if (!viewpointId || !input.trim() || streaming) {
      return
    }

    const userMsg: NoteChatMessage = {
      id: genId(),
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString()
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput("")
    setStreaming(true)
    setStreamContent("")

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/note-chat/${viewpointId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          blocks,
          targetBlockId: selectedBlock?.id
        }),
        signal: controller.signal
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "请求失败" }))
        throw new Error((err as { error?: string }).error ?? "请求失败")
      }

      // 读取 SSE 流
      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error("无法读取响应流")
      }

      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (!line.startsWith("data: ")) {
            continue
          }
          const data = line.slice(6)
          if (data === "[DONE]") {
            continue
          }

          try {
            const parsed = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[]
            }
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              accumulated += content
              setStreamContent(accumulated)
            }
          } catch {
            /* 忽略解析错误 */
          }
        }
      }

      // 流结束，解析 action 并添加 assistant 消息
      const { text, action } = parseActionFromContent(accumulated)
      const assistantMsg: NoteChatMessage = {
        id: genId(),
        role: "assistant",
        content: text,
        action,
        createdAt: new Date().toISOString()
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        const errorMsg: NoteChatMessage = {
          id: genId(),
          role: "assistant",
          content: `出错了：${(error as Error).message}`,
          createdAt: new Date().toISOString()
        }
        setMessages((prev) => [...prev, errorMsg])
      }
    } finally {
      setStreaming(false)
      setStreamContent("")
      abortRef.current = null
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 选中块上下文 */}
      {selectedBlock && (
        <div className="shrink-0 border-b border-border/40 p-3">
          <div className="flex items-start gap-2 rounded-md bg-elevated/60 p-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-secondary">
                针对块
              </span>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted line-clamp-2">
                {"text" in selectedBlock
                  ? (selectedBlock as { text: string }).text
                  : `[${selectedBlock.type}]`}
              </p>
            </div>
            <button
              className="shrink-0 text-muted/50 hover:text-foreground"
              onClick={onClearBlock}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && !streaming ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="mb-2 h-6 w-6 text-muted/20" />
            <p className="text-[12px] text-muted">开始对话</p>
            <p className="mt-1 text-[11px] text-muted">
              选中块进行优化，或直接描述新内容
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onApplyModify={handleApplyModify}
                onApplyInsert={handleApplyInsert}
              />
            ))}
            {/* 流式响应中的临时显示 */}
            {streaming && streamContent && (
              <div className="flex gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-elevated">
                  <Loader2 className="h-3 w-3 animate-spin text-secondary" />
                </div>
                <div className="max-w-[85%] rounded-lg bg-elevated/60 px-3 py-2 text-[12px] leading-relaxed text-foreground/80">
                  <p className="whitespace-pre-wrap">{streamContent}</p>
                </div>
              </div>
            )}
            {streaming && !streamContent && (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
                <span className="text-[11px] text-muted">思考中…</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 输入区 */}
      <div className="shrink-0 border-t border-border/40 p-3">
        <textarea
          ref={inputRef}
          className="w-full resize-none rounded-md border border-border/40 bg-elevated/30 px-3 py-2 text-[12px] leading-relaxed text-foreground outline-none placeholder:text-muted/40 focus:border-primary/40"
          rows={3}
          placeholder={
            selectedBlock
              ? "描述你想如何调整这个块…"
              : "描述你想添加的内容…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              void sendMessage()
            }
          }}
          disabled={streaming}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted">Cmd+Enter 发送</span>
          <Button
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            disabled={!input.trim() || streaming}
            onClick={() => void sendMessage()}
          >
            {streaming ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            发送
          </Button>
        </div>
      </div>
    </div>
  )
}
