import { ArticleReaderClient } from "@/components/articles/article-reader-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
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

  return <ArticleReaderClient article={article} />
}
