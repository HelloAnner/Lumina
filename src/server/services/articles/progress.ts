/**
 * 文章阅读进度存储
 * 为文章阅读器提供精细位置级别的进度读写
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import { ensureBookSchema, getBookPool } from "@/src/server/services/books/postgres"
import {
  buildReadingProgressId,
  type ArticleProgressRecord
} from "@/src/server/services/reading/progress"

let articleProgressSchemaReady: Promise<void> | null = null

async function ensureArticleProgressSchema() {
  await ensureBookSchema()
  if (!articleProgressSchemaReady) {
    articleProgressSchemaReady = getBookPool()
      .query(`
        CREATE TABLE IF NOT EXISTS app_article_progress (
          id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          article_id TEXT NOT NULL,
          progress REAL NOT NULL DEFAULT 0,
          current_page_id TEXT,
          current_page_index INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (user_id, article_id)
        )
      `)
      .then(() => undefined)
  }
  return articleProgressSchemaReady
}

/**
 * 获取文章阅读进度
 *
 * @param userId
 * @param articleId
 */
export async function getArticleReaderProgress(
  userId: string,
  articleId: string
): Promise<ArticleProgressRecord> {
  try {
    await ensureArticleProgressSchema()
    const result = await getBookPool().query(
      `SELECT id, progress, current_page_id, current_page_index, updated_at
       FROM app_article_progress
       WHERE user_id = $1 AND article_id = $2 LIMIT 1`,
      [userId, articleId]
    )
    const row = result.rows[0]
    if (!row) {
      return createDefaultProgress(articleId)
    }
    return {
      id: row.id ?? buildReadingProgressId("article", articleId),
      progress: Number(row.progress ?? 0),
      currentPageId: row.current_page_id ?? undefined,
      currentPageIndex: row.current_page_index ?? 0,
      updatedAt: row.updated_at?.toISOString?.() ?? undefined
    }
  } catch {
    return createDefaultProgress(articleId)
  }
}

/**
 * 保存文章阅读进度
 *
 * @param userId
 * @param articleId
 * @param progress
 */
export async function saveArticleReaderProgress(
  userId: string,
  articleId: string,
  progress: Partial<ArticleProgressRecord>
) {
  const current = await getArticleReaderProgress(userId, articleId)
  const next: ArticleProgressRecord = {
    id: progress.id ?? current.id ?? buildReadingProgressId("article", articleId),
    progress: progress.progress ?? current.progress,
    currentPageId: progress.currentPageId ?? current.currentPageId,
    currentPageIndex: progress.currentPageIndex ?? current.currentPageIndex
  }
  try {
    await ensureArticleProgressSchema()
    await getBookPool().query(
      `INSERT INTO app_article_progress
        (id, user_id, article_id, progress, current_page_id, current_page_index, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, article_id)
       DO UPDATE SET
         id = EXCLUDED.id,
         progress = EXCLUDED.progress,
         current_page_id = EXCLUDED.current_page_id,
         current_page_index = EXCLUDED.current_page_index,
         updated_at = NOW()`,
      [
        next.id,
        userId,
        articleId,
        next.progress,
        next.currentPageId ?? null,
        next.currentPageIndex
      ]
    )
  } catch {
    return next
  }
  return next
}

function createDefaultProgress(articleId: string): ArticleProgressRecord {
  return {
    id: buildReadingProgressId("article", articleId),
    progress: 0,
    currentPageIndex: 0
  }
}
