import { randomUUID } from "node:crypto"
import { repository } from "@/src/server/repositories"
import { ensureBookSchema, getBookPool } from "@/src/server/services/books/postgres"
import type { Book } from "@/src/server/store/types"

function sanitizeText(value: unknown, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed === "object") {
          return sanitizeText(
            (parsed as Record<string, unknown>)["#text"] ??
              (parsed as Record<string, unknown>).text ??
              fallback,
            fallback
          )
        }
      } catch {
        return trimmed
      }
    }
    return trimmed
  }
  if (value && typeof value === "object") {
    return sanitizeText(
      (value as Record<string, unknown>)["#text"] ??
        (value as Record<string, unknown>).text ??
        fallback,
      fallback
    )
  }
  return fallback
}

function rowToBook(row: any): Book {
  return {
    id: row.id,
    userId: row.user_id,
    title: sanitizeText(row.title, "未命名书籍"),
    author: sanitizeText(row.author, "未知作者") || undefined,
    format: row.format,
    filePath: row.file_path,
    coverPath: row.cover_path ?? undefined,
    totalPages: row.total_pages ?? undefined,
    readProgress: Number(row.read_progress ?? 0),
    lastReadAt: row.last_read_at ? new Date(row.last_read_at).toISOString() : undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    status: row.status,
    synopsis: row.synopsis ?? "",
    toc: Array.isArray(row.toc) ? row.toc : [],
    content: Array.isArray(row.content) ? row.content : [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  }
}

async function seedFromRepositoryIfNeeded(userId: string) {
  await ensureBookSchema()
  const pool = getBookPool()
  const existing = await pool.query(
    "SELECT COUNT(*)::int AS count FROM app_books WHERE user_id = $1",
    [userId]
  )
  if (existing.rows[0]?.count > 0) {
    return
  }
  const localBooks = repository.listBooks(userId)
  for (const book of localBooks) {
    await pool.query(
      `INSERT INTO app_books
       (id, user_id, title, author, format, file_path, cover_path, total_pages, read_progress, last_read_at, tags, status, synopsis, toc, content, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14::jsonb,$15::jsonb,$16)
       ON CONFLICT (id) DO NOTHING`,
      [
        book.id,
        book.userId,
        book.title,
        book.author ?? null,
        book.format,
        book.filePath,
        book.coverPath ?? null,
        book.totalPages ?? null,
        book.readProgress,
        book.lastReadAt ?? null,
        JSON.stringify(book.tags),
        book.status,
        book.synopsis,
        JSON.stringify(book.toc),
        JSON.stringify(book.content),
        book.createdAt
      ]
    )
  }
}

export async function listBooksFromStore(userId: string, search?: string, tag?: string) {
  try {
    await seedFromRepositoryIfNeeded(userId)
    const pool = getBookPool()
    const clauses = ["user_id = $1"]
    const values: unknown[] = [userId]
    if (search) {
      values.push(`%${search}%`)
      clauses.push(`(title ILIKE $${values.length} OR COALESCE(author, '') ILIKE $${values.length})`)
    }
    if (tag) {
      values.push(tag)
      clauses.push(`tags ? $${values.length}`)
    }
    const result = await pool.query(
      `SELECT * FROM app_books WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`,
      values
    )
    return result.rows.map(rowToBook)
  } catch {
    return repository.listBooks(userId, search, tag)
  }
}

export async function getBookFromStore(userId: string, bookId: string) {
  try {
    await seedFromRepositoryIfNeeded(userId)
    const result = await getBookPool().query(
      "SELECT * FROM app_books WHERE user_id = $1 AND id = $2 LIMIT 1",
      [userId, bookId]
    )
    const row = result.rows[0]
    return row ? rowToBook(row) : null
  } catch {
    return repository.getBook(userId, bookId) ?? null
  }
}

export async function createBookInStore(
  book: Omit<Book, "createdAt"> & { objectBucket?: string; objectKey?: string }
) {
  const createdAt = new Date().toISOString()
  const id = book.id || randomUUID()
  const nextBook: Book = {
    ...book,
    id,
    createdAt
  }
  try {
    await ensureBookSchema()
    await getBookPool().query(
      `INSERT INTO app_books
       (id, user_id, title, author, format, file_path, cover_path, total_pages, read_progress, last_read_at, tags, status, synopsis, toc, content, object_bucket, object_key, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14::jsonb,$15::jsonb,$16,$17,$18)`,
      [
        nextBook.id,
        nextBook.userId,
        nextBook.title,
        nextBook.author ?? null,
        nextBook.format,
        nextBook.filePath,
        nextBook.coverPath ?? null,
        nextBook.totalPages ?? null,
        nextBook.readProgress,
        nextBook.lastReadAt ?? null,
        JSON.stringify(nextBook.tags),
        nextBook.status,
        nextBook.synopsis,
        JSON.stringify(nextBook.toc),
        JSON.stringify(nextBook.content),
        book.objectBucket ?? null,
        book.objectKey ?? null,
        createdAt
      ]
    )
  } catch {
    // fallback below
  }
  repository.createBook({
    ...nextBook
  })
  return nextBook
}

export async function updateBookInStore(userId: string, bookId: string, updates: Partial<Book>) {
  const current = await getBookFromStore(userId, bookId)
  if (!current) {
    return null
  }
  const merged = {
    ...current,
    ...updates
  }

  try {
    await ensureBookSchema()
    await getBookPool().query(
      `UPDATE app_books
       SET title = $3, author = $4, cover_path = $5, total_pages = $6, read_progress = $7, last_read_at = $8,
           tags = $9::jsonb, status = $10, synopsis = $11, toc = $12::jsonb, content = $13::jsonb
       WHERE user_id = $1 AND id = $2`,
      [
        userId,
        bookId,
        merged.title,
        merged.author ?? null,
        merged.coverPath ?? null,
        merged.totalPages ?? null,
        merged.readProgress,
        merged.lastReadAt ?? null,
        JSON.stringify(merged.tags),
        merged.status,
        merged.synopsis,
        JSON.stringify(merged.toc),
        JSON.stringify(merged.content)
      ]
    )
  } catch {
    // ignore
  }
  repository.updateBook(userId, bookId, updates)
  return merged
}

export async function deleteBookFromStore(userId: string, bookId: string) {
  try {
    await ensureBookSchema()
    await getBookPool().query(
      "DELETE FROM app_books WHERE user_id = $1 AND id = $2",
      [userId, bookId]
    )
  } catch {
    // ignore
  }
  repository.deleteBook(userId, bookId)
}
