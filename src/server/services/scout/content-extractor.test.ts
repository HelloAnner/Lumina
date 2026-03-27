/**
 * 文章正文提取测试
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import * as contentExtractor from "@/src/server/services/scout/content-extractor"

const { extractFromHtml } = contentExtractor

test("extractFromHtml 保留正文中的图片并尽量维持原始位置", () => {
  const html = `
    <html>
      <body>
        <article>
          <h1>AI Revolution</h1>
          <p>第一段。</p>
          <p><img src="/images/ai.png" alt="AI 图示" /></p>
          <p>第二段。</p>
        </article>
      </body>
    </html>
  `

  const result = extractFromHtml(html, "https://waitbutwhy.com/post")

  assert.ok(result)
  assert.equal(result?.content[0]?.type, "heading")
  assert.equal(result?.content[1]?.type, "paragraph")
  assert.equal(result?.content[2]?.type, "image")
  assert.equal(result?.content[2]?.src, "https://waitbutwhy.com/images/ai.png")
  assert.equal(result?.content[3]?.type, "paragraph")
})

test("extractFromHtml 支持从 srcset 中提取图片地址", () => {
  const html = `
    <html>
      <body>
        <article>
          <p>开始。</p>
          <img
            srcset="https://cdn.example.com/small.png 300w, https://cdn.example.com/large.png 1200w"
            alt="图表"
          />
          <p>结束。</p>
        </article>
      </body>
    </html>
  `

  const result = extractFromHtml(html, "https://example.com/post")
  const image = result?.content.find((item) => item.type === "image")

  assert.ok(image)
  assert.equal(image?.src, "https://cdn.example.com/large.png")
})

test("extractFromHtml 解析网页发布时间元数据", () => {
  const html = `
    <html>
      <head>
        <meta property="article:published_time" content="2026-03-24T06:30:00Z" />
      </head>
      <body>
        <article>
          <h1>Why calm products matter</h1>
          <p>Thoughtful software needs rhythm.</p>
          <p>Second paragraph to satisfy readability threshold.</p>
          <p>Third paragraph to keep the article body intact.</p>
        </article>
      </body>
    </html>
  `

  const result = extractFromHtml(html, "https://example.com/post")

  assert.ok(result)
  assert.equal(result?.publishedAt, "2026-03-24T06:30:00.000Z")
})

test("content extractor 对 x 状态页选择专用解析器", () => {
  const matchContentExtractor = (
    contentExtractor as {
      matchContentExtractor?: (url: string) => { key: string }
    }
  ).matchContentExtractor

  assert.equal(typeof matchContentExtractor, "function")
  assert.equal(
    matchContentExtractor?.("https://x.com/AlchainHust/status/2037183105602109498").key,
    "x"
  )
  assert.equal(matchContentExtractor?.("https://waitbutwhy.com/2015/01/artificial-intelligence-revolution-1.html").key, "generic")
})

test("content extractor 能从 x tweet payload 提取正文和图片", () => {
  const extractFromXTweetPayload = (
    contentExtractor as {
      extractFromXTweetPayload?: (payload: unknown) => ReturnType<typeof extractFromHtml>
    }
  ).extractFromXTweetPayload

  assert.equal(typeof extractFromXTweetPayload, "function")

  const result = extractFromXTweetPayload?.({
    id_str: "2037183105602109498",
    lang: "zxx",
    created_at: "2026-03-26T15:01:16.000Z",
    text: "https://t.co/6Phzs4TztH",
    display_text_range: [0, 23],
    entities: {
      hashtags: [],
      urls: [
        {
          display_url: "x.com/i/article/2037…",
          expanded_url: "https://x.com/i/article/2037182794569572358",
          indices: [0, 23],
          url: "https://t.co/6Phzs4TztH"
        }
      ],
      user_mentions: [],
      symbols: []
    },
    user: {
      id_str: "232519529",
      name: "花叔",
      screen_name: "AlchainHust"
    },
    article: {
      rest_id: "2037182794569572358",
      title: "林俊旸从阿里离开后首度发声：推理模型的时代快结束了",
      preview_text:
        "林俊旸，前通义千问 Qwen 负责人，北大外语硕士，阿里最年轻 P10。2026 年 3 月从阿里离职后三周，他发了一篇 6000 字的英文长文。",
      cover_media: {
        media_info: {
          original_img_url: "https://pbs.twimg.com/media/HEWHOrZbIAA3FEv.jpg",
          original_img_width: 1126,
          original_img_height: 450
        }
      }
    }
  })

  assert.ok(result)
  assert.equal(result?.title, "林俊旸从阿里离开后首度发声：推理模型的时代快结束了")
  assert.equal(result?.author, "花叔")
  assert.equal(result?.siteName, "X")
  assert.equal(result?.publishedAt, "2026-03-26T15:01:16.000Z")
  assert.deepEqual(result?.content.map((section) => section.type), ["paragraph", "image"])
  const firstSection = result?.content[0]
  const secondSection = result?.content[1]
  const firstText = firstSection && firstSection.type === "paragraph" ? firstSection.text ?? "" : ""
  const secondImageSrc = secondSection && secondSection.type === "image" ? secondSection.src ?? "" : ""

  assert.equal(firstSection?.type, "paragraph")
  assert.match(firstText, /林俊旸/)
  assert.equal(secondSection?.type, "image")
  assert.equal(secondImageSrc, "https://pbs.twimg.com/media/HEWHOrZbIAA3FEv.jpg")
})

test("content extractor 能从 x GraphQL tweet 结果提取完整文章正文和图片", () => {
  const extractFromXGraphqlTweetResult = (
    contentExtractor as {
      extractFromXGraphqlTweetResult?: (payload: unknown) => ReturnType<typeof extractFromHtml>
    }
  ).extractFromXGraphqlTweetResult

  assert.equal(typeof extractFromXGraphqlTweetResult, "function")

  const result = extractFromXGraphqlTweetResult?.({
    data: {
      tweetResult: {
        result: {
          __typename: "Tweet",
          core: {
            user_results: {
              result: {
                legacy: {
                  name: "花叔",
                  screen_name: "AlchainHust"
                }
              }
            }
          },
          legacy: {
            created_at: "Thu Mar 27 07:01:16 +0000 2026"
          },
          article: {
            article_results: {
              result: {
                title: "林俊旸从阿里离开后首度发声：推理模型的时代快结束了",
                preview_text: "这是 preview，不应替代全文。",
                plain_text:
                  "第一段完整正文。\\n\\n第二段完整正文。\\n\\n第三段完整正文。",
                cover_media: {
                  media_info: {
                    original_img_url: "https://pbs.twimg.com/media/cover.jpg"
                  }
                },
                media_entities: [
                  {
                    media_id: "2037183021628219395",
                    media_info: {
                      original_img_url: "https://pbs.twimg.com/media/body.jpg"
                    }
                  }
                ],
                content_state: {
                  blocks: [
                    { key: "a", text: "第一段完整正文。", type: "unstyled", entityRanges: [], inlineStyleRanges: [], data: {} },
                    {
                      key: "img",
                      text: " ",
                      type: "atomic",
                      inlineStyleRanges: [],
                      data: {},
                      entityRanges: [{ key: 0, length: 1, offset: 0 }]
                    },
                    { key: "b", text: "第二段完整正文。", type: "unstyled", entityRanges: [], inlineStyleRanges: [], data: {} },
                    { key: "c", text: "第三段完整正文。", type: "unstyled", entityRanges: [], inlineStyleRanges: [], data: {} }
                  ],
                  entityMap: [
                    {
                      key: "0",
                      value: {
                        type: "MEDIA",
                        mutability: "Immutable",
                        data: {
                          mediaItems: [{ mediaId: "2037183021628219395" }]
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    }
  })

  assert.ok(result)
  assert.equal(result?.title, "林俊旸从阿里离开后首度发声：推理模型的时代快结束了")
  assert.equal(result?.author, "花叔")
  assert.equal(result?.siteName, "X")
  assert.equal(result?.publishedAt, "2026-03-27T07:01:16.000Z")
  assert.deepEqual(result?.content.map((section) => section.type), ["image", "paragraph", "image", "paragraph", "paragraph"])
  assert.equal(result?.content[0]?.type === "image" ? result.content[0].src : "", "https://pbs.twimg.com/media/cover.jpg")
  assert.equal(result?.content[1]?.type === "paragraph" ? result.content[1].text : "", "第一段完整正文。")
  assert.equal(result?.content[2]?.type === "image" ? result.content[2].src : "", "https://pbs.twimg.com/media/body.jpg")
  assert.equal(result?.content[3]?.type === "paragraph" ? result.content[3].text : "", "第二段完整正文。")
  assert.equal(result?.content[4]?.type === "paragraph" ? result.content[4].text : "", "第三段完整正文。")
})
