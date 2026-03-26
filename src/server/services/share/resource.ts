/**
 * 分享资源解析
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import { repository } from "@/src/server/repositories"
import { buildPublicArticleAssetProxyPath } from "@/src/server/services/articles/assets"
import { repairStoredBook } from "@/src/server/services/books/book-repair"
import { getBookFromStore } from "@/src/server/services/books/store"
import {
  buildPublicSharePdfFileUrl,
  buildPublicSharePdfPageImageUrl
} from "@/src/server/services/share/share-links"
import type { Book } from "@/src/server/store/types"

function replaceBookImageSrc(book: Book, token: string): Book {
  if (book.format !== "PDF") {
    return book
  }
  return {
    ...book,
    content: book.content.map((section) => ({
      ...section,
      blocks: section.blocks?.map((block) => {
        if (block.type !== "image") {
          return block
        }
        return {
          ...block,
          src: buildPublicSharePdfPageImageUrl(token, section.pageIndex)
        }
      })
    }))
  }
}

function replaceArticleImageSrc<T extends { content: Array<{ type: string; assetId?: string; src?: string }>; coverImage?: string }>(
  article: T,
  token: string
) {
  const content = article.content.map((section) => {
    if (section.type !== "image" || !section.assetId) {
      return section
    }
    return {
      ...section,
      src: buildPublicArticleAssetProxyPath(token, section.assetId)
    }
  })
  const firstImage = content.find(
    (section) => section.type === "image" && section.assetId && section.src
  )
  return {
    ...article,
    content,
    coverImage: firstImage?.src ?? article.coverImage
  }
}

export async function resolveSharedResource(token: string) {
  const shareLink = repository.getActiveShareLinkByToken(token)
  if (!shareLink) {
    return null
  }
  const owner = repository.getUserById(shareLink.ownerUserId)
  if (!owner) {
    return null
  }

  if (shareLink.resourceType === "book") {
    const storedBook = await getBookFromStore(owner.id, shareLink.resourceId)
    const repairedBook = storedBook ? await repairStoredBook(storedBook) : null
    if (!repairedBook) {
      return null
    }
    repository.touchShareLink(token)
    return {
      shareLink,
      owner,
      resourceType: "book" as const,
      book: replaceBookImageSrc(repairedBook, token),
      publicFileUrl: buildPublicSharePdfFileUrl(token)
    }
  }

  const article = repository.getArticle(owner.id, shareLink.resourceId)
  if (!article) {
    return null
  }
  repository.touchShareLink(token)
  return {
    shareLink,
    owner,
    resourceType: "article" as const,
    article: replaceArticleImageSrc(article, token)
  }
}
