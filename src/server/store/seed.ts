import { hashSync } from "bcryptjs"
import { randomUUID } from "node:crypto"
import type {
  AggregateJob,
  Annotation,
  AnnotationConfig,
  Book,
  Database,
  Highlight,
  HighlightViewpoint,
  ModelConfig,
  ModelBinding,
  NoteBlock,
  PublishRecord,
  PublishTarget,
  PublishTask,
  ReaderSettings,
  StorageConfig,
  User,
  Viewpoint,
  ViewpointRelation
} from "@/src/server/store/types"

function now() {
  return new Date().toISOString()
}

function createDemoBooks(userId: string): Book[] {
  return [
    {
      id: randomUUID(),
      userId,
      title: "第一性原理",
      author: "A. Maxwell",
      format: "PDF",
      filePath: "demo/first-principles.pdf",
      coverPath: "",
      totalPages: 312,
      readProgress: 0.64,
      lastReadAt: now(),
      tags: ["思维", "方法论"],
      status: "READY",
      synopsis: "围绕问题拆解、约束识别与底层规律的阅读摘录。",
      toc: [
        { id: randomUUID(), title: "第一章 重新定义问题", pageIndex: 1 },
        { id: randomUUID(), title: "第二章 约束与变量", pageIndex: 18 },
        { id: randomUUID(), title: "第三章 两次穿透表象", pageIndex: 42 }
      ],
      content: [
        {
          id: randomUUID(),
          title: "第三章 两次穿透表象",
          pageIndex: 42,
          content:
            "真正决定行动效率的，不是方案有多完整，而是你是否清楚问题的第一约束。把复杂系统拆成可验证的最小单元，再分别求解，往往能得到更稳的结果。"
        },
        {
          id: randomUUID(),
          title: "第四章 迭代与回路",
          pageIndex: 55,
          content:
            "好的决策不是一次完成，而是不断用反馈修正原始假设。每一次修正，都是向真问题靠近的一步。"
        }
      ],
      createdAt: now()
    },
    {
      id: randomUUID(),
      userId,
      title: "长期主义",
      author: "Eliza Reed",
      format: "EPUB",
      filePath: "demo/long-termism.epub",
      coverPath: "",
      totalPages: 228,
      readProgress: 0.36,
      lastReadAt: now(),
      tags: ["战略", "复利"],
      status: "READY",
      synopsis: "关于时间尺度、复利与耐心的跨章节摘录。",
      toc: [
        { id: randomUUID(), title: "时间的朋友", href: "chapter-1" },
        { id: randomUUID(), title: "复利型选择", href: "chapter-2" }
      ],
      content: [
        {
          id: randomUUID(),
          title: "时间的朋友",
          pageIndex: 12,
          content:
            "长期主义不是慢，而是把有限注意力投入会持续积累价值的事情。很多看似不起眼的动作，只要方向正确，在足够长的时间里都会放大。"
        },
        {
          id: randomUUID(),
          title: "复利型选择",
          pageIndex: 31,
          content:
            "复利来自重复兑现的小优势。真正值得追求的，并不是一次性的大胜，而是可被不断重复的高质量决策。"
        }
      ],
      createdAt: now()
    }
  ]
}

function createDemoHighlights(userId: string, books: Book[]): Highlight[] {
  return [
    {
      id: randomUUID(),
      userId,
      bookId: books[0].id,
      format: "PDF",
      contentMode: "original",
      pageIndex: 42,
      paraOffsetStart: 0,
      paraOffsetEnd: 32,
      content: "把复杂系统拆成可验证的最小单元，再分别求解。",
      note: "先拆解再求解，是我做架构设计时最稳定的路径。",
      color: "yellow",
      status: "PROCESSED",
      createdAt: now()
    },
    {
      id: randomUUID(),
      userId,
      bookId: books[0].id,
      format: "PDF",
      contentMode: "original",
      pageIndex: 55,
      paraOffsetStart: 0,
      paraOffsetEnd: 20,
      content: "好的决策不是一次完成，而是不断用反馈修正原始假设。",
      note: "这句话和长期主义里的复盘、反馈是一回事。",
      color: "blue",
      status: "PROCESSED",
      createdAt: now()
    },
    {
      id: randomUUID(),
      userId,
      bookId: books[1].id,
      format: "EPUB",
      contentMode: "original",
      chapterHref: "chapter-2",
      cfiRange: "epubcfi(/6/4!/4/2/1:0,/1:22)",
      content: "真正值得追求的，是可被不断重复的高质量决策。",
      note: "复利背后仍然是稳定决策框架。",
      color: "green",
      status: "PROCESSED",
      createdAt: now()
    }
  ]
}

export function buildSeedDatabase(): Database {
  const userId = randomUUID()
  const createdAt = now()
  const users: User[] = [
    {
      id: userId,
      email: process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local",
      passwordHash: hashSync(
        process.env.DEFAULT_DEMO_PASSWORD ?? "lumina123",
        10
      ),
      name: "Lumina Demo",
      aggregateSchedule: "manual",
      aggregateCron: "",
      createdAt
    }
  ]

  const books = createDemoBooks(userId)
  const highlights = createDemoHighlights(userId, books)

  const vpBlocksFirst: NoteBlock[] = [
    { id: randomUUID(), type: "heading", sortOrder: 0, level: 1, text: "核心论点" },
    { id: randomUUID(), type: "paragraph", sortOrder: 1, text: "第一性原理要求我们回归事物最基本的假设，打破类比思维的局限，从物理定律出发重新构建解决方案。这种思维方式是突破性创新的核心，而非边际改进的工具。" },
    { id: randomUUID(), type: "highlight", sortOrder: 2, text: "真正的创新不是在已有框架内做优化，而是质疑框架本身。第一性原理思维让我们能够从零开始构建新的可能性。", label: "关键洞察", sourceBookTitle: "创新者的窘境", sourceLocation: "P.127", highlightId: highlights[0].id },
    { id: randomUUID(), type: "heading", sortOrder: 3, level: 1, text: "论据与展开" },
    { id: randomUUID(), type: "paragraph", sortOrder: 4, text: "在物理学中，第一性原理指的是不能从其他假设推导出来的基本命题。将这种思维应用到商业领域，意味着我们需要抛弃行业惯例和类比推理，从最根本的事实出发思考问题。" },
    { id: randomUUID(), type: "quote", sortOrder: 5, text: "大多数创新者并不是从无到有创造出新事物，而是将已有的元素以前所未有的方式组合在一起。真正的原创，是在最基础的层面重新思考。", sourceBookTitle: "从0到1", sourceLocation: "P.45", highlightId: highlights[1].id },
    { id: randomUUID(), type: "paragraph", sortOrder: 6, text: "SpaceX 的火箭回收技术就是第一性原理思维的经典案例。当所有人都认为火箭发射后必须丢弃时，Elon Musk 从材料成本和物理可行性出发，证明了重复使用火箭在经济上完全可行。" },
    { id: randomUUID(), type: "insight", sortOrder: 7, text: "这一案例体现了第一性原理在工程领域的典型应用模式：分解问题→识别基本约束→绕过行业假设→构建全新方案。", label: "AI 补充说明" }
  ]

  const vpBlocksSecond: NoteBlock[] = [
    { id: randomUUID(), type: "heading", sortOrder: 0, level: 1, text: "核心论点" },
    { id: randomUUID(), type: "paragraph", sortOrder: 1, text: "长期主义要求把注意力投入能持续积累价值的动作。" },
    { id: randomUUID(), type: "quote", sortOrder: 2, text: "真正值得追求的，是可被不断重复的高质量决策。", sourceBookTitle: "长期主义", sourceLocation: "P.31", highlightId: highlights[2].id },
    { id: randomUUID(), type: "heading", sortOrder: 3, level: 1, text: "我的理解" },
    { id: randomUUID(), type: "paragraph", sortOrder: 4, text: "所谓长期，不是等待，而是持续兑现小优势。" }
  ]

  const viewpoints: Viewpoint[] = [
    {
      id: randomUUID(),
      userId,
      title: "第一性原理",
      isFolder: false,
      isCandidate: false,
      sortOrder: 1,
      highlightCount: 2,
      relatedBookIds: [books[0].id, books[1].id],
      articleContent:
        "# 第一性原理\n\n## 核心论点\n我越来越确认，真正能提升判断质量的，不是更快做决定，而是先回到问题的第一约束。\n\n## 论据与展开\n> 《第一性原理》\n> 把复杂系统拆成可验证的最小单元，再分别求解。\n\n我的批注：先拆解再求解，是我做架构设计时最稳定的路径。\n\n## 我的理解\n第一性原理不是推翻一切，而是拒绝在未经验证的共识上继续堆方案。",
      articleBlocks: vpBlocksFirst,
      lastSynthesizedAt: createdAt,
      createdAt
    },
    {
      id: randomUUID(),
      userId,
      title: "长期主义",
      isFolder: false,
      isCandidate: false,
      sortOrder: 2,
      highlightCount: 2,
      relatedBookIds: [books[1].id],
      articleContent:
        "# 长期主义\n\n## 核心论点\n长期主义要求把注意力投入能持续积累价值的动作。\n\n## 论据与展开\n> 《长期主义》\n> 真正值得追求的，是可被不断重复的高质量决策。\n\n## 我的理解\n所谓长期，不是等待，而是持续兑现小优势。",
      articleBlocks: vpBlocksSecond,
      lastSynthesizedAt: createdAt,
      createdAt
    }
  ]

  const highlightViewpoints: HighlightViewpoint[] = [
    {
      highlightId: highlights[0].id,
      viewpointId: viewpoints[0].id,
      similarityScore: 0.93,
      confirmed: true
    },
    {
      highlightId: highlights[1].id,
      viewpointId: viewpoints[0].id,
      similarityScore: 0.81,
      confirmed: true
    },
    {
      highlightId: highlights[1].id,
      viewpointId: viewpoints[1].id,
      similarityScore: 0.75,
      confirmed: false
    },
    {
      highlightId: highlights[2].id,
      viewpointId: viewpoints[1].id,
      similarityScore: 0.91,
      confirmed: true
    }
  ]

  const relations: ViewpointRelation[] = [
    {
      sourceId: viewpoints[0].id,
      targetId: viewpoints[1].id,
      weight: 0.48
    },
    {
      sourceId: viewpoints[1].id,
      targetId: viewpoints[0].id,
      weight: 0.48
    }
  ]

  const modelConfigs: ModelConfig[] = [
    {
      id: randomUUID(),
      userId,
      category: "language",
      name: "默认语言模型",
      baseUrl: "",
      apiKey: "",
      modelName: "未配置"
    }
  ]

  const modelBindings: ModelBinding[] = []

  const storageConfigs: StorageConfig[] = [
    {
      userId,
      useCustom: false,
      region: "local"
    }
  ]

  const readerSettings: ReaderSettings[] = [
    {
      userId,
      fontSize: 16,
      lineHeight: 1.75,
      fontFamily: "serif",
      theme: "night",
      navigationMode: "horizontal",
      translationView: "original"
    }
  ]

  const publishTargets: PublishTarget[] = [
    {
      id: randomUUID(),
      userId,
      name: "团队 Webhook",
      type: "webhook",
      endpointUrl: "https://example.com/webhook",
      authHeader: "",
      createdAt
    }
  ]

  const publishTasks: PublishTask[] = [
    {
      id: randomUUID(),
      userId,
      name: "每周认知周报",
      viewpointIds: viewpoints.map((item) => item.id),
      targetId: publishTargets[0].id,
      format: "markdown",
      triggerType: "manual",
      enabled: true,
      createdAt
    }
  ]

  const publishRecords: PublishRecord[] = [
    {
      id: randomUUID(),
      taskId: publishTasks[0].id,
      triggeredBy: "manual",
      status: "SUCCESS",
      articleVersion: "seed-v1",
      executedAt: createdAt
    }
  ]

  const aggregateJobs: AggregateJob[] = [
    {
      id: randomUUID(),
      userId,
      status: "IDLE",
      stage: "idle",
      processed: 0,
      total: 0,
      updatedAt: createdAt
    }
  ]

  return {
    users,
    books,
    highlights,
    viewpoints,
    highlightViewpoints,
    relations,
    modelConfigs,
    modelBindings,
    storageConfigs,
    readerSettings,
    translations: [],
    tocTranslations: [],
    publishTargets,
    publishTasks,
    publishRecords,
    aggregateJobs,
    annotations: [] as Annotation[],
    annotationConfigs: [
      {
        userId,
        systemPrompt: "你是一个专业的知识笔记编辑助手。用户会对笔记中的某段文字或整篇笔记提出修改意见（批注），你需要根据批注内容重新编辑笔记的对应部分。\n\n规则：\n1. 保持笔记的整体结构和风格不变\n2. 仅修改批注指向的内容\n3. 如果批注要求补充内容，在合适的位置插入新的块\n4. 输出完整的 articleBlocks JSON 数组",
        autoProcess: true
      } satisfies AnnotationConfig
    ],
    // Scout 模块
    scoutArticles: [],
    articleTopics: [],
    scoutChannels: [],
    scoutCredentials: [],
    scoutSources: [],
    scoutTasks: [],
    scoutEntries: [],
    scoutPatches: [],
    scoutJobs: [],
    scoutConfigs: [
      {
        userId,
        enabled: false,
        defaultRelevanceThreshold: 0.6,
        dailyPatchLimit: 50,
        entryRetentionDays: 30
      }
    ],
    articleTranslations: [],
    importSources: [],
    importJobs: [],
    importedNotes: [],
    noteViewpointLinks: []
  }
}
