"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type AppTheme = "dark" | "light" | "system"

const STORAGE_KEY = "lumina-theme"

interface ThemeContextValue {
  theme: AppTheme
  setTheme: (t: AppTheme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {}
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("dark")

  // 初始化：从 localStorage 读取用户偏好
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as AppTheme | null
    if (stored) {
      setThemeState(stored)
    }
  }, [])

  // 应用主题到 html 元素
  useEffect(() => {
    applyTheme(theme)

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => applyTheme("system")
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }
  }, [theme])

  function setTheme(t: AppTheme) {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

/** 根据主题偏好切换 html 的 .light class */
function applyTheme(t: AppTheme) {
  const isDark =
    t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("light", !isDark)
}
