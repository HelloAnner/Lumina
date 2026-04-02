import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  BubbleToolbarFormattingButtons
} from "@/components/knowledge/note-bubble-toolbar-buttons"

test("BubbleToolbarFormattingButtons 使用统一图标按钮而不是裸文本", () => {
  const markup = renderToStaticMarkup(
    <BubbleToolbarFormattingButtons
      activeMarks={{
        bold: false,
        italic: false,
        highlight: true,
        strike: false,
        code: false,
        link: false
      }}
      hints={{
        bold: "加粗 Cmd+B",
        italic: "斜体 Cmd+I",
        highlight: "高亮 Cmd+Shift+H",
        strike: "删除线 Cmd+Shift+S",
        code: "行内代码 Cmd+E",
        link: "链接 Cmd+K"
      }}
      onToggleBold={() => undefined}
      onToggleItalic={() => undefined}
      onToggleHighlight={() => undefined}
      onToggleStrike={() => undefined}
      onToggleCode={() => undefined}
      onToggleLink={() => undefined}
    />
  )

  assert.match(markup, /title="加粗 Cmd\+B"/)
  assert.match(markup, /title="斜体 Cmd\+I"/)
  assert.match(markup, /title="删除线 Cmd\+Shift\+S"/)
  assert.match(markup, /title="行内代码 Cmd\+E"/)
  assert.doesNotMatch(markup, />B</)
  assert.doesNotMatch(markup, />I</)
  assert.doesNotMatch(markup, />S</)
  assert.doesNotMatch(markup, /&lt;&gt;/)
})
