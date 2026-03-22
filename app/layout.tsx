import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Lumina",
  description: "智能阅读知识库"
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
