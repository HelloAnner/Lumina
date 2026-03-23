/**
 * PDF 高亮几何工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
export interface PdfHighlightRect {
  left: number
  top: number
  width: number
  height: number
}

interface NormalizePdfSelectionRectsInput {
  pageRect: PdfHighlightRect
  clientRects: PdfHighlightRect[]
}

function roundRectValue(value: number) {
  return Math.round(value * 100) / 100
}

function intersectRect(
  rect: PdfHighlightRect,
  pageRect: PdfHighlightRect
): PdfHighlightRect | null {
  const left = Math.max(rect.left, pageRect.left)
  const top = Math.max(rect.top, pageRect.top)
  const right = Math.min(rect.left + rect.width, pageRect.left + pageRect.width)
  const bottom = Math.min(rect.top + rect.height, pageRect.top + pageRect.height)

  if (right <= left || bottom <= top) {
    return null
  }

  return {
    left,
    top,
    width: right - left,
    height: bottom - top
  }
}

export function normalizePdfSelectionRects({
  pageRect,
  clientRects
}: NormalizePdfSelectionRectsInput) {
  return clientRects
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => intersectRect(rect, pageRect))
    .filter((rect): rect is PdfHighlightRect => Boolean(rect))
    .map((rect) => ({
      left: roundRectValue(rect.left - pageRect.left),
      top: roundRectValue(rect.top - pageRect.top),
      width: roundRectValue(rect.width),
      height: roundRectValue(rect.height)
    }))
    .sort((left, right) => left.top - right.top || left.left - right.left)
}
