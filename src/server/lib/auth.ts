import { compare, hash } from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import type { User } from "@/src/server/store/types"

const TOKEN_NAME = "lumina_token"

function getSecret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? "lumina-dev-secret"
  )
}

export async function hashPassword(password: string) {
  return hash(password, 10)
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash)
}

export async function signToken(user: User) {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret())
}

export async function verifyToken(token: string) {
  const result = await jwtVerify(token, getSecret())
  return result.payload
}

export async function getCurrentSession() {
  const token = cookies().get(TOKEN_NAME)?.value
  if (!token) {
    return null
  }

  try {
    return await verifyToken(token)
  } catch {
    return null
  }
}

export function getTokenName() {
  return TOKEN_NAME
}
