// Tema terang/gelap. Tampilan yang bergantung pada tema memakai kelas .dark lewat CSS (dark:...),
// tidak membaca state di sini, supaya HTML hasil prerender sama dengan render pertama di browser.

export type Theme = "light" | "dark"

const STORAGE_KEY = "theme"

// Pilihan tersimpan menang; kalau belum pernah memilih, ikut tema OS.
// public/theme-init.js melakukan hal yang sama sebelum halaman tampil, supaya tidak ada kedipan putih.
function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light"
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === "light" || saved === "dark") return saved
  } catch {
    // localStorage diblokir (mode privat tertentu)
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", theme === "dark")
}

let current = readInitialTheme()
applyTheme(current)

export function getTheme(): Theme {
  return current
}

export function setTheme(theme: Theme) {
  if (theme === current) return
  current = theme
  applyTheme(theme)
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // tidak bisa disimpan: pilihan hanya berlaku sampai halaman ditutup
  }
}

export function toggleTheme(): Theme {
  const next: Theme = current === "dark" ? "light" : "dark"
  setTheme(next)
  return next
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
