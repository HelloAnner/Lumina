/**
 * EPUB 元数据图片解析测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import { parseEpubMetadataFromEntries } from "@/src/server/services/books/metadata"

test("parseEpubMetadataFromEntries 会把章节图片解析到 blocks 中", async () => {
  const result = await parseEpubMetadataFromEntries(
    {
      containerXml: `
        <container>
          <rootfiles>
            <rootfile full-path="OPS/content.opf" />
          </rootfiles>
        </container>
      `,
      opfXml: `
        <package>
          <metadata>
            <title>图片 EPUB</title>
            <creator>作者</creator>
          </metadata>
          <manifest>
            <item id="chapter-1" href="text/chapter-1.xhtml" />
          </manifest>
          <spine>
            <itemref idref="chapter-1" />
          </spine>
        </package>
      `,
      sections: {
        "OPS/text/chapter-1.xhtml": `
          <html>
            <body>
              <h1>第一章</h1>
              <p>图片前</p>
              <img src="../images/pic.png" alt="插图" />
              <p>图片后</p>
            </body>
          </html>
        `
      }
    },
    async (sectionHref, assetPath) => {
      assert.equal(sectionHref, "text/chapter-1.xhtml")
      assert.equal(assetPath, "../images/pic.png")
      return "data:image/png;base64,ZmFrZQ=="
    }
  )

  assert.equal(result.sections.length, 1)
  assert.deepEqual(result.sections[0].blocks, [
    {
      type: "paragraph",
      text: "第一章"
    },
    {
      type: "paragraph",
      text: "图片前"
    },
    {
      type: "image",
      src: "data:image/png;base64,ZmFrZQ==",
      alt: "插图"
    },
    {
      type: "paragraph",
      text: "图片后"
    }
  ])
})
