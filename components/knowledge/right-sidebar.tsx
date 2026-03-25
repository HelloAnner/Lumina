/**
 * 右侧面板容器
 * 管理批注/对话 Tab 切换
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { cn } from "@/src/lib/utils"
import type { Annotation, NoteBlock } from "@/src/server/store/types"
import { AnnotationSidebar, type SelectionContext } from "./annotation-sidebar"
import { ChatSidebar } from "./chat-sidebar"

export type RightSidebarTab = "annotations" | "chat"

interface RightSidebarProps {
  viewpointId: string | undefined
  blocks: NoteBlock[]
  selectionContext: SelectionContext | null
  selectedBlockForChat: NoteBlock | null
  onClearSelection: () => void
  onClearChatBlock: () => void
  onAnnotationsChange: (annotations: Annotation[]) => void
  onBlocksUpdate: (blocks: NoteBlock[]) => void
  activeTab: RightSidebarTab
  onTabChange: (tab: RightSidebarTab) => void
}

const tabs: { key: RightSidebarTab; label: string }[] = [
  { key: "annotations", label: "批注" },
  { key: "chat", label: "对话" }
]

/**
 * 右侧面板：批注和对话的 Tab 容器
 */
export function RightSidebar({
  viewpointId,
  blocks,
  selectionContext,
  selectedBlockForChat,
  onClearSelection,
  onClearChatBlock,
  onAnnotationsChange,
  onBlocksUpdate,
  activeTab,
  onTabChange
}: RightSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Tab 栏 */}
      <div className="flex h-11 shrink-0 items-center border-b border-border/40 px-4">
        <div className="flex items-center gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={cn(
                "relative pb-0.5 text-[11px] font-medium uppercase tracking-widest transition-colors",
                activeTab === tab.key
                  ? "text-foreground"
                  : "text-muted hover:text-secondary"
              )}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-primary/60" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="min-h-0 flex-1">
        {activeTab === "annotations" ? (
          <AnnotationSidebar
            viewpointId={viewpointId}
            selectionContext={selectionContext}
            onClearSelection={onClearSelection}
            onAnnotationsChange={onAnnotationsChange}
          />
        ) : (
          <ChatSidebar
            viewpointId={viewpointId}
            blocks={blocks}
            selectedBlock={selectedBlockForChat}
            onClearBlock={onClearChatBlock}
            onBlocksUpdate={onBlocksUpdate}
          />
        )}
      </div>
    </div>
  )
}
