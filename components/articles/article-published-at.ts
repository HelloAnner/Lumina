/**
 * 文章发布时间文案工具
 * 用于阅读页标题旁的发布时间展示
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
/**
 * 格式化文章发布时间
 *
 * @param value
 */
export function formatArticlePublishedAt(value?: string) {
  if (!value) {
    return ""
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `发布于 ${year}-${month}-${day}`
}

/**
 * 格式化文章列表发布时间
 *
 * @param value
 * @param nowMs
 */
export function formatArticlePublishedAtSummary(value?: string, nowMs = Date.now()) {
  if (!value) {
    return ""
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  const diffMs = nowMs - date.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m ago`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.floor(hours / 24)
  if (days < 7) {
    return `${days}d ago`
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
