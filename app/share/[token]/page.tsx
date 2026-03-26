import { notFound } from "next/navigation"
import { ArticleReaderClient } from "@/components/articles/article-reader-client"
import { ReaderClient } from "@/components/reader/reader-client"
import { repository } from "@/src/server/repositories"
import { getArticleReaderProgress } from "@/src/server/services/articles/progress"
import { getReaderProgress } from "@/src/server/services/books/progress"
import { getUiPreferences } from "@/src/server/services/preferences/store"
import { resolveSharedResource } from "@/src/server/services/share/resource"
import { buildNormalizedTranslatedArticleSections } from "@/src/server/services/translation/article-content"

export default async function SharedReaderPage({
  params
}: {
  params: { token: string }
}) {
  const resolved = await resolveSharedResource(params.token)
  if (!resolved) {
    notFound()
  }

  const readerSettings = repository.getReaderSettings(resolved.owner.id)
  const sharedSettings = readerSettings
  const sharedView = {
    readOnly: true as const,
    token: resolved.shareLink.token,
    ownerName: resolved.owner.name,
    expiresAt: resolved.shareLink.expiresAt,
    publicFileUrl: resolved.resourceType === "book" ? resolved.publicFileUrl : undefined
  }
  const initialWidths = await getUiPreferences(resolved.owner.id)

  if (resolved.resourceType === "book") {
    return (
      <ReaderClient
        book={resolved.book}
        highlights={[]}
        initialProgress={await getReaderProgress(resolved.owner.id, resolved.book.id)}
        initialWidths={initialWidths}
        settings={sharedSettings}
        initialTranslations={repository.listBookTranslations(resolved.owner.id, resolved.book.id)}
        initialTocTranslation={
          repository.listBookTocTranslations(resolved.owner.id, resolved.book.id)[0] ?? null
        }
        sharedView={sharedView}
      />
    )
  }

  return (
    <ArticleReaderClient
      article={resolved.article}
      highlights={[]}
      initialProgress={await getArticleReaderProgress(resolved.owner.id, resolved.article.id)}
      initialWidths={initialWidths}
      settings={sharedSettings}
      initialTranslation={
        (() => {
          const cached = repository.listArticleTranslations(
            resolved.owner.id,
            resolved.article.id
          )[0]
          if (!cached) {
            return null
          }
          return {
            ...cached,
            content: buildNormalizedTranslatedArticleSections(
              resolved.article.content,
              cached.content
            )
          }
        })()
      }
      sharedView={sharedView}
    />
  )
}
