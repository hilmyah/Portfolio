import * as React from "react"

export type Theme = "light" | "dark"

const STORAGE_KEY = "theme"
const listeners = new Set<() => void>()

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light"
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === "light" || saved === "dark") return saved
  } catch {
    // localStorage unavailable; fall back to the OS preference
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("dark", theme === "dark")
}

let current: Theme = readInitialTheme()
applyTheme(current)

export function getTheme(): Theme {
  return current
}

export function setTheme(theme: Theme): void {
  if (theme === current) return
  current = theme
  applyTheme(theme)
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // localStorage unavailable; the choice lasts for this page load only
  }
  listeners.forEach((listener) => listener())
}

export function toggleTheme(): Theme {
  const next: Theme = current === "dark" ? "light" : "dark"
  setTheme(next)
  return next
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTheme(): Theme {
  return React.useSyncExternalStore(subscribe, getTheme, () => "light" as Theme)
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
