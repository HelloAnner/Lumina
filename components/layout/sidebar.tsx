"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  GitBranch,
  Library,
  Network,
  Settings,
  Sparkles
} from "lucide-react"
import { cn } from "@/src/lib/utils"

const items = [
  { href: "/library", label: "书库", icon: Library },
  { href: "/knowledge", label: "知识库", icon: BookOpen },
  { href: "/graph", label: "图谱", icon: Network },
  { href: "/publish", label: "发布", icon: GitBranch },
  { href: "/settings", label: "设置", icon: Settings }
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center gap-2 px-4 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Lumina</span>
      </div>
      <div className="border-t border-border" />
      <nav className="flex flex-1 flex-col gap-1 px-2 py-3">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-9 items-center gap-3 rounded-md px-3 text-sm text-secondary transition hover:bg-overlay hover:text-foreground",
                active &&
                  "bg-elevated text-foreground before:absolute before:left-0 before:h-6 before:w-0.5 before:rounded-full before:bg-primary"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-border px-4 py-3 text-xs text-muted">
        单镜像部署 / 演示数据
      </div>
    </aside>
  )
}
