import assert from "node:assert/strict"
import {
  deriveBookMetadata,
  parseEpubMetadataFromEntries
} from "@/src/server/services/books/metadata"

async function main() {
  const hardParsed = parseEpubMetadataFromEntries({
    containerXml:
      '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" /></rootfiles></container>',
    opfXml: `<?xml version="1.0" encoding="utf-8"?>
      <package>
        <metadata>
          <dc:title>Deep Work</dc:title>
          <dc:creator>Cal Newport</dc:creator>
          <dc:subject>Productivity</dc:subject>
          <dc:subject>Focus</dc:subject>
        </metadata>
        <manifest>
          <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml" />
        </manifest>
        <spine>
          <itemref idref="c1" />
        </spine>
      </package>`,
    sections: {
      "OEBPS/chapter1.xhtml": "<html><body><h1>Chapter 1</h1><p>Attention is the new oil.</p></body></html>"
    }
  })

  assert.equal(hardParsed.title, "Deep Work")
  assert.equal(hardParsed.author, "Cal Newport")
  assert.equal(hardParsed.format, "EPUB")
  assert.deepEqual(hardParsed.tags, ["Productivity", "Focus"])
  assert.equal(hardParsed.sections[0]?.title, "Chapter 1")

  const derived = await deriveBookMetadata({
    fileName: "deep-work.epub",
    userId: "demo",
    hardParsed,
    llmConfig: null
  })

  assert.equal(derived.parseMode, "hard")
  assert.equal(derived.toastMessage, "未配置大模型，已帮你自动硬解析")

  console.log("upload metadata tests passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
