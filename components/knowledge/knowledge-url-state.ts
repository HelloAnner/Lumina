/**
 * 知识库 URL 与笔记状态工具
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
export interface KnowledgeSelection {
  viewpointId?: string
  importedNoteId?: string
}

export interface KnowledgeNoteState {
  outlineCollapsed: boolean
  scrollTop: number
  anchorHeadingId?: string
}

export const DEFAULT_KNOWLEDGE_NOTE_STATE: KnowledgeNoteState = {
  outlineCollapsed: false,
  scrollTop: 0
}

/**
 * 读取知识库页面当前选择
 */
export function readKnowledgeSelection(
  params: URLSearchParams
): KnowledgeSelection {
  const importedNoteId = readParam(params, "importedNote")
  if (importedNoteId) {
    return { importedNoteId, viewpointId: undefined }
  }
  const viewpointId = readParam(params, "viewpoint")
  return {
    viewpointId,
    importedNoteId: undefined
  }
}

/**
 * 构建知识库页面查询串
 */
export function buildKnowledgeSearch(
  params: URLSearchParams,
  selection: KnowledgeSelection
): string {
  const next = new URLSearchParams(params)
  next.delete("viewpoint")
  next.delete("importedNote")
  if (selection.importedNoteId) {
    next.set("importedNote", selection.importedNoteId)
  } else if (selection.viewpointId) {
    next.set("viewpoint", selection.viewpointId)
  }
  return next.toString()
}

/**
 * 生成笔记状态存储键
 */
export function buildKnowledgeNoteKey(
  selection: KnowledgeSelection
): string | null {
  if (selection.importedNoteId) {
    return `imported:${selection.importedNoteId}`
  }
  if (selection.viewpointId) {
    return `viewpoint:${selection.viewpointId}`
  }
  return null
}

function readParam(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim()
  return value ? value : undefined
}
