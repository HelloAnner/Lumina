# 文章发布时间展示

## 目标

让文章阅读页在标题旁边显示发布时间，同时让手动解析与重新抓取链路把网页中的发布时间解析出来并持久化，避免列表页、阅读页展示不一致。

## 范围

- 阅读页标题右侧增加一段小号、灰色的发布时间文案
- 手动导入文章时，从原始 HTML 中提取发布时间并写入 `ScoutArticle.publishedAt`
- 重新抓取文章正文时，同步刷新 `publishedAt`
- 文章阅读器的进度记录升级为带 `progress id` 与 `currentPageId` 的精细定位
- 共享阅读页复用同一份文章数据，不额外做展示分叉

## 解析策略

- 优先读取网页显式元数据：
  - `meta[property="article:published_time"]`
  - `meta[property="og:published_time"]`
  - `meta[name="pubdate"]`
  - `meta[name="publish-date"]`
  - `meta[itemprop="datePublished"]`
- 如果元数据缺失，再尝试读取：
  - `script[type="application/ld+json"]` 中的 `datePublished`
  - 页面内 `time[datetime]`
- 成功解析后统一标准化为 ISO 字符串再存储；无法标准化则丢弃，避免脏数据进入库

## 展示规则

- 仅在存在 `publishedAt` 时展示
- 文案靠近文章标题，字号比标题明显更小，颜色使用次级灰度
- 展示格式优先使用 `YYYY-MM-DD`
- 列表页使用同一套规则的摘要版：7 天内显示相对时间，超过 7 天显示 `YYYY-MM-DD`
- 不引入额外图标，不打断现有阅读器的安静信息密度

## 约束

- 不改变已有 RSS / Scout 流水线对 `publishedAt` 的写入方式
- 不因为发布时间缺失而阻断文章导入
- 重新抓取失败时保持现有文章数据不被破坏
