/**
 * 全局应用侧边栏导航
 * 分组布局：阅读 / 知识 / 搜寻 / 发布，设置沉底
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 * Updated on 2026/3/25 - 分组导航，视觉分层
 */
"use client"

import { useCallback, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BookOpen } from "lucide-react"
import { cn } from "@/src/lib/utils"
import {
  buildSidebarPrefetchRoutes,
  navGroups,
  settingsItem,
  type NavItem
} from "./sidebar-nav"

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const prefetchRoute = useCallback((href: string) => {
    router.prefetch(href)
  }, [router])

  useEffect(() => {
    const targets = buildSidebarPrefetchRoutes(pathname)
    if (targets.length === 0) {
      return
    }
    const prefetchAll = () => {
      for (const href of targets) {
        router.prefetch(href)
      }
    }
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prefetchAll, { timeout: 1200 })
      return () => window.cancelIdleCallback(idleId)
    }
    const timer = globalThis.setTimeout(prefetchAll, 160)
    return () => globalThis.clearTimeout(timer)
  }, [pathname, router])

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <Link
        href="/library"
        className="flex h-14 items-center gap-2.5 px-5"
      >
        <BookOpen className="h-5 w-5 shrink-0 text-primary" />
        <span className="text-[16px] font-semibold text-foreground">Lumina</span>
      </Link>

      <div className="h-px bg-border" />

      {/* 导航分组 */}
      <nav className="flex flex-1 flex-col px-3 py-3">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="my-2 h-px bg-border/50" />}
            {group.label && (
              <span className="mb-1 block px-3 text-[10px] font-medium uppercase tracking-wider text-muted">
                {group.label}
              </span>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onPrefetch={prefetchRoute}
                />
              ))}
            </div>
          </div>
        ))}

        {/* 弹性间距，设置沉底 */}
        <div className="flex-1" />
        <div className="h-px bg-border/50" />
        <div className="mt-2">
          <NavLink item={settingsItem} pathname={pathname} onPrefetch={prefetchRoute} />
        </div>
      </nav>
    </aside>
  )
}

function NavLink({
  item,
  pathname,
  onPrefetch
}: {
  item: NavItem
  pathname: string
  onPrefetch: (href: string) => void
}) {
  const Icon = item.icon
  const active = pathname.startsWith(item.href)

  return (
    <Link
      href={item.href}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-md px-3 text-[13px] transition-colors",
        active
          ? "bg-selected text-foreground"
          : "text-muted hover:bg-overlay hover:text-foreground"
      )}
      onMouseEnter={() => onPrefetch(item.href)}
      onFocus={() => onPrefetch(item.href)}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "")} />
      <span>{item.label}</span>
    </Link>
  )
}
