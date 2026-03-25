## 品味

"evoke a sense of unspoiled beauty and timelessness and minimalism."

"serene augmented reality and quiet technology"

"The stylistic feel of Swan Song is strikingly cold, clean and minimalist."

"hopefully timeless, interesting high-tech world."

## Docs 规范

### 设计初衷

Docs 是代码的「设计图纸」，不是历史档案。它的价值在于**指导当前和未来的开发**，而非记录过去的决策。
功能迭代很快，过时的文档不仅没有参考价值，还会误导开发。因此：

- 文档跟随代码演进，始终反映最新状态
- 不做版本归档，git history 就是最好的版本管理
- 一个子功能只有一份文档，是它的唯一真相来源（Single Source of Truth）

### 目录结构

```
docs/
├── prd.md              # 全局产品定位文档
├── tech.md             # 全局架构设计文档
├── {module}/           # 功能模块文件夹，按模块组织
│   ├── {sub-feature}.md  # 子功能文档，一个子功能一个文件
│   └── ...
└── plans/              # 临时实施计划（可选）
```

### 规则

**组织**

- 一个功能模块对应一个文件夹，文件夹名使用 kebab-case，不加数字前缀
- 模块下按子功能组织，一个子功能对应一个 `.md` 文件
- 全局文档（产品定位、架构设计）直接放在 `docs/` 根目录
- 文件名应清晰表达子功能含义，如 `obsidian-import.md`、`highlight-locator.md`

**更新时机**

- 新建子功能时，先写 spec 文档再写代码
- 子功能有需求变更、数据结构调整、API 改动时，同步更新对应文档
- 代码重构导致文档描述不再准确时，及时修正
- 不要为了"保持历史"而保留已失效的内容，直接删除或覆盖

**禁止**

- 不创建版本号子目录（001/002/...），直接在原文件上迭代
- 不在文件名中加日期前缀（如 `2026-03-23-xxx.md`），用 git 追溯时间线
- 不写空壳文档（只有标题没有实质内容的占位文件）

## 设计前端页面前的规范

任何改动前端 UI 和交互效果的需求， 必须先修改 ui/ui.pen 文件， 使用 pencil 结合现状和新的需求，画出新的页面效果图，拒绝随意发挥。

## UI 设计规范

组件规范如下:

- 前端如果没有特别指定ui框架, 默认使用 shadcn ui
- 全部组件都必须使用 shadcn 的原生组件
- Tailwind CSS 作为样式方案

### 2.1 设计哲学：Swan Song — 宁静的近未来

灵感来源：电影《天鹅挽歌》(Swan Song, 2021) 的视觉语言。
由 Territory Studio 操刀的 UI 设计，以及 Annie Beauchamp 的美术指导，
遵循 Dieter Rams "少即是多" 的设计哲学。

"evoke a sense of unspoiled beauty and timelessness and minimalism."

"serene augmented reality and quiet technology"

"The stylistic feel of Swan Song is strikingly cold, clean and minimalist."

"hopefully timeless, interesting high-tech world."

核心原则：

- **宁静科技 (Serene Tech)**：技术存在但不喧嚣，如同空气般自然
- **温暖极简 (Warm Minimalism)**：极简但不冰冷，通过有机材质感和柔和光线保持人文温度
- **克制优雅 (Considered Restraint)**：每个元素都经过深思熟虑，无冗余装饰，无 emoji
- **叙事驱动 (Narrative-led)**：UI 服务于内容叙事，而非炫技
- 信息密度高但留有呼吸空间，如同负空间构图

### 2.4 圆角与间距

圆角统一偏大——模拟电影中 AR 面板的柔和边缘，无直角：

- sm: 8px / md: 10px / lg: 14px / xl: 18px / 2xl: 22px
- 特殊容器（如对话框、模态框）可用 24px，营造 AR 浮层感

间距——紧凑但留有呼吸空间，如同电影中大量的负空间构图：

- 外围 padding 16px，panel 间距 12px
- 基础单元 4px（4/8/12/16/20/24/32）
- 内容区域之间保持至少 24px 间距，让信息有呼吸感

### 2.5 字体

- UI 文字：\`Inter\`（400/450/500/600）— 注意增加 450 权重，用于正文，比 400 略重，提升可读性
- 代码：\`JetBrains Mono\`（400/500）
- 系统回退：\`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif\`
- 行高 1.65，字间距 \`0.01em\`（微妙加宽，提升阅读舒适度）
- 开启字体平滑（antialiased）
- 标题字重不超过 600，避免粗重感，保持轻盈

### 2.6 动效

- 使用 Framer Motion，CSS keyframes 仅用于微动画
- 速度：fast 120ms / normal 200ms / slow 280ms / gentle 400ms
- 缓动：\`cubic-bezier(0.25, 0.1, 0.25, 1)\`（比标准 ease 更柔和）
- 入场动效：fade + 微妙上移 (translateY 4px)，如同 AR 元素浮现
- 不要弹跳效果，不要过度动画，保持宁静克制
- 页面切换使用 crossfade，如同电影中记忆场景的柔和转场

### 2.8 禁止事项

- ❌ 不使用高饱和霓虹色
- ❌ 不使用渐变按钮或渐变文字
- ❌ 不使用弹跳/果冻动效
- ❌ 不使用 emoji 或装饰性图标
- ❌ 不使用纯黑 #000000 或纯白 #FFFFFF 作为背景
- ❌ 不使用超过 1px 的边框
- ❌ 不使用花哨的 hover 动画（如旋转、缩放超过 1.02）
- ❌ 避免信息过度密集，保持负空间`;
