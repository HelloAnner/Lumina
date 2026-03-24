/**
 * 全局应用侧边栏导航
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 * Updated on 2026/3/24 - 对齐 pen 设计：紫色圆点 logo、36px 导航项、设置独立底部样式
 */
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, GitBranch, Library, Network, Settings } from "lucide-react"
import { cn } from "@/src/lib/utils"

const mainItems = [
  { href: "/library", label: "书库", icon: Library },
  { href: "/knowledge", label: "知识库", icon: BookOpen },
  { href: "/graph", label: "图谱", icon: Network },
  { href: "/publish", label: "发布", icon: GitBranch }
]

export function Sidebar() {
  const pathname = usePathname()
  const isSettings = pathname.startsWith("/settings")

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r border-border bg-surface">
      {/* Logo 区 - 56px */}
      <Link
        href="/library"
        className="flex h-14 items-center gap-2 px-4"
      >
        <div className="h-[22px] w-[22px] shrink-0 rounded-full bg-primary" />
        <span className="text-[16px] font-semibold text-foreground">Lumina</span>
      </Link>

      <div className="h-px bg-border/60" />

      {/* 主导航 */}
      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2">
        {mainItems.map((item) => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md px-[22px] text-[14px] transition-colors",
                active
                  ? "bg-primary/10 text-foreground"
                  : "text-muted hover:bg-overlay hover:text-foreground"
              )}
            >
              <Icon className={cn("h-[15px] w-[15px] shrink-0", active ? "text-primary" : "")} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="h-px bg-border/60" />

      {/* 设置 - 底部独立项 */}
      <Link
        href="/settings"
        className={cn(
          "flex h-12 items-center gap-2 px-3 transition-colors",
          isSettings
            ? "bg-primary/5 text-foreground"
            : "text-muted hover:bg-overlay hover:text-foreground"
        )}
      >
        {isSettings && <div className="h-4 w-0.5 shrink-0 rounded-full bg-primary" />}
        {!isSettings && <div className="w-0.5" />}
        <Settings className={cn("h-[15px] w-[15px] shrink-0", isSettings ? "text-primary" : "")} />
        <span className={cn("text-[14px]", isSettings ? "font-medium text-foreground" : "")}>设置</span>
      </Link>
    </aside>
  )
}
