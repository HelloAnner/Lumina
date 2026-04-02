import React from "react"
import {
  Bold,
  CodeXml,
  Highlighter,
  Italic,
  Link2,
  Strikethrough
} from "lucide-react"
import { cn } from "@/src/lib/utils"

type BubbleToolbarFormattingButtonsProps = {
  activeMarks: {
    bold: boolean
    italic: boolean
    highlight: boolean
    strike: boolean
    code: boolean
    link: boolean
  }
  hints: {
    bold: string
    italic: string
    highlight: string
    strike: string
    code: string
    link: string
  }
  onToggleBold: () => void
  onToggleItalic: () => void
  onToggleHighlight: () => void
  onToggleStrike: () => void
  onToggleCode: () => void
  onToggleLink: () => void
}

export function BubbleToolbarFormattingButtons({
  activeMarks,
  hints,
  onToggleBold,
  onToggleItalic,
  onToggleHighlight,
  onToggleStrike,
  onToggleCode,
  onToggleLink
}: BubbleToolbarFormattingButtonsProps) {
  return (
    <>
      <BubbleToolbarIconButton
        active={activeMarks.bold}
        hint={hints.bold}
        onClick={onToggleBold}
      >
        <Bold className="h-3.5 w-3.5" />
      </BubbleToolbarIconButton>
      <BubbleToolbarIconButton
        active={activeMarks.italic}
        hint={hints.italic}
        onClick={onToggleItalic}
      >
        <Italic className="h-3.5 w-3.5" />
      </BubbleToolbarIconButton>
      <BubbleToolbarIconButton
        active={activeMarks.highlight}
        hint={hints.highlight}
        onClick={onToggleHighlight}
      >
        <Highlighter className="h-3.5 w-3.5" />
      </BubbleToolbarIconButton>
      <BubbleToolbarIconButton
        active={activeMarks.strike}
        hint={hints.strike}
        onClick={onToggleStrike}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </BubbleToolbarIconButton>
      <BubbleToolbarIconButton
        active={activeMarks.code}
        hint={hints.code}
        onClick={onToggleCode}
      >
        <CodeXml className="h-3.5 w-3.5" />
      </BubbleToolbarIconButton>
      <BubbleToolbarIconButton
        active={activeMarks.link}
        hint={hints.link}
        onClick={onToggleLink}
      >
        <Link2 className="h-3.5 w-3.5" />
      </BubbleToolbarIconButton>
    </>
  )
}

function BubbleToolbarIconButton({
  active,
  hint,
  children,
  onClick
}: {
  active?: boolean
  hint?: string
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      className={cn("note-bubble-button", active && "is-active")}
      title={hint}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
