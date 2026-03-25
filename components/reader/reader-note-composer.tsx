/**
 * 阅读器想法弹窗
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export function ReaderNoteComposer({
  open,
  selectedText,
  noteDraft,
  onChange,
  onCancel,
  onSave
}: {
  open: boolean
  selectedText: string
  noteDraft: string
  onChange: (value: string) => void
  onCancel: () => void
  onSave: () => void
}) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-base/60 backdrop-blur-sm" data-reader-note-composer>
      <Card className="w-full max-w-xl space-y-4 p-6">
        <div className="text-lg font-medium">记录想法</div>
        <div className="rounded-xl bg-elevated px-4 py-3 text-sm leading-6 text-foreground">
          {selectedText}
        </div>
        <Textarea
          placeholder="写下你此刻的理解、联想或问题……"
          value={noteDraft}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button
            className="rounded-md px-3 py-2 text-sm text-secondary hover:bg-overlay hover:text-foreground"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark"
            onClick={onSave}
          >
            保存想法
          </button>
        </div>
      </Card>
    </div>
  )
}
