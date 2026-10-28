import * as React from "react"
import { PROMPT_HOST, PROMPT_USER } from "@/data"

// URL selain halaman utama dijawab nginx dengan status 404 dan isi halaman ini
// (server/nginx/portfolio.conf). Komponen ini memberi tahu bahwa alamatnya tidak ada, dengan gaya
// terminal, di atas portfolio. Di halaman utama tidak dirender sama sekali.

const HOME_PATHS = new Set(["/", "/index.html"])
const MAX_SHOWN = 64

function missingPath(): string | null {
  const { pathname } = window.location
  if (HOME_PATHS.has(pathname)) return null
  let shown = pathname
  try {
    shown = decodeURIComponent(pathname)
  } catch {
    // %-encoding yang rusak: tampilkan apa adanya
  }
  return shown.length > MAX_SHOWN ? `${shown.slice(0, MAX_SHOWN - 3)}...` : shown
}

export function NotFound() {
  const [path, setPath] = React.useState(missingPath)

  React.useEffect(() => {
    if (!path) return
    const title = document.title
    document.title = `Not found | ${title}`
    return () => {
      document.title = title
    }
  }, [path])

  if (!path) return null

  const goHome = () => {
    window.history.replaceState(null, "", "/")
    setPath(null)
  }

  return (
    // pb-4: stiker di atas foto hero menjorok ke atas, jangan sampai menutupi kotak ini.
    <div className="mx-auto max-w-6xl px-4 pb-4 pt-6">
      <section
        aria-label="Page not found"
        className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-[13px] leading-[1.6] text-neutral-200 card-shadow md:text-sm"
      >
        <p className="break-all">
          <span className="text-emerald-300">
            {PROMPT_USER}@{PROMPT_HOST}
          </span>
          <span className="text-neutral-500">:</span>
          <span className="text-sky-300">~</span>
          <span className="text-neutral-500">$</span> cd {path}
        </p>
        <p className="break-all text-rose-300">bash: cd: {path}: No such file or directory</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-neutral-500">This page does not exist. The portfolio is below.</span>
          <button
            type="button"
            onClick={goHome}
            className="rounded px-2 py-0.5 text-xs text-neutral-300 ring-1 ring-neutral-700 transition-colors hover:bg-neutral-800 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            cd ~
          </button>
        </div>
      </section>
    </div>
  )
}
