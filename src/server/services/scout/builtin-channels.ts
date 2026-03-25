/**
 * 内置渠道注册表
 *
 * 系统预置的高价值信息源渠道模板，用户选择后填写参数即可创建信息源
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */

import type { ScoutChannel } from "@/src/server/store/types"

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
        name: "category",
        label: "论文分类",
        placeholder: "选择 arXiv 分类",
        required: true,
        inputType: "select",
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
