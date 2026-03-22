"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function LoginForm({
  type
}: {
  type: "login" | "register"
}) {
  const router = useRouter()
  const [email, setEmail] = useState("demo@lumina.local")
  const [password, setPassword] = useState("lumina123")
  const [name, setName] = useState("Lumina Demo")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    const response = await fetch(`/api/auth/${type}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email,
        password,
        name
      })
    })
    const data = await response.json()
    setLoading(false)
    if (!response.ok) {
      setError(data.error ?? "请求失败")
      return
    }
    router.push("/library")
    router.refresh()
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {type === "register" ? (
        <div className="space-y-2">
          <label className="text-sm text-secondary">昵称</label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </div>
      ) : null}
      <div className="space-y-2">
        <label className="text-sm text-secondary">邮箱</label>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm text-secondary">密码</label>
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error ? <div className="text-sm text-red-300">{error}</div> : null}
      <Button className="w-full" disabled={loading} type="submit">
        {loading ? "提交中..." : type === "login" ? "登录 Lumina" : "创建账号"}
      </Button>
    </form>
  )
}
