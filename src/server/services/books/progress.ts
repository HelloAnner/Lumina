import { ensureBookSchema, getBookPool } from "@/src/server/services/books/postgres"
import {
  buildReadingProgressId,
  type BookProgressRecord
} from "@/src/server/services/reading/progress"

export type ReaderProgressRecord = BookProgressRecord

function createDefaultProgress(bookId: string): ReaderProgressRecord {
  return {
    id: buildReadingProgressId("book", bookId),
    progress: 0,
    currentPageIndex: 0,
    currentSectionIndex: 0,
    currentParagraphIndex: 0
  }
}

let progressSchemaReady: Promise<void> | null = null

async function ensureProgressSchema() {
  await ensureBookSchema()
  if (!progressSchemaReady) {
    progressSchemaReady = getBookPool()
      .query(`
        CREATE TABLE IF NOT EXISTS app_reader_progress (
          id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          book_id TEXT NOT NULL,
          progress REAL NOT NULL DEFAULT 0,
          current_page_id TEXT,
          current_page_index INTEGER NOT NULL DEFAULT 0,
          current_section_index INTEGER NOT NULL DEFAULT 0,
          current_paragraph_index INTEGER NOT NULL DEFAULT 0,
          target_language TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (user_id, book_id)
        )
      `)
      .then(() =>
        getBookPool().query(
          `ALTER TABLE app_reader_progress ADD COLUMN IF NOT EXISTS id TEXT`
        )
      )
      .then(() =>
        getBookPool().query(
          `ALTER TABLE app_reader_progress ADD COLUMN IF NOT EXISTS current_page_id TEXT`
        )
      )
      .then(() =>
        getBookPool().query(
          `ALTER TABLE app_reader_progress ADD COLUMN IF NOT EXISTS current_page_index INTEGER NOT NULL DEFAULT 0`
        )
      )
      .then(() =>
        getBookPool().query(
          `ALTER TABLE app_reader_progress ADD COLUMN IF NOT EXISTS target_language TEXT`
        )
      )
      .then(() => undefined)
  }
  return progressSchemaReady
}

export async function getReaderProgress(userId: string, bookId: string) {
  try {
    await ensureProgressSchema()
    const result = await getBookPool().query(
      `SELECT id, progress, current_page_id, current_page_index,
              current_section_index, current_paragraph_index, target_language, updated_at
       FROM app_reader_progress
       WHERE user_id = $1 AND book_id = $2 LIMIT 1`,
      [userId, bookId]
    )
    const row = result.rows[0]
    if (!row) {
      return createDefaultProgress(bookId)
    }
    return {
      id: row.id ?? buildReadingProgressId("book", bookId),
      progress: Number(row.progress ?? 0),
      currentPageId: row.current_page_id ?? undefined,
      currentPageIndex: row.current_page_index ?? 0,
      currentSectionIndex: row.current_section_index ?? 0,
      currentParagraphIndex: row.current_paragraph_index ?? 0,
      targetLanguage: row.target_language ?? undefined,
      updatedAt: row.updated_at?.toISOString?.() ?? undefined
    }
  } catch {
    return createDefaultProgress(bookId)
  }
}

export async function saveReaderProgress(
  userId: string,
  bookId: string,
  progress: Partial<ReaderProgressRecord>
) {
  const current = await getReaderProgress(userId, bookId)
  const next = {
    id: progress.id ?? current.id ?? buildReadingProgressId("book", bookId),
    progress: progress.progress ?? current.progress,
    currentPageId: progress.currentPageId ?? current.currentPageId,
    currentPageIndex: progress.currentPageIndex ?? current.currentPageIndex,
    currentSectionIndex: progress.currentSectionIndex ?? current.currentSectionIndex,
    currentParagraphIndex:
      progress.currentParagraphIndex ?? current.currentParagraphIndex,
    targetLanguage: progress.targetLanguage ?? current.targetLanguage
  }
  try {
    await ensureProgressSchema()
    await getBookPool().query(
      `INSERT INTO app_reader_progress
        (id, user_id, book_id, progress, current_page_id, current_page_index,
         current_section_index, current_paragraph_index, target_language, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (user_id, book_id)
       DO UPDATE SET
         id = EXCLUDED.id,
         progress = EXCLUDED.progress,
         current_page_id = EXCLUDED.current_page_id,
         current_page_index = EXCLUDED.current_page_index,
         current_section_index = EXCLUDED.current_section_index,
         current_paragraph_index = EXCLUDED.current_paragraph_index,
         target_language = EXCLUDED.target_language,
         updated_at = NOW()`,
      [
        next.id,
        userId,
        bookId,
        next.progress,
        next.currentPageId ?? null,
        next.currentPageIndex,
        next.currentSectionIndex,
        next.currentParagraphIndex,
        next.targetLanguage ?? null
      ]
    )
  } catch {
    return next
  }
  return next
}
