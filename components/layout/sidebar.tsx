"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
  const router = useRouter()

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r border-border bg-surface">
      <Link
        href="/library"
        className="group flex h-16 items-center gap-3 px-5 transition-colors hover:bg-elevated/50"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 transition-all duration-300 group-hover:from-primary/30 group-hover:to-primary/10 group-hover:scale-105 group-hover:shadow-[0_0_12px_rgba(139,92,246,0.25)]">
          <Sparkles className="h-4 w-4 text-primary transition-transform duration-300 group-hover:rotate-12" />
        </div>
        <span className="text-sm font-semibold tracking-tight transition-colors group-hover:text-foreground">Lumina</span>
      </Link>
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
