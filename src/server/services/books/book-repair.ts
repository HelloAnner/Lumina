/**
 * 图书读取修复入口
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import { repairPlaceholderPdfBook } from "@/src/server/services/books/pdf-repair"
import type { Book } from "@/src/server/store/types"

/**
 * 返回可直接用于阅读的书籍对象。
 *
 * EPUB 旧数据的分段与 blocks 修复已在 store 读取阶段完成并持久化；
 * 这里额外处理 PDF 占位正文回源修复。
 */
export async function repairStoredBook(book: Book) {
  if (book.format === "PDF") {
    return repairPlaceholderPdfBook(book)
  }
  return book
}
