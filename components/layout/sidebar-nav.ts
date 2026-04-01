"use client"

import {
  BookOpen,
  FileText,
  Library,
  Network,
  Radar,
  Rss,
  Send,
  Settings
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: "阅读",
    items: [
      { href: "/library", label: "书库", icon: Library },
      { href: "/articles", label: "文章", icon: FileText }
    ]
  },
  {
    label: "知识",
    items: [
      { href: "/knowledge", label: "观点库", icon: BookOpen },
      { href: "/graph", label: "图谱", icon: Network }
    ]
  },
  {
    label: "搜寻",
    items: [
      { href: "/scout", label: "搜寻", icon: Radar },
      { href: "/sources", label: "信息源", icon: Rss }
    ]
  },
  {
    items: [
      { href: "/publish", label: "发布", icon: Send }
    ]
  }
]

export const settingsItem: NavItem = {
  href: "/settings",
  label: "设置",
  icon: Settings
}

export function buildSidebarPrefetchRoutes(pathname: string) {
  const allRoutes = [...navGroups.flatMap((group) => group.items), settingsItem]
    .map((item) => item.href)

  return allRoutes.filter(
    (href, index) => href !== pathname && allRoutes.indexOf(href) === index
  )
}
