/**
 * 书库进度工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
export function normalizeLibraryProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  const normalized = value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, Math.round(normalized)))
}

export function formatLibraryProgressText(value: number) {
  return `${normalizeLibraryProgress(value)}%`
}
