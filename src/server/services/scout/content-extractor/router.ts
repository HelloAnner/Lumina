export type ContentExtractorKey = "generic" | "x"

export interface ContentExtractorMatch {
  key: ContentExtractorKey
}

const X_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"])

export function matchContentExtractor(url: string): ContentExtractorMatch {
  try {
    const parsed = new URL(url)
    if (isXStatusUrl(parsed)) {
      return { key: "x" }
    }
  } catch {
    return { key: "generic" }
  }

  return { key: "generic" }
}

function isXStatusUrl(url: URL) {
  if (!X_HOSTS.has(url.hostname.toLowerCase())) {
    return false
  }
  return /\/status\/\d+/.test(url.pathname)
}
