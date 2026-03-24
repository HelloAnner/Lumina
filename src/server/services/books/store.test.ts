/**
 * 图书存储规整测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import test from "node:test"
import assert from "node:assert/strict"
import { buildBookFromStoredRow } from "@/src/server/services/books/store"

test("buildBookFromStoredRow 会标记旧 EPUB 为需持久化修复", () => {
  const { book, needsEpubRepair } = buildBookFromStoredRow({
    id: "book-1",
    user_id: "user-1",
    title: "运营之光",
    author: "黄有璨",
    format: "EPUB",
    file_path: "minio://lumina-books/demo.epub",
    cover_path: "",
    total_pages: 2,
    read_progress: 0,
    last_read_at: null,
    tags: ["EPUB"],
    status: "READY",
    synopsis: "版权信息 书名：运营之光 作者：黄有璨 出版社：电子工业出版社 ISBN：1234567890 定价：99.00 版权所有·侵权必究",
    toc: [
      { id: "toc-1", title: "第1章 运营是什么", pageIndex: 1 }
    ],
    content: [
      {
        id: "section-1",
        title: "第1章 运营是什么",
        pageIndex: 1,
        content:
          "未知 第1章 运营是什么 很多运营从业者之所以会迷茫的很大一个原因，就是互联网公司内的运营岗位和运营工作的职责是高度不标准的。 在互联网行业中，“运营”这个职能的诞生，来源于互联网时代的产品价值构成发生的部分改变。 产品负责界定和提供长期用户价值，运营负责创造短期用户价值+协助产品完善长期价值。"
      }
    ],
    created_at: "2026-03-24T00:00:00.000Z"
  })

  assert.equal(needsEpubRepair, true)
  assert.equal(book.content[0]?.content, [
    "很多运营从业者之所以会迷茫的很大一个原因，就是互联网公司内的运营岗位和运营工作的职责是高度不标准的。",
    "在互联网行业中，“运营”这个职能的诞生，来源于互联网时代的产品价值构成发生的部分改变。",
    "产品负责界定和提供长期用户价值，运营负责创造短期用户价值+协助产品完善长期价值。"
  ].join("\n\n"))
  assert.deepEqual(book.content[0]?.blocks, [
    {
      type: "paragraph",
      text: "很多运营从业者之所以会迷茫的很大一个原因，就是互联网公司内的运营岗位和运营工作的职责是高度不标准的。"
    },
    {
      type: "paragraph",
      text: "在互联网行业中，“运营”这个职能的诞生，来源于互联网时代的产品价值构成发生的部分改变。"
    },
    {
      type: "paragraph",
      text: "产品负责界定和提供长期用户价值，运营负责创造短期用户价值+协助产品完善长期价值。"
    }
  ])
  assert.match(book.synopsis, /版权信息\n\n书名：运营之光/)
})

test("buildBookFromStoredRow 遇到已规整 EPUB 时不会重复标记修复", () => {
  const { book, needsEpubRepair } = buildBookFromStoredRow({
    id: "book-1",
    user_id: "user-1",
    title: "运营之光",
    author: "黄有璨",
    format: "EPUB",
    file_path: "minio://lumina-books/demo.epub",
    cover_path: "",
    total_pages: 2,
    read_progress: 0,
    last_read_at: null,
    tags: ["EPUB"],
    status: "READY",
    synopsis: "版权信息\n\n书名：运营之光\n\n作者：黄有璨",
    toc: [
      { id: "toc-1", title: "第1章 运营是什么", pageIndex: 1 }
    ],
    content: [
      {
        id: "section-1",
        title: "第1章 运营是什么",
        pageIndex: 1,
        content: [
          "很多运营从业者之所以会迷茫。",
          "在互联网行业中，“运营”这个职能的诞生。",
          "产品负责界定和提供长期用户价值。"
        ].join("\n\n"),
        blocks: [
          { type: "paragraph", text: "很多运营从业者之所以会迷茫。" },
          { type: "paragraph", text: "在互联网行业中，“运营”这个职能的诞生。" },
          { type: "paragraph", text: "产品负责界定和提供长期用户价值。" }
        ]
      }
    ],
    created_at: "2026-03-24T00:00:00.000Z"
  })

  assert.equal(needsEpubRepair, false)
  assert.equal(book.content[0]?.blocks?.length, 3)
})
