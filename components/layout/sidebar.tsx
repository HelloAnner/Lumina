/**
 * 全局应用侧边栏导航
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 * Updated on 2026/3/25 - 对齐新设计系统：蓝色强调色、BookOpen logo、设置集成进导航
 */
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, GitBranch, Library, Network, Settings } from "lucide-react"
import { cn } from "@/src/lib/utils"

const navItems = [
  { href: "/library", label: "书库", icon: Library },
  { href: "/knowledge", label: "知识库", icon: BookOpen },
  { href: "/graph", label: "图谱", icon: Network },
  { href: "/publish", label: "发布", icon: GitBranch },
  { href: "/settings", label: "设置", icon: Settings }
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r border-border bg-sidebar">
      {/* Logo 区 */}
      <Link
        href="/library"
        className="flex h-14 items-center gap-2.5 px-5"
      >
        <BookOpen className="h-5 w-5 shrink-0 text-primary" />
        <span className="text-[16px] font-semibold text-foreground">Lumina</span>
      </Link>

      <div className="h-px bg-border" />

      {/* 导航 */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-3 text-[14px] transition-colors",
                active
                  ? "bg-selected text-foreground"
                  : "text-muted hover:bg-overlay hover:text-foreground"
              )}
            >
              <Icon className={cn("h-[15px] w-[15px] shrink-0", active ? "text-primary" : "")} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
