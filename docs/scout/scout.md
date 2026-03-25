# 搜寻 (Scout) — 互联网碎片化知识自动聚合系统 PRD

> 版本：v0.3（方案设计阶段）
> 日期：2026-03-24
> 模块编号：10-scout

---

## 一、产品定位

**一句话描述：** 自动化监听互联网公开信息源（X/Twitter、RSS、博客等），识别并提取高价值观点，以待审批 Patch 的形式融入用户知识库的对应观点节点中。

**核心理念：**

> 知识库不应仅由本地书籍喂养。互联网上散落着大量碎片化但高价值的观点——博客文章、推文线程、学术论文摘要、Newsletter 片段。搜寻模块将这些碎片自动聚合，作为知识库中已有观点的**外部佐证、补充视角或反面论据**，而非独立存在的信息流。

**与现有知识库的关系：**

```
书籍 ──→ 阅读器 ──→ 划线 ──→ AI 打散观点 ──→ 主题聚合 ──→ 观点文章（知识库核心）
                                                              ↑
互联网碎片 ──→ Scout 抓取 ──→ 文章库（阅读/划线） ──→ AI 打散观点 ──→ 主题聚合 ──→ 待审批 Patch
```

**核心设计思想：互联网文章 = 书籍的平替**

> Scout 抓取的每篇文章，在系统内的待遇与一本书完全等价：
> - 存入「文章库」，用户可阅读原文、高亮划线、翻译
> - AI 从划线中提取离散观点，匹配到知识库的主题树
> - 与书籍划线的观点一起聚合，形成跨源的主题文章
> - 区别仅在于：书籍划线直接聚合，互联网观点以 Patch 待审批

**设计原则：**

- **统一知识管道：** 互联网文章走与书籍相同的「阅读 → 划线 → 打散观点 → 主题聚合」管道，不另起炉灶
- **文章即一等公民：** 抓取的文章保存为可阅读、可划线、可翻译的完整阅读体，非临时数据
- **人在回路 (Human-in-the-Loop)：** AI 生成的观点补充必须经过用户审批，不自动合并
- **来源可溯：** 每条观点都保留来源文章、原始 URL、作者，支持跳回原文上下文
- **安静运行：** 后台静默抓取和分析，仅在有高价值匹配时通知用户

---

## 二、功能架构

### 2.1 侧边栏入口

在现有侧边栏中新增两个入口：「搜寻」和「文章」：

```
┌─────────┐
│  Logo   │
├─────────┤
│  书库   │
│  文章   │  ← 新增：互联网文章阅读库
│  知识库 │
│  搜寻   │  ← 新增：自动化抓取与审批
│  图谱   │
│  发布   │
├─────────┤
│  设置   │
└─────────┘
```

| 入口 | 图标 | 职责 |
|------|------|------|
| 文章 | `FileText` | 互联网文章的阅读库——按主题分类浏览、阅读原文、高亮划线、翻译 |
| 搜寻 | `Radar` | 后台任务管理——配置信息源、定时抓取、审批 Patch |

> 「文章」紧跟「书库」，因为它们是两种阅读体——本地书籍 vs 互联网文章。
> 「搜寻」紧跟「知识库」，因为它的产出直接流入知识库。

### 2.2 文章库页面 (/articles)

文章库是互联网抓取内容的阅读入口，体验对标书库（/library）。

**文章库首页 — 主题分类视图：**

```
┌─────────┬───────────────────────────────────────────────────────────┐
│         │  文章                                     [搜索] [筛选▾] │
│ Sidebar │                                                           │
│         │  ── 主题分类 ─────────────────────────────────────────    │
│         │                                                           │
│         │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│         │  │ AI & LLM    │  │ 分布式系统   │  │ 第一性原理   │      │
│         │  │ 23 篇文章    │  │ 8 篇文章    │  │ 12 篇文章    │      │
│         │  │ 最近: 2h ago │  │ 最近: 1d ago│  │ 最近: 3h ago │      │
│         │  └─────────────┘  └─────────────┘  └─────────────┘      │
│         │                                                           │
│         │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│         │  │ 产品设计     │  │ 投资理念     │  │ 未分类       │      │
│         │  │ 5 篇文章     │  │ 15 篇文章   │  │ 3 篇文章     │      │
│         │  └─────────────┘  └─────────────┘  └─────────────┘      │
│         │                                                           │
│         │  ── 最近阅读 ─────────────────────────────────────────    │
│         │                                                           │
│         │  ┌──────────────────────────────────────────────────┐     │
│         │  │ Why RAG Still Matters in 2026                    │     │
│         │  │ @SimonW · Hacker News · 2h ago · 阅读进度 45%    │     │
│         │  ├──────────────────────────────────────────────────┤     │
│         │  │ 知识图谱与大语言模型的融合路径                     │     │
│         │  │ 知乎专栏 · 5h ago · 阅读进度 100%                │     │
│         │  └──────────────────────────────────────────────────┘     │
└─────────┴───────────────────────────────────────────────────────────┘
```

**点击主题分类 → 文章列表：**

```
┌─────────┬───────────────────────────────────────────────────────────┐
│         │  文章 > AI & LLM                          [← 返回] [排序] │
│ Sidebar │                                                           │
│         │  ┌──────────────────────────────────────────────────┐     │
│         │  │ Why RAG Still Matters in 2026                    │     │
│         │  │ Simon Willison · hnrss.org · 2026-03-24          │     │
│         │  │ 3 条划线 · 阅读 45%                    AI & LLM  │     │
│         │  ├──────────────────────────────────────────────────┤     │
│         │  │ Scaling Retrieval-Augmented Generation            │     │
│         │  │ arXiv:2403.12345 · 2026-03-23                    │     │
│         │  │ 0 条划线 · 未读                        AI & LLM  │     │
│         │  ├──────────────────────────────────────────────────┤     │
│         │  │ ...                                              │     │
│         │  └──────────────────────────────────────────────────┘     │
└─────────┴───────────────────────────────────────────────────────────┘
```

**点击文章 → 文章阅读器 (/articles/[articleId])：**

与书籍阅读器 (/reader/[bookId]) 体验对齐，核心功能一致：

```
┌─────────┬──────────────────────────────────────────────────────────────┐
│         │  ← 文章库    Why RAG Still Matters in 2026    [翻译] [设置] │
│         │  Simon Willison · hnrss.org · 2026-03-24                    │
│ Sidebar │                                                              │
│         │  ┌───────────────────────────────────────────────────────┐   │
│         │  │                                                       │   │
│         │  │   (排版优美的文章正文区域)                              │   │
│         │  │                                                       │   │
│         │  │   In the rapidly evolving landscape of AI...          │   │
│         │  │                                                       │   │
│         │  │   ████████████████████████████  ← 用户高亮划线        │   │
│         │  │   ┌──────────────────────────┐                        │   │
│         │  │   │ 💡 高亮 │ 📝 批注 │ 🤖 AI │  ← 选中弹出菜单     │   │
│         │  │   └──────────────────────────┘                        │   │
│         │  │                                                       │   │
│         │  │   The key insight is that retrieval doesn't           │   │
│         │  │   replace generation — it grounds it...               │   │
│         │  │                                                       │   │
│         │  └───────────────────────────────────────────────────────┘   │
│         │                                                              │
│         │  ── 划线列表 (侧栏，可收起) ────────────                    │
│         │  • "RAG grounds generation..." (黄色)                       │
│         │  • "The key insight is..." (蓝色)                           │
└─────────┴──────────────────────────────────────────────────────────────┘
```

**文章阅读器功能对齐书籍阅读器：**

| 功能 | 书籍阅读器 | 文章阅读器 | 说明 |
|------|-----------|-----------|------|
| 高亮划线 | ✅ 多色 | ✅ 多色 | 选中文字 → 弹出操作菜单 → 高亮 |
| 批注 | ✅ | ✅ | 划线后附加文字批注 |
| AI 即时理解 | ✅ | ✅ | 选中文字 → AI 解释/扩展 |
| 翻译 | ✅ 全文/段落 | ✅ 全文/段落 | 调用用户绑定的翻译模型 |
| 阅读进度 | ✅ | ✅ | 自动记录滚动位置 |
| 排版设置 | ✅ 字体/行距/主题 | ✅ 字体/行距/主题 | 复用 ReaderSettings |
| 原文跳转 | N/A | ✅ | 顶部显示来源 URL，一键打开原文 |
| 来源标注 | 书名/章节 | 渠道/作者/日期 | 划线携带来源元信息 |

> 文章划线产生的 Highlight 与书籍划线结构完全相同，仅 `sourceType` 区分。
> 这样在知识库聚合时，书籍观点和文章观点可以无缝混合。

### 2.3 搜寻页面 (/scout) — 双视图切换

搜寻页面顶部有两个 Tab 视图：「审批台」和「任务管理」。

**视图 A：审批台（默认）**

用户日常使用的主视图，聚焦 Patch 审批：

```
┌─────────┬───────────────────────────────────────────────────────────┐
│         │  搜寻    [审批台] [任务管理]               [3 待审批] [▶] │
│ Sidebar │┌──────────────┬──────────────────────┬──────────────────┐│
│         ││  任务筛选      │   待审批 Patches     │   Patch 详情     ││
│         ││              │                      │                  ││
│         ││  ▸ 全部任务   │  ┌─────────────────┐ │  标题: xxx       ││
│         ││  ▸ HN 日常    │  │ Patch #12       │ │  目标观点: xxx   ││
│         ││  ▸ arXiv AI  │  │ → "第一性原理"   │ │                  ││
│         ││  ▸ X 大佬观点 │  │ 来源: @naval     │ │  [建议内容预览]   ││
│         ││              │  │ 置信度: 0.87      │ │                  ││
│         ││  ─────────── │  └─────────────────┘ │  [Diff 视图]     ││
│         ││  最近执行     │  ┌─────────────────┐ │                  ││
│         ││  ▸ 12:00 ✓3  │  │ Patch #11       │ │  [批准] [拒绝]   ││
│         ││  ▸ 08:00 ✓1  │  │ → "长期主义"     │ │  [追问扩展]      ││
│         ││              │  └─────────────────┘ │                  ││
│         │└──────────────┴──────────────────────┴──────────────────┘│
└─────────┴───────────────────────────────────────────────────────────┘
```

| 栏位 | 宽度 | 功能 |
|------|------|------|
| 左栏 - 任务筛选 | 240px 可拖拽 | 按任务筛选 Patch、最近执行日志 |
| 中栏 - Patch 列表 | 弹性 | 待审批 Patch 卡片流，支持筛选和排序 |
| 右栏 - Patch 详情 | 400px 可拖拽 | Patch 内容预览、Diff 视图、审批操作 |

**视图 B：任务管理**

任务和信息源的配置管理视图：

```
┌─────────┬───────────────────────────────────────────────────────────┐
│         │  搜寻    [审批台] [任务管理]                    [+ 新任务] │
│ Sidebar │┌──────────────────────────────────────────────────────────┐│
│         ││  ┌────────────────────────────────────────────────────┐ ││
│         ││  │ 📡 HN 日常扫描                    每2小时 | 运行中 │ ││
│         ││  │ 信息源: HN热门, HN:LLM             上次: 12:00    │ ││
│         ││  │ 范围: 全部观点  阈值: 0.7  Patch: 3/10            │ ││
│         ││  │                          [编辑] [暂停] [立即运行] │ ││
│         ││  └────────────────────────────────────────────────────┘ ││
│         ││  ┌────────────────────────────────────────────────────┐ ││
│         ││  │ 🎓 arXiv AI 论文追踪                 每天8:00     │ ││
│         ││  │ 信息源: arXiv:cs.AI, arXiv:cs.CL    上次: 08:00  │ ││
│         ││  │ 范围: "AI认知"分支  阈值: 0.8                     │ ││
│         ││  │                          [编辑] [暂停] [立即运行] │ ││
│         ││  └────────────────────────────────────────────────────┘ ││
│         ││  ┌────────────────────────────────────────────────────┐ ││
│         ││  │ 🐦 X 大佬观点                       每小时        │ ││
│         ││  │ 信息源: X:@naval, X:@paulg, X:#ai   上次: 11:30  │ ││
│         ││  │ 范围: 全部观点  阈值: 0.6                         │ ││
│         ││  │                          [编辑] [暂停] [立即运行] │ ││
│         ││  └────────────────────────────────────────────────────┘ ││
│         │└──────────────────────────────────────────────────────────┘│
└─────────┴───────────────────────────────────────────────────────────┘
```

**新建/编辑任务流程（Dialog 表单）：**

```
┌──────────────────────────────────────────────────┐
│  新建搜寻任务                                     │
│                                                   │
│  任务名称: [HN 日常扫描                        ]  │
│  任务描述: [追踪 HN 技术社区热门话题           ]  │
│                                                   │
│  ── 信息源 ──────────────────────────────────     │
│  已添加:                                          │
│    • HN 热门              [×]                     │
│    • HN 关键词: LLM       [×]                     │
│  [+ 从渠道添加信息源]                              │
│                                                   │
│  ── 定时策略 ────────────────────────────────     │
│  ○ 手动触发                                       │
│  ● 定时执行: [每 2 小时 ▾]                        │
│    自定义 cron: [0 */2 * * *]                     │
│                                                   │
│  ── AI 分析配置 ─────────────────────────────     │
│  匹配阈值: [0.7] (0~1，越高越严格)                │
│  单次 Patch 上限: [10]                            │
│  目标观点范围:                                     │
│    ○ 全部观点                                     │
│    ● 指定分支: [选择观点树节点...]                  │
│                                                   │
│                        [取消]  [保存]              │
└──────────────────────────────────────────────────┘
```

**从渠道添加信息源（嵌套 Dialog）：**

```
┌──────────────────────────────────────────────────┐
│  添加信息源                                       │
│                                                   │
│  选择渠道:                                        │
│  ┌─────────────────────────────────────────────┐ │
│  │ 🔥 [科技] [英文]                            │ │
│  │ Hacker News - 热门                          │ │
│  │ HN 高分文章，技术社区风向标                   │ │
│  ├─────────────────────────────────────────────┤ │
│  │ 🔍 [科技] [英文]                            │ │
│  │ Hacker News - 关键词                        │ │
│  │ HN 关键词搜索，跟踪特定话题                   │ │
│  ├─────────────────────────────────────────────┤ │
│  │ 🎓 [学术] [论文]                            │ │
│  │ arXiv - 分类订阅                            │ │
│  │ arXiv 学术论文分类 RSS                       │ │
│  ├─────────────────────────────────────────────┤ │
│  │ 🐦 [社交] [实时]   需要 API 凭证            │ │
│  │ X - 用户时间线                              │ │
│  │ 跟踪指定 X 用户的推文                        │ │
│  ├─────────────────────────────────────────────┤ │
│  │ ... 更多渠道 ...                            │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  [筛选: 全部 | 科技 | 学术 | 中文 | 社交]         │
│                                                   │
│  ── 配置参数 ────────────────────────────────     │
│  (选择渠道后显示该渠道的参数表单)                    │
│  信息源名称: [HN: LLM 动态                     ]  │
│  搜索关键词: [LLM                               ]  │
│  过滤关键词(可选): 包含[     ] 排除[     ]         │
│                                                   │
│                        [取消]  [添加]              │
└──────────────────────────────────────────────────┘
```

### 2.3 设置页 — 搜寻渠道配置

在「设置」页面新增「搜寻渠道」Tab，用于：

1. **管理全局凭证**（如 X API Token）
2. **管理自定义渠道模板**
3. **配置全局参数**（RSSHub 实例、默认阈值等）

```
┌─────────┬───────────────────────────────────────────────────────────┐
│         │  设置                                                     │
│ Sidebar │  [模型] [存储] [阅读] [搜寻渠道]                          │
│         │                                                           │
│         │  ── API 凭证 ──────────────────────────────────────       │
│         │  X API Token: [••••••••••••••]  [验证] ✓ 已验证           │
│         │  RSSHub 实例: [https://rsshub.example.com] (可选)          │
│         │                                                           │
│         │  ── 全局配置 ──────────────────────────────────────       │
│         │  全局开关: [✓ 启用自动抓取]                                 │
│         │  默认匹配阈值: [0.6]                                       │
│         │  每日 Patch 上限: [20]                                     │
│         │  条目保留天数: [30]                                        │
│         │                                                           │
│         │  ── 自定义渠道 ─────────────────────────────── [+ 新增]   │
│         │  ┌──────────────────────────────────────────────────┐     │
│         │  │ 我的博客聚合 RSS  |  rss  |  模板: {blog_url}/rss │     │
│         │  │                              [编辑] [删除]       │     │
│         │  └──────────────────────────────────────────────────┘     │
│         │                                                           │
│         │  ── 内置渠道列表（只读预览） ──────────────────────        │
│         │  Hacker News - 热门  |  rss  |  hnrss.org                │
│         │  Reddit - 子版块     |  rss  |  reddit.com               │
│         │  arXiv - 分类订阅   |  rss  |  arxiv.org                 │
│         │  ...                                                     │
└─────────┴───────────────────────────────────────────────────────────┘
```

---

## 三、核心概念模型

### 3.1 渠道 (ScoutChannel) — 内置 + 用户自定义

渠道是信息源的**模板定义**。系统内置多种高价值渠道，用户也可自行添加。

**渠道协议类型：**

| 协议 | 说明 | 适配器 |
|------|------|--------|
| `rss` | RSS/Atom/JSON Feed 订阅 | RSS 适配器（统一处理所有 RSS 类源） |
| `x_api` | X/Twitter API v2 | X 适配器（需用户配置 API 凭证） |
| `webpage` | 网页正文抓取 | Webpage 适配器 |
| `newsletter` | 邮件订阅（预留） | 预留 |

**内置渠道注册表（开箱即用）：**

系统预置以下高价值渠道，用户只需选择并配置关注内容，无需手动填写 RSS 地址：

| 渠道名 | 协议 | 预置端点 | 说明 |
|--------|------|----------|------|
| Hacker News - 热门 | `rss` | `https://hnrss.org/best` | HN 高分文章 |
| Hacker News - 搜索 | `rss` | `https://hnrss.org/newest?q={keyword}` | HN 关键词搜索 |
| Reddit - 子版块 | `rss` | `https://www.reddit.com/r/{subreddit}/top.rss?t=week` | Reddit 指定子版块热帖 |
| Reddit - 搜索 | `rss` | `https://www.reddit.com/search.rss?q={keyword}&sort=relevance&t=week` | Reddit 关键词搜索 |
| arXiv - 分类 | `rss` | `https://rss.arxiv.org/rss/{category}` | arXiv 论文（如 cs.AI, cs.CL） |
| arXiv - 搜索 | `rss` | `https://export.arxiv.org/api/query?search_query={keyword}` | arXiv 关键词搜索 |
| Semantic Scholar | `rss` | 通过 API `https://api.semanticscholar.org/graph/v1/paper/search` | 学术论文搜索 |
| 微信公众号 | `rss` | 通过 WeRSS / RSSHub 等中间服务，如 `https://rsshub.app/wechat/mp/{id}` | 公众号文章 |
| 知乎专栏 | `rss` | `https://rsshub.app/zhihu/zhuanlan/{id}` | 知乎专栏文章 |
| 知乎热榜 | `rss` | `https://rsshub.app/zhihu/hotlist` | 知乎热门话题 |
| X - 用户时间线 | `x_api` | X API v2 `/2/users/{id}/tweets` | X 指定用户推文 |
| X - 关键词搜索 | `x_api` | X API v2 `/2/tweets/search/recent` | X 关键词搜索 |
| X - 列表 | `x_api` | X API v2 `/2/lists/{id}/tweets` | X 列表推文 |
| 自定义 RSS | `rss` | 用户填写 | 任意 RSS/Atom 地址 |
| 自定义网页 | `webpage` | 用户填写 | 任意网页正文抓取 |

> 内置渠道的端点中 `{keyword}`、`{subreddit}`、`{category}`、`{id}` 等为占位符，
> 用户在基于渠道创建信息源时填写具体值。

**用户自定义渠道：**

除内置渠道外，用户可在「设置 → 搜寻渠道」页面新增自定义渠道模板：
- 指定协议类型（rss / x_api / webpage）
- 填写端点 URL 模板（支持 `{keyword}` 等占位符）
- 设置默认抓取频率、默认过滤规则
- 自定义渠道会出现在「新建信息源」的渠道选择列表中，与内置渠道并列

### 3.2 信息源 (ScoutSource)

信息源是渠道的**实例化配置**。用户从渠道列表中选择一个渠道，填写具体参数后创建信息源。

关系：`渠道（模板）→ 信息源（实例）`

例如：
- 渠道 "Hacker News - 搜索" + 参数 `keyword=LLM` → 信息源 "HN: LLM 动态"
- 渠道 "Reddit - 子版块" + 参数 `subreddit=MachineLearning` → 信息源 "Reddit ML"
- 渠道 "arXiv - 分类" + 参数 `category=cs.AI` → 信息源 "arXiv AI 论文"

### 3.3 搜寻任务 (ScoutTask)

任务是搜寻的**执行调度单元**。用户在搜寻页面创建和管理任务：

- 一个任务绑定一个或多个信息源
- 配置定时策略（cron 或手动触发）
- 配置 AI 分析参数（匹配阈值、目标观点范围等）
- 支持启用/暂停/单次运行

任务与信息源的关系：`任务 (1) → 信息源 (N)`

**为什么需要任务层？**
- 信息源是"从哪取"，任务是"怎么调度、怎么分析"
- 同一个信息源可被多个任务引用（如日常低频扫描 + 重点话题高频监控）
- 任务粒度的日志和统计更便于管理

### 3.4 抓取条目 (ScoutEntry)

从信息源抓取的原始内容条目。每次任务执行产生若干条目，去重后存储。

### 3.5 知识 Patch (ScoutPatch)

核心概念。AI 分析抓取条目后，生成的「知识补丁」：

- 一个 Patch = 对某个观点文章的一次建议修改
- 包含：要插入的 NoteBlock 列表、建议插入位置、与原有内容的 Diff
- 必须经过用户审批才能合并

Patch 生命周期：

```
[pending] ──批准──→ [approved] ──合并──→ [merged]
    │
    ├──拒绝──→ [rejected]
    │
    └──追问──→ [expanding] ──AI 回复──→ [pending]（更新后重新待审）
```

### 3.6 追问扩展 (PatchThread)

用户对某个 Patch 的追问对话。用户可以：
- 要求 AI 补充更多论据
- 要求换一个角度阐述
- 要求精简或调整语气
- 指定合并到另一个观点

---

## 四、数据模型设计

### 4.1 新增类型定义

```typescript
// ─── 渠道协议类型 ───
export type ScoutChannelProtocol = "rss" | "x_api" | "webpage" | "newsletter"

// ─── 渠道来源 ───
export type ScoutChannelOrigin = "builtin" | "user"

// ─── 信息源状态 ───
export type ScoutSourceStatus = "active" | "paused" | "error"

// ─── 搜寻任务状态 ───
export type ScoutTaskStatus = "active" | "paused"

// ─── Patch 状态 ───
export type ScoutPatchStatus = "pending" | "approved" | "merged" | "rejected" | "expanding"

// ─── 抓取条目状态 ───
export type ScoutEntryStatus = "raw" | "analyzing" | "matched" | "discarded"

// ─── AI 分析特征绑定 ───
// 新增到 ModelFeature 联合类型
export type ModelFeature = ... | "scout_analyze" | "scout_expand"
```

### 4.2 ScoutArticle — 互联网文章（核心新增）

```typescript
/**
 * 互联网文章
 *
 * 从 ScoutEntry 清洗后生成的可阅读文章实体。
 * 在系统中的地位等同于 Book——可阅读、可划线、可翻译。
 *
 * 与 Book 的关键区别：
 * - 来源是互联网（非本地上传）
 * - 内容为单篇文章（非整本书）
 * - 无 PDF/EPUB 格式，统一为 HTML → 结构化内容
 */
export interface ScoutArticle {
  id: string
  userId: string
  /** 关联的 ScoutEntry ID（来源追溯） */
  entryId: string
  /** 来源信息源 ID */
  sourceId: string
  /** 文章标题 */
  title: string
  /** 作者 */
  author?: string
  /** 原始来源 URL */
  sourceUrl: string
  /** 来源渠道名（如 "Hacker News", "arXiv", "知乎专栏"，用于展示） */
  channelName: string
  /** 来源渠道图标 */
  channelIcon: string
  /** 原始发布时间 */
  publishedAt?: string
  /** 主题分类标签（AI 自动分类 + 用户可编辑） */
  topics: string[]
  /** 摘要（AI 生成或截取前 200 字） */
  summary: string
  /**
   * 文章结构化内容
   * 与 Book.content (ReaderSection[]) 对齐，复用阅读器渲染
   */
  content: ArticleSection[]
  /** 阅读进度 0~1 */
  readProgress: number
  /** 上次阅读位置（滚动偏移 or section index） */
  lastReadPosition?: string
  /** 上次阅读时间 */
  lastReadAt?: string
  /** 划线数 */
  highlightCount: number
  /** 文章语言（用于翻译判断） */
  language?: string
  /** 文章状态 */
  status: "ready" | "processing" | "failed"
  createdAt: string
}

/**
 * 文章内容段落
 * 与 ReaderSection 结构对齐，复用阅读器组件
 */
export interface ArticleSection {
  id: string
  /** 段落类型 */
  type: "heading" | "paragraph" | "image" | "code" | "blockquote" | "list"
  /** 标题级别（type=heading 时） */
  level?: 1 | 2 | 3
  /** 文本内容 */
  text?: string
  /** 图片地址（type=image 时） */
  src?: string
  alt?: string
  /** 代码语言（type=code 时） */
  language?: string
  /** 列表项（type=list 时） */
  items?: string[]
}

/**
 * 文章主题分类
 * 用于文章库的主题视图分组
 */
export interface ArticleTopic {
  id: string
  userId: string
  /** 主题名称 */
  name: string
  /** 主题描述 */
  description?: string
  /** 文章数量（计算字段） */
  articleCount: number
  /** 排序序号 */
  sortOrder: number
  createdAt: string
}

/**
 * 文章翻译
 * 与 BookTranslation 结构对齐
 */
export interface ArticleTranslation {
  id: string
  userId: string
  articleId: string
  /** 翻译的段落索引范围或全文 */
  sectionId: string
  sourceHash: string
  targetLanguage: string
  content: string
  modelId?: string
  createdAt: string
  updatedAt: string
}
```

**文章划线复用现有 Highlight 表：**

现有 `Highlight` 表需扩展以支持文章来源：

```typescript
// 扩展现有 Highlight 接口
export interface Highlight {
  // ... 现有字段 ...

  /**
   * 来源类型（新增）
   * "book" = 书籍划线（默认，向后兼容）
   * "article" = 互联网文章划线
   */
  sourceType: "book" | "article"
  /**
   * 文章 ID（sourceType="article" 时填充）
   * 与 bookId 互斥：书籍划线用 bookId，文章划线用 articleId
   */
  articleId?: string
}
```

> 关键设计决策：**文章划线复用 Highlight 表**而非新建表。
> 这样在知识库聚合阶段，HighlightViewpoint 表可以统一处理两种来源的划线，
> 无需任何聚合逻辑的修改——对于 AI 来说，一条划线就是一条划线，无论来自书还是文章。

### 4.3 ScoutChannel — 渠道定义（模板）

```typescript
/**
 * 搜寻渠道定义
 *
 * 渠道 = 信息源的模板。系统内置多种高价值渠道，用户也可自定义。
 * 用户基于渠道创建信息源实例时，填写占位符参数即可。
 */
export interface ScoutChannel {
  id: string
  /** 内置渠道无 userId（系统级），用户自定义渠道有 userId */
  userId?: string
  /** 渠道名称 */
  name: string
  /** 渠道描述 */
  description: string
  /** 渠道图标（lucide icon 名称） */
  icon: string
  /** 渠道协议类型 */
  protocol: ScoutChannelProtocol
  /** 来源：内置或用户自定义 */
  origin: ScoutChannelOrigin
  /** 渠道分类标签，用于筛选（如 "科技", "学术", "社交", "中文"） */
  tags: string[]
  /**
   * 端点 URL 模板，支持占位符
   * 占位符格式：{param_name}
   * 如 "https://hnrss.org/newest?q={keyword}"
   */
  endpointTemplate: string
  /**
   * 占位符参数声明
   * 定义此渠道需要用户填写的参数及其说明
   */
  params: ScoutChannelParam[]
  /** 默认抓取频率 cron，如 "0 * * * *" */
  defaultFetchCron: string
  /** 该协议是否需要全局凭证（如 x_api 需要 X API Token） */
  requiresCredential: boolean
  /** 关联的凭证类型标识（如 "x_api_token"），用于查找 ScoutCredential */
  credentialType?: string
  createdAt: string
}

/**
 * 渠道占位符参数定义
 */
export interface ScoutChannelParam {
  /** 参数名（对应 endpointTemplate 中的占位符） */
  name: string
  /** 参数显示标签 */
  label: string
  /** 参数说明/提示 */
  placeholder: string
  /** 是否必填 */
  required: boolean
  /** 参数类型，用于前端表单渲染 */
  inputType: "text" | "select"
  /** select 类型时的选项列表 */
  options?: { label: string; value: string }[]
}
```

**内置渠道数据（代码中硬编码，非数据库存储）：**

```typescript
/**
 * 内置渠道注册表
 * 代码中维护，作为 seed data 在首次加载时写入
 */
export const BUILTIN_CHANNELS: Omit<ScoutChannel, "id" | "createdAt">[] = [
  // ─── Hacker News ───
  {
    name: "Hacker News - 热门",
    description: "HN 高分文章，技术社区风向标",
    icon: "Flame",
    protocol: "rss",
    origin: "builtin",
    tags: ["科技", "编程", "英文"],
    endpointTemplate: "https://hnrss.org/best?count=30",
    params: [],
    defaultFetchCron: "0 */2 * * *",
    requiresCredential: false,
  },
  {
    name: "Hacker News - 关键词",
    description: "HN 关键词搜索，跟踪特定话题",
    icon: "Search",
    protocol: "rss",
    origin: "builtin",
    tags: ["科技", "编程", "英文"],
    endpointTemplate: "https://hnrss.org/newest?q={keyword}&count=30",
    params: [
      { name: "keyword", label: "搜索关键词", placeholder: "如 LLM, RAG, vector database", required: true, inputType: "text" }
    ],
    defaultFetchCron: "0 */4 * * *",
    requiresCredential: false,
  },

  // ─── Reddit ───
  {
    name: "Reddit - 子版块",
    description: "Reddit 指定 subreddit 热帖",
    icon: "MessageCircle",
    protocol: "rss",
    origin: "builtin",
    tags: ["社区", "讨论", "英文"],
    endpointTemplate: "https://www.reddit.com/r/{subreddit}/top.rss?t=week",
    params: [
      { name: "subreddit", label: "子版块名", placeholder: "如 MachineLearning, programming", required: true, inputType: "text" }
    ],
    defaultFetchCron: "0 */6 * * *",
    requiresCredential: false,
  },
  {
    name: "Reddit - 关键词",
    description: "Reddit 全站关键词搜索",
    icon: "Search",
    protocol: "rss",
    origin: "builtin",
    tags: ["社区", "讨论", "英文"],
    endpointTemplate: "https://www.reddit.com/search.rss?q={keyword}&sort=relevance&t=week",
    params: [
      { name: "keyword", label: "搜索关键词", placeholder: "如 transformer, knowledge graph", required: true, inputType: "text" }
    ],
    defaultFetchCron: "0 */6 * * *",
    requiresCredential: false,
  },

  // ─── arXiv ───
  {
    name: "arXiv - 分类订阅",
    description: "arXiv 学术论文分类 RSS",
    icon: "GraduationCap",
    protocol: "rss",
    origin: "builtin",
    tags: ["学术", "论文", "英文"],
    endpointTemplate: "https://rss.arxiv.org/rss/{category}",
    params: [
      {
        name: "category", label: "论文分类", placeholder: "选择 arXiv 分类", required: true, inputType: "select",
        options: [
          { label: "AI - 人工智能", value: "cs.AI" },
          { label: "CL - 计算语言学", value: "cs.CL" },
          { label: "CV - 计算机视觉", value: "cs.CV" },
          { label: "LG - 机器学习", value: "cs.LG" },
          { label: "IR - 信息检索", value: "cs.IR" },
          { label: "SE - 软件工程", value: "cs.SE" },
          { label: "CR - 密码学", value: "cs.CR" },
          { label: "DC - 分布式计算", value: "cs.DC" },
        ]
      }
    ],
    defaultFetchCron: "0 8 * * *",
    requiresCredential: false,
  },
  {
    name: "arXiv - 关键词搜索",
    description: "arXiv 论文关键词搜索",
    icon: "Search",
    protocol: "rss",
    origin: "builtin",
    tags: ["学术", "论文", "英文"],
    endpointTemplate: "https://export.arxiv.org/api/query?search_query=all:{keyword}&sortBy=submittedDate&sortOrder=descending&max_results=20",
    params: [
      { name: "keyword", label: "搜索关键词", placeholder: "如 retrieval augmented generation", required: true, inputType: "text" }
    ],
    defaultFetchCron: "0 8 * * *",
    requiresCredential: false,
  },

  // ─── Semantic Scholar ───
  {
    name: "Semantic Scholar - 论文搜索",
    description: "学术论文语义搜索，覆盖多数据源",
    icon: "BookOpen",
    protocol: "rss",
    origin: "builtin",
    tags: ["学术", "论文", "英文"],
    endpointTemplate: "https://api.semanticscholar.org/graph/v1/paper/search?query={keyword}&limit=20&fields=title,abstract,url,authors,year",
    params: [
      { name: "keyword", label: "搜索关键词", placeholder: "如 knowledge graph embedding", required: true, inputType: "text" }
    ],
    defaultFetchCron: "0 8 * * 1",
    requiresCredential: false,
  },

  // ─── 中文平台 ───
  {
    name: "微信公众号",
    description: "通过 RSSHub 订阅微信公众号文章",
    icon: "MessageSquare",
    protocol: "rss",
    origin: "builtin",
    tags: ["中文", "博客", "观点"],
    endpointTemplate: "https://rsshub.app/wechat/mp/{account_id}",
    params: [
      { name: "account_id", label: "公众号 ID", placeholder: "公众号的微信号或 biz 参数", required: true, inputType: "text" }
    ],
    defaultFetchCron: "0 */4 * * *",
    requiresCredential: false,
  },
  {
    name: "知乎专栏",
    description: "通过 RSSHub 订阅知乎专栏",
    icon: "PenLine",
    protocol: "rss",
    origin: "builtin",
    tags: ["中文", "深度", "观点"],
    endpointTemplate: "https://rsshub.app/zhihu/zhuanlan/{column_id}",
    params: [
      { name: "column_id", label: "专栏 ID", placeholder: "知乎专栏 URL 中的 ID，如 c_1234567", required: true, inputType: "text" }
    ],
    defaultFetchCron: "0 */6 * * *",
    requiresCredential: false,
  },
  {
    name: "知乎热榜",
    description: "知乎全站热门话题",
    icon: "TrendingUp",
    protocol: "rss",
    origin: "builtin",
    tags: ["中文", "热点"],
    endpointTemplate: "https://rsshub.app/zhihu/hotlist",
    params: [],
    defaultFetchCron: "0 */2 * * *",
    requiresCredential: false,
  },

  // ─── X/Twitter ───
  {
    name: "X - 用户时间线",
    description: "跟踪指定 X 用户的推文",
    icon: "Twitter",
    protocol: "x_api",
    origin: "builtin",
    tags: ["社交", "观点", "实时"],
    endpointTemplate: "/2/users/{user_id}/tweets",
    params: [
      { name: "user_id", label: "用户 ID 或用户名", placeholder: "如 elonmusk 或数字 ID", required: true, inputType: "text" }
    ],
    defaultFetchCron: "0 * * * *",
    requiresCredential: true,
    credentialType: "x_api_token",
  },
  {
    name: "X - 关键词搜索",
    description: "X 全站关键词搜索，追踪话题动态",
    icon: "Search",
    protocol: "x_api",
    origin: "builtin",
    tags: ["社交", "观点", "实时"],
    endpointTemplate: "/2/tweets/search/recent?query={keyword}",
    params: [
      { name: "keyword", label: "搜索关键词", placeholder: "支持 X 搜索语法，如 LLM lang:en -is:retweet", required: true, inputType: "text" }
    ],
    defaultFetchCron: "0 */2 * * *",
    requiresCredential: true,
    credentialType: "x_api_token",
  },
  {
    name: "X - 列表",
    description: "跟踪 X 列表中所有成员的推文",
    icon: "List",
    protocol: "x_api",
    origin: "builtin",
    tags: ["社交", "观点", "实时"],
    endpointTemplate: "/2/lists/{list_id}/tweets",
    params: [
      { name: "list_id", label: "列表 ID", placeholder: "X 列表的数字 ID", required: true, inputType: "text" }
    ],
    defaultFetchCron: "0 * * * *",
    requiresCredential: true,
    credentialType: "x_api_token",
  },

  // ─── 通用 ───
  {
    name: "自定义 RSS",
    description: "订阅任意 RSS/Atom/JSON Feed 地址",
    icon: "Rss",
    protocol: "rss",
    origin: "builtin",
    tags: ["通用"],
    endpointTemplate: "{feed_url}",
    params: [
      { name: "feed_url", label: "Feed 地址", placeholder: "完整的 RSS/Atom URL", required: true, inputType: "text" }
    ],
    defaultFetchCron: "0 * * * *",
    requiresCredential: false,
  },
  {
    name: "自定义网页",
    description: "定时抓取指定网页正文内容",
    icon: "Globe",
    protocol: "webpage",
    origin: "builtin",
    tags: ["通用"],
    endpointTemplate: "{page_url}",
    params: [
      { name: "page_url", label: "网页地址", placeholder: "完整 URL", required: true, inputType: "text" }
    ],
    defaultFetchCron: "0 */6 * * *",
    requiresCredential: false,
  },
]
```

### 4.3 ScoutCredential — 全局凭证

```typescript
/**
 * 搜寻全局凭证
 *
 * 某些渠道协议需要 API 凭证（如 X API Token）。
 * 凭证全局配置一次，所有使用该协议的信息源共享。
 * 在「设置 → 搜寻渠道」页面配置。
 */
export interface ScoutCredential {
  id: string
  userId: string
  /** 凭证类型标识，与 ScoutChannel.credentialType 对应 */
  type: string
  /** 凭证显示名称 */
  name: string
  /** 凭证键值对（加密存储） */
  credentials: Record<string, string>
  /** 验证状态 */
  verified: boolean
  /** 上次验证时间 */
  lastVerifiedAt?: string
  createdAt: string
}
```

**预定义凭证类型：**

| credentialType | 所需字段 | 说明 |
|----------------|----------|------|
| `x_api_token` | `bearer_token` | X API v2 Bearer Token |
| `rsshub_instance` | `base_url` | 自建 RSSHub 实例地址（可选，默认用公共实例） |

### 4.4 ScoutSource — 信息源（渠道实例）

```typescript
/**
 * 信息源 = 渠道的实例化配置
 *
 * 用户从渠道列表选择一个渠道，填写参数后创建信息源。
 * 信息源可被多个搜寻任务引用。
 */
export interface ScoutSource {
  id: string
  userId: string
  /** 用户自定义名称 */
  name: string
  /** 关联渠道 ID */
  channelId: string
  /** 渠道协议（冗余，方便查询） */
  protocol: ScoutChannelProtocol
  /**
   * 实际端点 URL（基于渠道模板 + 用户参数生成）
   * 创建时自动填充，用户一般不直接编辑
   */
  endpoint: string
  /** 用户填写的渠道参数值（对应渠道的 params 定义） */
  paramValues: Record<string, string>
  /** 运行状态 */
  status: ScoutSourceStatus
  /** 包含关键词过滤（空数组 = 不过滤） */
  includeKeywords: string[]
  /** 排除关键词过滤 */
  excludeKeywords: string[]
  /** 语言偏好，如 "zh" / "en"，空 = 不限 */
  language?: string
  /** 上次成功抓取时间 */
  lastFetchedAt?: string
  /** 上次抓取错误信息 */
  lastError?: string
  /** 累计抓取条目数 */
  totalFetched: number
  /** 累计生成 Patch 数 */
  totalPatches: number
  createdAt: string
}
```

### 4.5 ScoutTask — 搜寻任务（调度单元）

```typescript
/**
 * 搜寻任务
 *
 * 任务是搜寻的调度和执行单元：
 * - 绑定一个或多个信息源
 * - 配置定时策略
 * - 配置 AI 分析参数
 * - 在搜寻页面统一管理
 */
export interface ScoutTask {
  id: string
  userId: string
  /** 任务名称 */
  name: string
  /** 任务描述（用户备注，可选） */
  description?: string
  /** 任务状态 */
  status: ScoutTaskStatus
  /** 关联的信息源 ID 列表 */
  sourceIds: string[]
  /** 定时策略 cron 表达式，空 = 仅手动触发 */
  scheduleCron?: string
  /** 仅匹配这些观点分支下的主题（空 = 全部观点） */
  scopeViewpointIds: string[]
  /** 观点匹配最低置信度阈值，默认 0.6 */
  relevanceThreshold: number
  /** 单次执行最大 Patch 生成数，防止堆积 */
  maxPatchesPerRun: number
  /** 上次执行时间 */
  lastRunAt?: string
  /** 下次计划执行时间（基于 cron 计算） */
  nextRunAt?: string
  /** 累计执行次数 */
  totalRuns: number
  createdAt: string
  updatedAt: string
}
```

### 4.6 ScoutEntry — 抓取条目

```typescript
/**
 * 从信息源抓取的原始内容条目
 *
 * 去重体系（三层，详见第十四章）：
 * Layer 1: normalizedUrl（跨信息源 URL 去重）
 * Layer 2: contentHash（内容完全相同去重）
 * Layer 3: 语义去重（标题相似 + embedding 向量，可选）
 */
export interface ScoutEntry {
  id: string
  userId: string
  /** 来源信息源 ID */
  sourceId: string
  /** 触发此抓取的任务 ID */
  taskId: string
  /** 原始来源 URL */
  sourceUrl: string
  /** 标准化后的 URL（去除 tracking 参数，统一格式，用于跨信息源去重） */
  normalizedUrl: string
  /** 内容哈希（SHA-256，基于清洗后纯文本），用于内容级去重 */
  contentHash: string
  /** 条目状态 */
  status: ScoutEntryStatus
  /** 原始标题 */
  title?: string
  /** 原始内容（纯文本，已清洗 HTML） */
  content: string
  /** 原始内容摘要（截取前 500 字符，用于列表展示） */
  summary?: string
  /** 原始作者 */
  author?: string
  /** 原始发布时间 */
  publishedAt?: string
  /** AI 分析后的关键词标签（缓存，避免重复调用 AI） */
  extractedTags?: string[]
  /** AI 分析后匹配到的观点 ID 列表及置信度（缓存） */
  matchedViewpoints?: {
    viewpointId: string
    relevanceScore: number
  }[]
  /** 关联的 ScoutArticle ID（文章化后填充，避免重复生成文章） */
  articleId?: string
  /** 抓取时间 */
  fetchedAt: string
  /** AI 分析完成时间 */
  analyzedAt?: string
}
```

### 4.7 ScoutPatch — 知识补丁

```typescript
/**
 * 知识补丁
 * AI 将抓取条目分析后生成的观点补充建议
 * 合并目标是知识库中的某个 Viewpoint 的 articleBlocks
 */
export interface ScoutPatch {
  id: string
  userId: string
  /** 来源的抓取条目 ID */
  entryId: string
  /** 来源信息源 ID（冗余，方便查询） */
  sourceId: string
  /** 来源任务 ID */
  taskId: string
  /** 目标观点 ID */
  targetViewpointId: string
  /** 目标观点标题（冗余快照，方便列表展示） */
  targetViewpointTitle: string
  /** Patch 状态 */
  status: ScoutPatchStatus
  /** AI 对该匹配的置信度 0~1 */
  relevanceScore: number
  /** AI 生成的 Patch 标题/摘要（一句话说明补充了什么） */
  title: string
  /** AI 生成的补充说明（为什么这条信息对该观点有价值） */
  rationale: string
  /** 建议插入的 NoteBlock 列表 */
  suggestedBlocks: NoteBlock[]
  /** 建议插入位置：在哪个 block 之后插入（空 = 追加到末尾） */
  insertAfterBlockId?: string
  /** 原始来源信息快照 */
  sourceSnapshot: {
    url: string
    title?: string
    author?: string
    publishedAt?: string
    /** 原文摘录（用于引用） */
    excerpt: string
  }
  /** 追问对话线程 */
  thread?: PatchThreadMessage[]
  /** 审批操作人备注 */
  reviewNote?: string
  /** 合并时间 */
  mergedAt?: string
  createdAt: string
  updatedAt: string
}
```

### 4.8 PatchThreadMessage — 追问对话

```typescript
/**
 * Patch 追问对话消息
 * 用户可以对 Patch 提出追问，AI 据此优化 Patch 内容
 */
export interface PatchThreadMessage {
  id: string
  role: "user" | "assistant"
  content: string
  /** assistant 消息可携带更新后的 suggestedBlocks */
  updatedBlocks?: NoteBlock[]
  createdAt: string
}
```

### 4.9 ScoutJob — 任务执行记录

```typescript
/**
 * 任务执行记录
 * 每次定时/手动触发的搜寻任务执行都生成一条记录
 */
export interface ScoutJob {
  id: string
  userId: string
  /** 关联任务 ID */
  taskId: string
  /** 本次执行涉及的信息源 ID 列表 */
  sourceIds: string[]
  /** 触发方式 */
  triggeredBy: "cron" | "manual"
  status: "running" | "completed" | "failed"
  /** 各阶段进度 */
  stages: {
    fetch: { total: number; completed: number; errors: number }
    analyze: { total: number; completed: number; errors: number }
    patch: { total: number; generated: number }
  }
  errorMessage?: string
  startedAt: string
  completedAt?: string
}
```

### 4.10 ScoutConfig — 全局配置

```typescript
/**
 * 搜寻全局配置（每用户一份）
 */
export interface ScoutConfig {
  userId: string
  /** 全局开关：启用/禁用所有自动抓取 */
  enabled: boolean
  /** 默认匹配阈值 */
  defaultRelevanceThreshold: number
  /** 每日 Patch 生成上限 */
  dailyPatchLimit: number
  /** 已处理条目自动清理天数 */
  entryRetentionDays: number
  /** 自建 RSSHub 实例地址（空 = 使用公共实例） */
  rsshubBaseUrl?: string
}
```

### 4.12 数据库扩展

```typescript
// 在 Database interface 中新增
export interface Database {
  // ... 现有字段 ...
  // highlights: Highlight[]  ← 现有表，扩展 sourceType/articleId 字段

  // 文章库模块
  scoutArticles: ScoutArticle[]          // 互联网文章（可阅读实体）
  articleTopics: ArticleTopic[]          // 文章主题分类
  articleTranslations: ArticleTranslation[] // 文章翻译

  // Scout 搜寻模块
  scoutChannels: ScoutChannel[]          // 渠道定义（内置 + 用户自定义）
  scoutCredentials: ScoutCredential[]    // 全局凭证
  scoutSources: ScoutSource[]            // 信息源实例
  scoutTasks: ScoutTask[]                // 搜寻任务
  scoutEntries: ScoutEntry[]             // 抓取条目
  scoutPatches: ScoutPatch[]             // 知识补丁
  scoutJobs: ScoutJob[]                  // 执行记录
  scoutConfigs: ScoutConfig[]            // 全局配置
}
```

### 4.13 实体关系图

```
ScoutChannel (模板)
    │
    │ 1:N 实例化
    ▼
ScoutSource (信息源实例)
    │
    │ N:M 被引用
    ▼
ScoutTask (搜寻任务) ── cron/manual ──→ ScoutJob (执行记录)
    │                                        │
    │                                        │ 产出
    │                                        ▼
    │                                   ScoutEntry (抓取条目)
    │                                        │
    │                               ┌────────┴────────┐
    │                               │                  │
    │                               ▼                  ▼
    │                        ScoutArticle         ScoutPatch
    │                        (文章库阅读体)        (知识补丁)
    │                               │                  │
    │                               │ 用户阅读/划线     │ 审批合并
    │                               ▼                  ▼
    │                          Highlight ─────→ Viewpoint.articleBlocks
    │                        (复用现有划线表        (知识库观点文章)
    │                         sourceType=article)
    │                               │
    │                               │ AI 打散观点
    │                               ▼
    │                        HighlightViewpoint
    │                        (划线→观点 关联)
    │                               │
    │                               │ 主题聚合
    │                               ▼
    └── scopeViewpointIds ──→ Viewpoint.articleBlocks

ScoutCredential (全局凭证) ←── credentialType ── ScoutChannel
ScoutConfig (全局配置) ── 每用户一份
ArticleTopic (主题分类) ←── topics ── ScoutArticle
ArticleTranslation (翻译) ←── articleId ── ScoutArticle
```

**两条知识管道的对比（统一设计）：**

```
管道 A（书籍）:  Book → 阅读器划线 → Highlight(sourceType=book) → AI 匹配观点 → HighlightViewpoint → Viewpoint
管道 B（文章）:  ScoutArticle → 阅读器划线 → Highlight(sourceType=article) → AI 匹配观点 → HighlightViewpoint → Viewpoint（via Patch 审批）
                                                                   ↑
                                    ScoutEntry → AI 自动划线（自动提取核心论点作为高亮）
```

> 管道 B 的特殊之处：除了用户手动划线，AI 还会在 Pipeline 阶段自动为文章生成"预划线"（从原文提取核心论点），
> 这些自动划线也进入 Highlight 表（标记为 AI 生成），后续走相同的观点匹配流程。

---

## 五、核心流程设计

### 5.1 抓取 → 文章化 → 打散观点 → 主题匹配 → Patch 生成 Pipeline

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           Scout Pipeline (v0.3)                           │
│                                                                           │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 1. Fetch │→│ 2. Clean  │→│ 3. Article │→│ 4. Extract│→│ 5. Patch │ │
│  │  抓取     │  │  清洗去重 │  │  文章化    │  │  打散观点  │  │  生成补丁 │ │
│  └──────────┘  └──────────┘  └───────────┘  └──────────┘  └──────────┘ │
│       │              │             │              │              │        │
│   信息源 API     contentHash   HTML→结构化     AI 提取核心     AI 匹配观点│
│   RSS 解析       关键词过滤    存入文章库      论点为划线      生成 Block  │
│                               AI 主题分类    存入 Highlight   插入位置    │
└───────────────────────────────────────────────────────────────────────────┘
```

**阶段 1：Fetch（抓取）**
- 按 cron 调度，遍历任务关联的所有 active 信息源
- RSS：解析 XML，提取 item 列表
- X：调用 API 获取时间线/搜索结果
- Webpage：抓取页面，提取正文
- 存入 ScoutEntry（status: raw）

**阶段 2：Clean（清洗去重）**
- 计算 contentHash，跳过已存在条目
- HTML → 纯文本清洗
- 应用关键词过滤（include/exclude）
- 语言检测，过滤非目标语言

**阶段 3：Article（文章化）— 新增**
- 将通过筛选的 ScoutEntry 转化为 ScoutArticle（可阅读实体）
- HTML 内容 → ArticleSection[] 结构化解析（保留标题层级、段落、图片、代码块、引用）
- AI 自动分类：为文章分配主题标签（topics），匹配已有 ArticleTopic 或创建新主题
- AI 生成摘要（summary）
- 文章状态设为 ready，进入文章库
- 此后用户可以在文章库中阅读原文、手动划线

**阶段 4：Extract（打散观点）— 核心，对齐书籍划线流程**

这是与书籍知识管道统一的关键步骤：

```
书籍管道：  用户手动划线 → Highlight(sourceType=book)    → AI 匹配观点
文章管道：  AI 自动划线  → Highlight(sourceType=article) → AI 匹配观点（相同流程）
            + 用户手动划线（阅读文章时）
```

- AI 阅读文章全文，提取 3~8 条核心论点/观点/洞察
- 每条论点作为一条 Highlight 写入（自动生成）：
  - `sourceType: "article"`
  - `articleId`: 关联文章
  - `content`: 论点原文摘录
  - `note`: AI 对该论点的一句话解读
  - `color`: "blue"（AI 自动划线用蓝色区分用户手动划线）
  - `status: "PENDING"`（等待下一步观点匹配）
- 同时在 ScoutEntry 上记录 matchedViewpoints

- 使用 AI 将每条 Highlight 与知识库观点进行匹配：
  - 复用现有 `embedding_index` 模型绑定做语义相似度
  - 输出：每条划线匹配到的 viewpointId + relevanceScore
  - 写入 HighlightViewpoint 关联表（confirmed: false，等待审批）
  - 仅保留 relevanceScore > 阈值的匹配

**阶段 5：Patch（生成补丁）**
- 对每组 "Highlight → Viewpoint" 高置信度匹配，AI 生成 ScoutPatch：
  - 读取目标观点的 articleBlocks 作为上下文
  - 基于划线内容和文章上下文，生成 suggestedBlocks（1~3 个 NoteBlock）
  - suggestedBlocks 中的 QuoteBlock 自动引用原文划线，附带文章来源
  - 推荐最佳插入位置（语义连贯性）
  - 生成 rationale（解释信息增量）
- 存入 ScoutPatch（status: pending）

**与书籍聚合流程的统一性：**

| 步骤 | 书籍 | 文章 |
|------|------|------|
| 划线来源 | 用户手动 | AI 自动 + 用户手动 |
| 划线存储 | Highlight(book) | Highlight(article) |
| 观点匹配 | HighlightViewpoint | HighlightViewpoint（相同表、相同逻辑） |
| 聚合到观点 | 直接聚合（用户已确认划线） | 通过 Patch 审批后聚合 |
| 观点文章 | Viewpoint.articleBlocks | Viewpoint.articleBlocks（同一份） |

> 最终在知识库的观点文章中，来自书籍和互联网文章的内容无缝混合，
> 用户通过 NoteBlock.sourceRef 可以追溯每段内容的原始出处。

### 5.2 用户审批流程

```
用户打开搜寻页面
       │
       ▼
  查看待审批 Patch 列表
  （按置信度降序、时间降序）
       │
       ▼
  选择一个 Patch，查看详情
       │
       ├── 查看建议内容（NoteBlock 预览）
       ├── 查看 Diff（与目标观点当前内容的对比）
       ├── 查看原始来源（一键跳转）
       │
       ▼
  ┌────────────┬────────────┬────────────────┐
  │   批准      │   拒绝      │   追问扩展      │
  │            │            │                │
  │ 合并到      │ 标记为      │ 发送追问消息     │
  │ 目标观点    │ rejected   │ AI 优化后       │
  │ 的指定位置  │ 可选填拒绝  │ 重新生成 Patch  │
  │            │ 理由        │ 回到 pending    │
  └────────────┴────────────┴────────────────┘
```

**批准操作：**
1. 将 suggestedBlocks 插入目标观点的 articleBlocks 中
2. 在插入的 block 中自动追加来源引用（sourceSnapshot）
3. 更新 Patch 状态为 merged
4. 可选：批准时微调插入位置（拖拽排序）

**拒绝操作：**
1. 更新状态为 rejected
2. 可选填写拒绝理由（用于后续优化 AI 匹配准确度）
3. 拒绝理由可作为负反馈，微调后续匹配阈值

**追问扩展操作：**
1. 用户输入追问指令，如"补充更多实际案例"、"从反面论证这个观点"
2. AI 结合原始条目 + 目标观点 + 用户指令，重新生成 suggestedBlocks
3. 更新 Patch 的 suggestedBlocks 和 thread
4. 状态回到 pending，等待再次审批

### 5.3 合并策略

合并时，Patch 的 suggestedBlocks 会被转换为带来源标记的 NoteBlock：

- `QuoteBlock`：直接引用原文片段，附带来源 URL
- `InsightBlock`：AI 综合分析的补充观点，label 标记 "互联网补充"
- `ParagraphBlock`：自然段落形式的补充论述

每个合并的 block 额外携带元数据：

```typescript
// 扩展 NoteBlockBase，增加来源追踪
export interface NoteBlockBase {
  // ... 现有字段 ...
  /** 来源追踪（Scout 合并时填充） */
  sourceRef?: {
    type: "scout"
    patchId: string
    sourceUrl: string
    author?: string
    fetchedAt: string
  }
}
```

---

## 六、API 设计

### 6.1 渠道管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scout/channels` | 获取所有渠道（内置 + 用户自定义），支持 `?tags=科技,学术` 筛选 |
| GET | `/api/scout/channels/:id` | 获取渠道详情（含 params 定义） |
| POST | `/api/scout/channels` | 创建自定义渠道 |
| PUT | `/api/scout/channels/:id` | 更新自定义渠道（仅 origin=user） |
| DELETE | `/api/scout/channels/:id` | 删除自定义渠道（仅 origin=user） |

### 6.2 凭证管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scout/credentials` | 获取所有凭证（脱敏，仅返回 type/name/verified） |
| POST | `/api/scout/credentials` | 创建凭证 |
| PUT | `/api/scout/credentials/:id` | 更新凭证 |
| DELETE | `/api/scout/credentials/:id` | 删除凭证 |
| POST | `/api/scout/credentials/:id/verify` | 验证凭证有效性 |

### 6.3 信息源管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scout/sources` | 获取所有信息源 |
| POST | `/api/scout/sources` | 创建信息源（基于渠道 + 参数） |
| PUT | `/api/scout/sources/:id` | 更新信息源配置 |
| DELETE | `/api/scout/sources/:id` | 删除信息源 |

### 6.4 搜寻任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scout/tasks` | 获取所有搜寻任务 |
| POST | `/api/scout/tasks` | 创建搜寻任务 |
| PUT | `/api/scout/tasks/:id` | 更新任务配置 |
| DELETE | `/api/scout/tasks/:id` | 删除任务 |
| POST | `/api/scout/tasks/:id/toggle` | 暂停/恢复任务 |
| POST | `/api/scout/tasks/:id/run` | 手动触发任务执行 |

### 6.5 抓取条目

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scout/entries` | 获取抓取条目列表（分页、筛选） |
| GET | `/api/scout/entries/:id` | 获取条目详情 |
| DELETE | `/api/scout/entries/:id` | 删除条目 |

### 6.6 Patch 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scout/patches` | 获取 Patch 列表（筛选：状态、任务、观点、来源） |
| GET | `/api/scout/patches/:id` | 获取 Patch 详情（含 thread） |
| POST | `/api/scout/patches/:id/approve` | 批准并合并 |
| POST | `/api/scout/patches/:id/reject` | 拒绝 |
| POST | `/api/scout/patches/:id/expand` | 追问扩展 |
| PUT | `/api/scout/patches/:id/target` | 修改目标观点 |
| PUT | `/api/scout/patches/:id/blocks` | 手动编辑建议 blocks |

### 6.7 执行记录与统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scout/jobs` | 获取执行记录（支持按任务筛选） |
| GET | `/api/scout/jobs/:id` | 获取执行详情 |
| GET | `/api/scout/stats` | 获取统计数据（今日抓取数、待审批数、各任务状态等） |

### 6.8 全局配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scout/config` | 获取当前用户的搜寻全局配置 |
| PUT | `/api/scout/config` | 更新全局配置 |

### 6.9 文章库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/articles` | 获取文章列表（支持按主题、来源、时间筛选分页） |
| GET | `/api/articles/:id` | 获取文章详情（含 content sections） |
| PUT | `/api/articles/:id` | 更新文章（主题标签、阅读进度等） |
| DELETE | `/api/articles/:id` | 删除文章 |
| GET | `/api/articles/:id/highlights` | 获取文章的所有划线 |
| POST | `/api/articles/:id/highlights` | 创建划线（用户手动） |

### 6.10 文章主题分类

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/articles/topics` | 获取所有主题（含文章计数） |
| POST | `/api/articles/topics` | 创建主题 |
| PUT | `/api/articles/topics/:id` | 更新主题 |
| DELETE | `/api/articles/topics/:id` | 删除主题（文章移至"未分类"） |

### 6.11 文章翻译

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/articles/:id/translations` | 获取文章翻译 |
| POST | `/api/articles/:id/translate` | 触发翻译（指定段落或全文） |

---

## 七、前端组件设计

### 7.1 页面组件树

**文章库模块（/articles）：**

```
app/(dashboard)/articles/page.tsx                — Server Component 入口
└── components/articles/articles-client.tsx        — 文章库主页（主题网格 + 最近阅读）
    ├── components/articles/topic-grid.tsx          — 主题分类网格
    │   └── components/articles/topic-card.tsx       — 主题卡片
    ├── components/articles/recent-articles.tsx     — 最近阅读列表
    └── components/articles/article-list.tsx        — 文章列表（点击主题后）
        └── components/articles/article-card.tsx    — 文章卡片

app/(dashboard)/articles/[articleId]/page.tsx    — 文章阅读器入口
└── components/articles/article-reader.tsx        — 文章阅读器（对标 reader 模块）
    ├── components/articles/article-content.tsx    — 文章正文渲染（ArticleSection → HTML）
    ├── components/articles/article-toolbar.tsx    — 选中文字弹出工具栏（高亮/批注/AI）
    ├── components/articles/article-sidebar.tsx    — 侧栏（划线列表、文章信息）
    └── components/articles/article-settings.tsx   — 排版设置（复用 ReaderSettings）
```

> 文章阅读器复用 reader 模块的核心交互逻辑（选中 → 弹出菜单 → 高亮/批注/AI），
> 但渲染层适配 ArticleSection 结构（vs Book 的 ReaderSection）。
> 翻译功能复用现有翻译服务，仅替换数据源。

**搜寻模块（/scout）：**

```
app/(dashboard)/scout/page.tsx              — Server Component 入口
└── components/scout/scout-client.tsx        — 主客户端容器（Tab 切换两个视图）
    │
    ├── [Tab: 审批台] ─────────────────────────────────────
    │   ├── components/scout/review-panel.tsx          — 审批台三栏容器
    │   │   ├── components/scout/task-filter.tsx        — 左栏：按任务筛选 + 执行日志
    │   │   ├── components/scout/patch-list.tsx         — 中栏：Patch 列表
    │   │   │   ├── components/scout/patch-card.tsx      — 单个 Patch 卡片
    │   │   │   └── components/scout/patch-filters.tsx   — 筛选排序条件
    │   │   └── components/scout/patch-detail.tsx       — 右栏：Patch 详情
    │   │       ├── components/scout/patch-preview.tsx   — 建议内容预览
    │   │       ├── components/scout/patch-diff.tsx      — Diff 视图
    │   │       ├── components/scout/patch-source.tsx    — 原始来源信息
    │   │       ├── components/scout/patch-thread.tsx    — 追问对话
    │   │       └── components/scout/patch-actions.tsx   — 审批操作按钮
    │   │
    ├── [Tab: 任务管理] ───────────────────────────────────
    │   ├── components/scout/task-manager.tsx           — 任务管理主容器
    │   │   ├── components/scout/task-card.tsx           — 任务卡片
    │   │   └── components/scout/task-form.tsx           — 新建/编辑任务 Dialog
    │   │       ├── components/scout/source-picker.tsx   — 信息源选择器
    │   │       │   └── components/scout/channel-browser.tsx — 渠道浏览器
    │   │       ├── components/scout/cron-picker.tsx     — 定时策略选择器
    │   │       └── components/scout/scope-picker.tsx    — 观点范围选择器
    │   │
    └── [设置页集成] ──────────────────────────────────────
        └── components/settings/scout-settings.tsx      — 搜寻渠道设置 Tab
            ├── components/scout/credential-manager.tsx  — API 凭证管理
            ├── components/scout/channel-manager.tsx     — 自定义渠道管理
            └── components/scout/global-config.tsx       — 全局配置表单
```

### 7.2 核心 UI 组件使用

| 组件 | 来源 | 用途 |
|------|------|------|
| `Button` | shadcn/ui | 所有操作按钮（批准/拒绝/追问） |
| `Card` | shadcn/ui | Patch 卡片、信息源卡片 |
| `Dialog` | shadcn/ui | 新增信息源、确认操作 |
| `Input` / `Textarea` | shadcn/ui | 表单输入 |
| `Select` | shadcn/ui | 信息源类型选择、筛选条件 |
| `Badge` | shadcn/ui | 状态标签（pending/approved/rejected） |
| `ScrollArea` | shadcn/ui | 列表滚动区域 |
| `Tabs` | shadcn/ui | 左栏切换（信息源 / 日志 / 统计） |
| `Tooltip` | shadcn/ui | 置信度、时间等悬浮提示 |
| `Separator` | shadcn/ui | 区域分隔 |
| `Skeleton` | shadcn/ui | 加载骨架屏 |
| `Toast` | 已有 | 操作反馈（合并成功、抓取完成等） |

### 7.3 关键交互设计

**Patch 卡片：**
- 左侧色条指示置信度（高 > 0.8 蓝色、中 0.6~0.8 紫色）
- 显示：标题、目标观点名、来源作者、时间、置信度分数
- 点击展开右栏详情

**Diff 视图：**
- 将目标观点的 articleBlocks 与插入 suggestedBlocks 后的结果做对比
- 新增内容以浅色背景高亮标记（非红绿 diff，保持 Swan Song 风格）
- 新增 block 左侧有细线标记

**追问对话：**
- 类似现有 annotation-sidebar 的对话模式
- 用户输入后 AI 重新生成建议 blocks
- 历史对话保留，可回溯

---

## 八、AI 模型集成

### 8.1 新增 ModelFeature 绑定

| Feature 名 | 用途 | 推荐模型 |
|-------------|------|----------|
| `scout_analyze` | 分析抓取条目、提取标签、匹配观点、生成 Patch | GPT-4o / Claude Sonnet |
| `scout_expand` | 处理追问扩展请求 | 同上 |

用户在「设置 → AI 模型」中绑定，复用现有 BYOK 体系。

### 8.2 Prompt 设计要点

**观点匹配 Prompt（阶段 3）：**
```
你是一个知识管理助手。以下是用户知识库中的观点列表：
{viewpoint_titles_and_summaries}

请分析以下互联网内容，判断它与哪些观点相关：
{entry_content}

要求：
1. 返回相关观点 ID 和相关度分数 (0~1)
2. 仅返回真正有信息增量的匹配，不要勉强匹配
3. 如果没有相关观点，返回空列表
```

**Patch 生成 Prompt（阶段 4）：**
```
你是一个知识库编辑。请基于以下互联网来源内容，为目标观点生成补充内容。

目标观点标题：{viewpoint_title}
目标观点当前内容：{article_blocks_json}

来源内容：{entry_content}
来源 URL：{source_url}

要求：
1. 生成 1~3 个 NoteBlock（JSON 格式）
2. 内容应是对现有观点的补充、佐证或新视角
3. 保持与现有内容的语气和深度一致
4. 推荐最佳插入位置（在哪个 block 之后）
5. 用一句话解释为什么这个补充有价值
```

---

## 九、信息源适配器设计

按协议类型实现适配器，每个适配器处理该协议下的所有渠道：

```typescript
/**
 * 协议适配器接口
 * 按 ScoutChannelProtocol 注册，一个适配器处理一类协议
 */
export interface ScoutFetcher {
  /** 协议类型 */
  protocol: ScoutChannelProtocol
  /**
   * 执行抓取
   * @param source 信息源配置（含已解析的 endpoint）
   * @param credential 该协议的全局凭证（如有）
   * @param since 上次抓取时间，增量抓取用
   */
  fetch(source: ScoutSource, credential?: ScoutCredential, since?: string): Promise<RawFetchResult[]>
}

export interface RawFetchResult {
  title?: string
  content: string
  url: string
  author?: string
  publishedAt?: string
}

/**
 * 适配器注册表
 * Pipeline 执行时根据 source.protocol 查找对应适配器
 */
const fetcherRegistry: Record<ScoutChannelProtocol, ScoutFetcher> = {
  rss: new RssFetcher(),
  x_api: new XApiFetcher(),
  webpage: new WebpageFetcher(),
  newsletter: new NewsletterFetcher(),  // 预留
}
```

### 9.1 RSS 适配器（覆盖 HN / Reddit / arXiv / 微信 / 知乎 等）

所有基于 RSS 协议的渠道共用此适配器，无论底层是 HN、Reddit 还是 arXiv：

- 使用 `fast-xml-parser`（项目已有依赖）解析 RSS 2.0 / Atom 1.0
- 特殊处理 arXiv API 返回的 Atom XML（提取 abstract、authors）
- 特殊处理 Semantic Scholar API 返回的 JSON（非 XML，需单独解析路径）
- 特殊处理 RSSHub 格式（微信、知乎通过 RSSHub 代理，格式标准）
- 增量抓取：比较 pubDate 与 lastFetchedAt
- 超时和重试：单源 10s 超时，失败重试 1 次

### 9.2 X API 适配器

- 从 ScoutCredential（type: x_api_token）获取 Bearer Token
- 调用 X API v2 端点，支持三种模式：
  - 用户时间线：`GET /2/users/:id/tweets`
  - 关键词搜索：`GET /2/tweets/search/recent`
  - 列表推文：`GET /2/lists/:id/tweets`
- 自动处理用户名 → user_id 的转换（缓存映射）
- 线程展开：检测 conversation_id，聚合 thread 为单条内容
- 速率限制：遵守 X API v2 rate limit（15 req/15min），超限时自动排队

### 9.3 Webpage 适配器

- 使用 `fetch` 抓取页面 HTML
- 使用 `parse5`（项目已有依赖）解析 DOM
- 正文提取：基于文本密度算法，过滤 nav/footer/aside/script
- 变更检测：对比上次抓取内容 hash，仅新内容入库
- 支持 User-Agent 配置，避免被目标站点拦截

---

## 十、设置集成

在「设置」页面新增「搜寻渠道」Tab，包含三个区域：

### 10.1 API 凭证管理

| 凭证类型 | 所需字段 | 说明 |
|----------|----------|------|
| X API Token | `bearer_token` | X API v2 Bearer Token，所有 X 渠道共享 |
| RSSHub 实例 | `base_url` | 自建 RSSHub 地址（可选，空则用公共实例） |

- 凭证支持「验证」操作：调用对应 API 确认有效性
- 凭证值加密存储，前端仅展示脱敏后的值

### 10.2 自定义渠道管理

用户可新增自定义渠道模板，表单字段：
- 渠道名称、描述
- 协议类型选择（rss / webpage）
- 端点 URL 模板（支持 `{param}` 占位符）
- 参数声明（参数名、标签、是否必填）
- 默认抓取频率

自定义渠道创建后，出现在「新建信息源」的渠道列表中，与内置渠道并列。

### 10.3 全局配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 全局开关 | 启用/禁用所有自动抓取 | 开启 |
| 默认匹配阈值 | 新任务的默认置信度阈值 | 0.6 |
| 每日 Patch 上限 | 全局每日 Patch 生成上限 | 20 |
| 条目保留天数 | 已处理条目自动清理周期 | 30 天 |
| AI 模型绑定 | scout_analyze / scout_expand | 复用现有 BYOK 体系 |

---

## 十一、实现分期

### Phase 1：数据层 + 基础框架

- [ ] 数据模型定义（types.ts 扩展全部表结构）
  - [ ] ScoutArticle, ArticleTopic, ArticleTranslation
  - [ ] Highlight 表扩展 sourceType / articleId
  - [ ] ScoutChannel, ScoutCredential, ScoutSource, ScoutTask
  - [ ] ScoutEntry, ScoutPatch, ScoutJob, ScoutConfig
- [ ] Repository 方法（全部 CRUD）
- [ ] 内置渠道注册表（BUILTIN_CHANNELS 常量）
- [ ] 侧边栏新增「文章」「搜寻」入口

### Phase 2：文章库 + 阅读器

- [ ] 文章库首页（主题网格 + 最近阅读 + 文章列表）
- [ ] 文章阅读器（ArticleSection 渲染、排版设置）
- [ ] 文章划线（复用 Highlight 表，sourceType=article）
- [ ] 文章批注 + AI 即时理解
- [ ] 文章翻译（复用翻译服务）
- [ ] 主题分类管理

### Phase 3：搜寻 Pipeline + 任务管理

- [ ] 设置页「搜寻渠道」Tab（全局配置 + 凭证管理）
- [ ] RSS 适配器（覆盖 HN / Reddit / arXiv / RSSHub 类）
- [ ] 信息源 CRUD（从渠道创建）
- [ ] 搜寻任务 CRUD + 手动触发
- [ ] Pipeline 阶段 1~3：Fetch → Clean → Article（文章化 + 自动分类）
- [ ] 搜寻页审批台 + 任务管理视图

### Phase 4：AI 观点打散 + Patch 审批

- [ ] Pipeline 阶段 4：Extract（AI 自动划线 + 观点匹配，对齐书籍流程）
- [ ] Pipeline 阶段 5：Patch 生成（suggestedBlocks + 插入位置）
- [ ] Patch 审批流程（批准/拒绝/追问扩展）
- [ ] Diff 视图（Swan Song 风格新增内容标记）
- [ ] 追问扩展对话（PatchThread）

### Phase 5：完整渠道 + 定时调度

- [ ] X API 适配器（用户时间线 / 搜索 / 列表）
- [ ] Webpage 适配器（正文提取 + 变更检测）
- [ ] 中文平台渠道就绪（微信公众号、知乎经 RSSHub）
- [ ] Cron 定时调度执行
- [ ] 自定义渠道管理

### Phase 6：智能优化

- [ ] 基于审批历史的匹配阈值自动调优
- [ ] 批量审批操作
- [ ] 执行日志可视化统计
- [ ] 信息源健康监控和自动降级

---

## 十二、技术约束与风险

| 风险 | 缓解措施 |
|------|----------|
| AI Token 成本高昂 | 三层去重避免重复调用（详见十四章）；批量 Prompt 合并调用（详见十五章）；全部 AI 输出落库缓存；降级策略确保无模型时仍可用 |
| X API 访问限制和成本 | 使用 v2 免费层 (500k tweets/month)，超限自动降频 |
| 跨信息源内容重复 | URL 标准化去重 + contentHash 去重 + 语义去重三层体系（详见十四章） |
| 抓取频率导致性能问题 | 使用队列化调度，单用户并发限制 |
| AI 自动划线质量不稳定 | 用户反馈机制（good/bad），反馈数据用于 Prompt 优化（详见十六章） |
| 内容版权风险 | 文章库存储结构化正文用于个人阅读，不对外分发；Patch 中仅引用片段 |
| RSS 源格式多样性 | 兼容 RSS 2.0 / Atom 1.0 / JSON Feed，异常时降级为纯文本提取 |
| 抓取条目堆积 | 自动清理策略 + 存储配额（entryRetentionDays） |
| 文章库存储膨胀 | 文章内容按 ArticleSection 结构化存储（比原始 HTML 小很多）；图片仅存 URL 不下载 |

---

## 十三、与现有模块交互

| 模块 | 交互方式 |
|------|----------|
| 书库 (Library) | 文章库与书库是并列的两种阅读体，共享 ReaderSettings 排版配置 |
| 阅读器 (Reader) | 文章阅读器复用阅读器的核心交互（划线、批注、AI、翻译），适配 ArticleSection |
| 划线 (Highlights) | 文章划线复用 Highlight 表（sourceType=article），与书籍划线统一存储 |
| 知识库 (Viewpoints) | 文章划线走与书籍相同的观点匹配管道；Patch 合并时写入 viewpoint.articleBlocks |
| 聚合 (Aggregate) | 聚合引擎同时处理 book 和 article 来源的 Highlight，无需修改聚合逻辑 |
| AI 模型 (ModelBinding) | 复用 BYOK 体系，新增 scout_analyze / scout_expand 绑定 |
| 图谱 (Graph) | 合并后的来源关系可扩展为图谱边 |
| 设置 (Settings) | Scout 全局配置 + 凭证管理 + 自定义渠道集成到设置页 |
| 翻译 (Translations) | 文章翻译复用现有翻译服务（section_translate 绑定） |

---

## 十四、去重策略

大模型 Token 成本高昂，必须在每一层尽早去重，避免重复解析和分析。

### 14.1 三层去重体系

```
Layer 1: URL 去重（最快，零成本）
    │ 命中 → 跳过抓取
    ▼
Layer 2: 内容哈希去重（快，零成本）
    │ 命中 → 跳过 AI 分析
    ▼
Layer 3: 语义去重（慢，需 AI，仅对疑似重复执行）
    │ 命中 → 合并来源，跳过 Patch 生成
    ▼
进入 AI Pipeline
```

### 14.2 Layer 1：URL 去重

- 在 ScoutEntry 上建立 `sourceUrl` 索引
- 抓取前先查询：同一用户下是否已存在相同 URL 的条目
- 匹配规则：URL 标准化后比较（去除 tracking 参数如 `utm_*`、`ref`、`source` 等）

```typescript
/**
 * URL 标准化：去除常见 tracking 参数，统一协议/大小写
 */
function normalizeUrl(url: string): string {
  const u = new URL(url.toLowerCase())
  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'source', 'fbclid', 'gclid']
  trackingParams.forEach(p => u.searchParams.delete(p))
  // 去除尾部斜杠
  u.pathname = u.pathname.replace(/\/+$/, '')
  return u.toString()
}
```

- 在 ScoutEntry 表新增字段：

```typescript
export interface ScoutEntry {
  // ... 现有字段 ...
  /** 标准化后的 URL（用于跨信息源去重） */
  normalizedUrl: string
}
```

### 14.3 Layer 2：内容哈希去重

- 现有 `contentHash`（SHA-256）在 Clean 阶段计算
- 覆盖场景：同一篇文章从不同 URL 进入（如 HN 链接 vs 原博客链接，但内容完全相同）
- 哈希基于**清洗后的纯文本**，不含 HTML 标签和空白字符差异

### 14.4 Layer 3：语义去重（跨信息源同源文章识别）

针对"内容高度相似但不完全相同"的场景（如 HN 摘要 vs 原文全文，或翻译/转载）：

- 触发条件：Layer 1 和 Layer 2 未命中，但标题相似度 > 0.7（用简单的 Jaccard 相似度快速判断）
- 执行方式：对比候选条目列表（最近 7 天同用户的条目），用 embedding 向量余弦相似度判断
- 阈值：相似度 > 0.85 视为重复
- 重复时处理：
  - 保留**内容更完整**的那条（按 content.length 判断）
  - 在保留条目上追加来源信息（记录"也出现在 XX 渠道"）
  - 丢弃较短的那条，不进入 AI Pipeline

### 14.5 跨实体去重关联

ScoutEntry → ScoutArticle → Highlight 链路上的去重：

| 环节 | 去重方式 | 说明 |
|------|----------|------|
| Entry → Entry | URL + contentHash + 语义 | 避免重复抓取和重复 AI 分析 |
| Entry → Article | entryId 唯一关联 | 一个 Entry 只生成一个 Article |
| Article → Highlight | AI 自动划线时检查已有划线 | 避免对同一段文本重复划线 |
| Highlight → Patch | (viewpointId, entryId) 唯一 | 同一条目对同一观点只生成一个 Patch |

---

## 十五、AI 成本控制与结果缓存

### 15.1 设计原则：解析一次，处处复用

> 每次 AI 调用的结果都必须持久化。不存在"用完即丢"的 AI 输出。
> 后续任何环节需要同一信息时，从缓存读取，而非重新调用 AI。

### 15.2 AI 调用点与缓存策略

Pipeline 中共有 4 个 AI 调用点，每个都有对应的缓存落库设计：

| AI 调用点 | 输入 | 输出 | 落库位置 | 缓存命中条件 |
|-----------|------|------|----------|-------------|
| 1. 文章摘要生成 | ScoutEntry.content | summary | `ScoutArticle.summary` | 同一 entryId 的 Article 已存在 |
| 2. 主题分类 | ScoutEntry.content | topics[] | `ScoutArticle.topics` | 同上 |
| 3. 自动划线（核心论点提取） | ScoutArticle.content | Highlight[] | `Highlight 表` (sourceType=article) | 同一 articleId 已有 AI 生成的划线 |
| 4. 观点匹配 | Highlight.content + Viewpoints | matchedViewpoints | `ScoutEntry.matchedViewpoints` + `HighlightViewpoint 表` | 同一 highlightId 已有匹配记录 |
| 5. Patch 生成 | Highlight + Viewpoint.blocks | suggestedBlocks | `ScoutPatch` | 同一 (entryId, viewpointId) 已有 Patch |
| 6. 追问扩展 | PatchThread | updatedBlocks | `PatchThreadMessage.updatedBlocks` | N/A（每次追问都是新请求） |

### 15.3 批量处理降低调用次数

将多个独立的 AI 调用合并为批量请求，减少 API 往返：

- **摘要 + 分类 + 划线合一：** 阶段 3（Article）和阶段 4（Extract）的前半部分可合并为一次 AI 调用：

```
单次 Prompt（合并调用）：
─────────────────────────────────────────
分析以下文章，完成三项任务：
1. 生成 100 字以内的摘要
2. 从以下主题中选择匹配的分类：{existing_topics}，或建议新主题
3. 提取 3~8 条核心论点，每条给出原文摘录和一句话解读

文章内容：{article_content}
─────────────────────────────────────────
→ 一次调用完成 summary + topics + highlights
→ 输出分别落库到 ScoutArticle 和 Highlight 表
```

- **观点匹配批量化：** 多条 Highlight 对同一组 Viewpoint 的匹配可批量完成：

```
单次 Prompt（批量匹配）：
─────────────────────────────────────────
以下是用户知识库的观点列表：{viewpoint_list}

请为以下 5 条划线分别匹配相关观点：
1. "{highlight_1}"
2. "{highlight_2}"
...
─────────────────────────────────────────
→ 一次调用完成多条划线的观点匹配
→ vs 逐条匹配需要 5 次调用
```

### 15.4 Token 用量追踪

在 ScoutJob 执行记录中追踪 Token 消耗：

```typescript
export interface ScoutJob {
  // ... 现有字段 ...
  /** Token 用量统计 */
  tokenUsage?: {
    /** 各阶段输入 token 数 */
    promptTokens: number
    /** 各阶段输出 token 数 */
    completionTokens: number
    /** 估算成本（基于模型定价，仅参考） */
    estimatedCost?: number
  }
}
```

在搜寻页面的统计区域展示累计 Token 消耗，帮助用户了解 AI 成本。

### 15.5 降级策略

当用户未绑定 AI 模型（或模型不可用）时的降级行为：

| 阶段 | 正常 | 降级 |
|------|------|------|
| 摘要生成 | AI 生成 | 截取前 200 字符 |
| 主题分类 | AI 分类 | 归入"未分类" |
| 自动划线 | AI 提取论点 | 跳过（仅依赖用户手动划线） |
| 观点匹配 | AI 语义匹配 | 关键词匹配（精度低但零成本） |
| Patch 生成 | AI 生成 blocks | 跳过（用户手动划线后走常规聚合） |

> 降级模式下，文章库仍然可用（阅读、手动划线、翻译），
> 只是失去了"自动打散观点 → 自动 Patch"的能力。

---

## 十六、AI 自动划线质量反馈

### 16.1 问题

AI 自动划线是全流程核心。如果划线质量差（提取的论点不准、不重要、或理解错误），后续的观点匹配和 Patch 都会连锁失败。需要用户反馈机制来持续优化。

### 16.2 反馈机制设计

在 Highlight 表上扩展反馈字段：

```typescript
export interface Highlight {
  // ... 现有字段 ...

  /**
   * 划线生成方式（新增）
   * "manual" = 用户手动划线
   * "auto" = AI 自动划线（Pipeline 阶段 4 生成）
   */
  generatedBy: "manual" | "auto"

  /**
   * 用户对 AI 自动划线的反馈（新增，仅 generatedBy=auto 时有意义）
   * null = 未反馈
   * "good" = 有价值
   * "bad" = 无价值/不准确
   */
  qualityFeedback?: "good" | "bad" | null

  /**
   * 反馈备注（可选，用户解释为什么不好）
   */
  feedbackNote?: string
}
```

### 16.3 反馈交互

**在文章阅读器中：**
- AI 自动划线以**蓝色虚线下划线**显示（区别于用户手动高亮的实色背景）
- 悬浮时显示 AI 解读 + 两个小按钮：[有价值] [无价值]
- 点击 [无价值] 时可选填原因（下拉选择：不相关 / 理解错误 / 太泛泛 / 重复）

**在 Patch 审批中：**
- 拒绝 Patch 时，关联的 AI 自动划线自动标记为 `qualityFeedback: "bad"`
- 批准 Patch 时，关联的 AI 自动划线自动标记为 `qualityFeedback: "good"`

### 16.4 反馈数据的使用

- 短期：计算每个信息源的 AI 划线好评率，在任务管理中展示
- 中期：作为 Prompt 工程的参考——将高质量划线作为 few-shot 示例
- 长期：当好评率持续低于阈值时，在任务卡片上标记警告
