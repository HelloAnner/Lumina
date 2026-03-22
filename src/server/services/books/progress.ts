import { ensureBookSchema, getBookPool } from "@/src/server/services/books/postgres"

export interface ReaderProgressRecord {
  progress: number
  currentSectionIndex: number
  currentParagraphIndex: number
}

const DEFAULT_PROGRESS: ReaderProgressRecord = {
  progress: 0,
  currentSectionIndex: 0,
  currentParagraphIndex: 0
}

let progressSchemaReady: Promise<void> | null = null

async function ensureProgressSchema() {
  await ensureBookSchema()
  if (!progressSchemaReady) {
    progressSchemaReady = getBookPool()
      .query(`
        CREATE TABLE IF NOT EXISTS app_reader_progress (
          user_id TEXT NOT NULL,
          book_id TEXT NOT NULL,
          progress REAL NOT NULL DEFAULT 0,
          current_section_index INTEGER NOT NULL DEFAULT 0,
          current_paragraph_index INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (user_id, book_id)
        )
      `)
      .then(() => undefined)
  }
  return progressSchemaReady
}

export async function getReaderProgress(userId: string, bookId: string) {
  try {
    await ensureProgressSchema()
    const result = await getBookPool().query(
      `SELECT progress, current_section_index, current_paragraph_index
       FROM app_reader_progress
       WHERE user_id = $1 AND book_id = $2 LIMIT 1`,
      [userId, bookId]
    )
    const row = result.rows[0]
    if (!row) {
      return DEFAULT_PROGRESS
    }
    return {
      progress: Number(row.progress ?? 0),
      currentSectionIndex: row.current_section_index ?? 0,
      currentParagraphIndex: row.current_paragraph_index ?? 0
    }
  } catch {
    return DEFAULT_PROGRESS
  }
}

export async function saveReaderProgress(
  userId: string,
  bookId: string,
  progress: Partial<ReaderProgressRecord>
) {
  const current = await getReaderProgress(userId, bookId)
  const next = {
    progress: progress.progress ?? current.progress,
    currentSectionIndex: progress.currentSectionIndex ?? current.currentSectionIndex,
    currentParagraphIndex:
      progress.currentParagraphIndex ?? current.currentParagraphIndex
  }
  try {
    await ensureProgressSchema()
    await getBookPool().query(
      `INSERT INTO app_reader_progress
        (user_id, book_id, progress, current_section_index, current_paragraph_index, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, book_id)
       DO UPDATE SET
         progress = EXCLUDED.progress,
         current_section_index = EXCLUDED.current_section_index,
         current_paragraph_index = EXCLUDED.current_paragraph_index,
         updated_at = NOW()`,
      [userId, bookId, next.progress, next.currentSectionIndex, next.currentParagraphIndex]
    )
  } catch {
    return next
  }
  return next
}
