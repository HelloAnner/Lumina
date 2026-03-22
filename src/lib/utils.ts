import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function maskSecret(value: string) {
  if (!value) {
    return ""
  }
  if (value.length <= 8) {
    return "********"
  }
  return `${value.slice(0, 2)}********${value.slice(-2)}`
}
