import { ArticleReaderClient } from "@/components/articles/article-reader-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { getArticleReaderProgress } from "@/src/server/services/articles/progress"
import { getUiPreferences } from "@/src/server/services/preferences/store"
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

  const highlights = repository.listHighlightsByBook(user.id, article.id)
  const initialWidths = await getUiPreferences(user.id)
  const settings = repository.getReaderSettings(user.id)

  return (
    <ArticleReaderClient
      article={article}
      highlights={highlights}
      initialProgress={await getArticleReaderProgress(user.id, article.id)}
      initialWidths={initialWidths}
      settings={settings}
    />
  )
}
