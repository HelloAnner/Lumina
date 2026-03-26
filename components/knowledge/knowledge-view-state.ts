/**
 * 知识库观点切换视图状态工具
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
export function shouldRenderViewpointEditor(input: {
  selectedId: string
  readyViewpointId: string
}) {
  if (!input.selectedId) {
    return false
  }
  return input.selectedId === input.readyViewpointId
}

export function shouldBootstrapEmptyViewpoint(input: {
  selectedId: string
  readyViewpointId: string
  blockCount: number
}) {
  return shouldRenderViewpointEditor({
    selectedId: input.selectedId,
    readyViewpointId: input.readyViewpointId
  }) && input.blockCount === 0
}
