/**
 * 笔记对话消息渲染
 * user 右对齐、assistant 左对齐，assistant 带 action 时渲染预览卡片
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { Bot, User } from "lucide-react"
import { cn } from "@/src/lib/utils"
import type { NoteChatMessage, NoteBlock } from "@/src/server/store/types"
import { ChatBlockPreview } from "./chat-block-preview"

interface ChatMessageProps {
  message: NoteChatMessage
  onApplyModify: (targetBlockId: string, block: NoteBlock) => void
  onApplyInsert: (blocks: NoteBlock[]) => void
}

/**
 * 单条对话消息
 */
export function ChatMessage({
  message,
  onApplyModify,
  onApplyInsert
}: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "flex gap-2",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* 头像 */}
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/10" : "bg-elevated"
        )}
      >
        {isUser ? (
          <User className="h-3 w-3 text-primary" />
        ) : (
          <Bot className="h-3 w-3 text-secondary" />
        )}
      </div>

      {/* 内容 */}
      <div
        className={cn(
          "max-w-[85%] space-y-2",
          isUser ? "text-right" : "text-left"
        )}
      >
        <div
          className={cn(
            "inline-block rounded-lg px-3 py-2 text-[12px] leading-relaxed",
            isUser
              ? "bg-primary/10 text-foreground"
              : "bg-elevated/60 text-foreground/80"
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* AI 建议操作卡片 */}
        {message.action && (
          <ChatBlockPreview
            action={message.action}
            onApplyModify={onApplyModify}
            onApplyInsert={onApplyInsert}
          />
        )}
      </div>
    </div>
  )
}
