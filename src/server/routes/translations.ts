/**
 * 阅读翻译接口
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import { getBookFromStore } from "@/src/server/services/books/store"
import { prefetchArticleTranslations, prefetchBookTranslations } from "@/src/server/services/translation/service"

const app = new Hono<AppEnv>()

app.post("/books/:bookId/prefetch", async (c) => {
  const payload = z
    .object({
      sectionIndexes: z.array(z.number().int().min(0)).min(1),
      targetLanguage: z.string().optional()
    })
    .parse(await c.req.json())
  const book = await getBookFromStore(c.get("userId"), c.req.param("bookId"))
  if (!book) {
    return c.json({ error: "书籍不存在" }, 404)
  }
  const model = repository.getModelByFeature(c.get("userId"), "section_translate")
  try {
    const result = await prefetchBookTranslations({
      userId: c.get("userId"),
      book,
      sectionIndexes: payload.sectionIndexes,
      targetLanguage: payload.targetLanguage,
      model
    })
    return c.json(result)
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "翻译失败"
      },
      400
    )
  }
})

app.post("/articles/:articleId/prefetch", async (c) => {
  const payload = z
    .object({ targetLanguage: z.string().optional() })
    .parse(await c.req.json())
  const userId = c.get("userId")
  const article = repository.getArticle(userId, c.req.param("articleId"))
  if (!article) {
    return c.json({ error: "文章不存在" }, 404)
  }
  const model = repository.getModelByFeature(userId, "section_translate")
  try {
    const result = await prefetchArticleTranslations({
      userId,
      articleId: article.id,
      sections: article.content,
      targetLanguage: payload.targetLanguage,
      model
    })
    return c.json(result)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "翻译失败" },
      400
    )
  }
})

export default app
