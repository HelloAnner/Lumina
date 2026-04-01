import { ArticleReaderClient } from "@/components/articles/article-reader-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { cachedRepo } from "@/src/server/repositories/cached"
import { getArticleReaderProgress } from "@/src/server/services/articles/progress"
import {
  getReaderLayoutState,
  getUiPreferences
} from "@/src/server/services/preferences/store"
import { notFound } from "next/navigation"

export default async function ArticleReaderPage({
  params
}: {
  params: { articleId: string }
}) {
  const user = await requirePageUser()
  const article = repository.getArticle(user.id, params.articleId)

  if (!article) {
    notFound()
  }

  const [highlights, progress, widths, layout, settings] = await Promise.all([
    cachedRepo.listHighlightsByBook(user.id, article.id),
    getArticleReaderProgress(user.id, article.id),
    getUiPreferences(user.id),
    getReaderLayoutState(user.id, "article", article.id),
    cachedRepo.getReaderSettings(user.id)
  ])

  return (
    <ArticleReaderClient
      article={article}
      highlights={highlights}
      initialProgress={progress}
      initialWidths={widths}
      initialLayout={layout}
      settings={settings}
    />
  )
}
