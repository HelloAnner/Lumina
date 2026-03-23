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
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Lumina</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-all duration-200",
                active
                  ? "bg-elevated text-foreground"
                  : "text-secondary hover:bg-overlay/70 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 transition-colors", active ? "text-primary" : "text-muted group-hover:text-secondary")} />
              <span className="font-medium">{item.label}</span>
              {active && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-border/60 px-5 py-4">
        <div className="flex items-center gap-2 text-xs text-muted">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
          单镜像部署
        </div>
      </div>
    </aside>
  )
}
