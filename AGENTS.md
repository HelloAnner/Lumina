任何改动前端 UI 和交互效果的需求， 必须先修改 ui/ui.pen 文件， 使用 pencil 结合现状和新的需求，画出新的页面效果图，拒绝随意发挥。

模型配置里的“测试连接/测试模型”必须真实向目标模型发送 `hello` 请求，并校验返回内容正常；仅 HTTP 200 不允许判定通过。

阅读翻译需求里，目录（`toc`）与正文一样属于必须翻译并持久化缓存的数据；不能只做前端临时翻译展示，需支持按目标语言落库复用。

## 主题颜色规范（严格执行）

项目使用 `.light` 类 + CSS 变量实现亮/暗主题切换。**禁止以下写法：**

1. **禁止硬编码颜色值** — 如 `bg-[#09090B]`、`bg-[#18181B]`、`text-zinc-300`、`border-zinc-800` 等
2. **禁止使用 `dark:` 前缀** — 项目不使用 `.dark` 类，Tailwind `dark:` 变体永远不会生效
3. **禁止使用 Tailwind 预置色阶做组件背景/文字色** — 如 `bg-zinc-900`、`text-gray-400` 等

**必须使用语义化 token：**

| 用途 | Tailwind class |
|------|---------------|
| 页面背景 | `bg-base` |
| 卡片/面板 | `bg-surface` |
| 浮起元素 | `bg-elevated` |
| 遮罩/下拉 | `bg-overlay` |
| 边框 | `border-border` / `border-border-subtle` |
| 主要文字 | `text-foreground` |
| 次要文字 | `text-secondary` |
| 弱化文字 | `text-muted` |
| 主色调按钮 | `bg-primary text-white`（白色保留） |

语义 token 的实际色值在 `app/globals.css` 中通过 `:root`（暗色）和 `.light`（亮色）两套 CSS 变量自动切换。
