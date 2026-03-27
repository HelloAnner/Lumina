# URL 路由解析器

## 目标

让文章解析从“单一通用解析器”演进为“按 URL 选择子解析器”，以便对特殊站点做针对性提取，同时保留通用网页作为稳定兜底。

## 当前结构

- `generic`：通用 HTML 解析器
  - 负责抓取网页、运行 Readability、把 HTML 规整为 `ArticleSection[]`
  - 适用于普通博客、新闻站、内容页
- `x`：X 状态页解析器
  - 只匹配 `x.com` / `twitter.com` 的 `status/:id`
  - 通过 tweet id 拉取专用 payload，而不是依赖壳页面 HTML
  - 只输出正文段落与图片，不保留互动信息、按钮文案、头像、计数等社交外壳
- `base`：解析底座
  - 承载抓页面、发布时间提取、图片地址规整、HTML 转 section 等公共能力

## 路由规则

- 命中 `x.com` / `twitter.com` 状态页时，优先走 `x` 解析器
- 其余 URL 默认走 `generic`
- 专用解析器失败时，统一入口仍会回退到通用解析器，避免整条导入链路直接失效

## X 解析策略

- 从状态页 URL 提取 tweet id
- 优先请求 X 的 `TweetResultByRestId` GraphQL，展开原生 X Article 的完整正文块
- 若 GraphQL 不可用，再回退到 syndication payload，至少保留 preview 与图片
- 读取正文时优先级如下：
  - `article.article_results.result.content_state.blocks`
  - `article.article_results.result.plain_text`
  - `article.preview_text`
  - `note_tweet.note_tweet_results.result.text`
  - `full_text` / `text`
- 读取图片时优先收集：
  - 原生 X Article 的 `cover_media`
  - `article.media_entities`
  - tweet 自带照片
  - `mediaDetails`
  - `extended_entities.media`
- 输出时只保留：
  - `paragraph`
  - `image`

## 归一化

- 通用 URL 继续移除常见追踪参数
- 对 `x` 状态页额外移除 `s`、`t`、`ref_src`，避免分享链接形成重复文章

## 当前边界

- 当前 `x` 解析器专注于状态页与其直连的原生预览内容
- 如果后续需要支持完整 X Article 正文、多图说明、视频封面或引用链，可以在现有路由框架上继续扩展，不需要改动通用解析器
