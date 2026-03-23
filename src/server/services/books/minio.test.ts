/**
 * 图书 MinIO 路径工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  buildCoverObjectName,
  formatMinioPath,
  parseMinioPath
} from "@/src/server/services/books/minio"

test("buildCoverObjectName 生成独立封面桶对象路径", () => {
  assert.equal(buildCoverObjectName("user-1", "book-1"), "user-1/book-1.jpg")
})

test("formatMinioPath 与 parseMinioPath 保持一致", () => {
  const path = formatMinioPath("lumina-covers", "user-1/book-1.jpg")

  assert.equal(path, "minio://lumina-covers/user-1/book-1.jpg")
  assert.deepEqual(parseMinioPath(path), {
    bucket: "lumina-covers",
    objectName: "user-1/book-1.jpg"
  })
})
