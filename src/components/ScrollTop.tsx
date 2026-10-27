import * as React from "react"

/** Persentase scroll halaman (bulat 0 sampai 100) dan apakah tombol perlu tampil. */
function useScrollProgress() {
  const [state, setState] = React.useState({ progress: 0, visible: false })

  React.useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const root = document.documentElement
      const top = window.scrollY || root.scrollTop
      const max = root.scrollHeight - root.clientHeight
      const progress = max > 0 ? Math.round(Math.min(100, Math.max(0, (top / max) * 100))) : 0
      const visible = top > 200
      // Render ulang hanya kalau angkanya berubah, bukan di setiap event scroll.
      setState((s) => (s.progress === progress && s.visible === visible ? s : { progress, visible }))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  return state
}

export function ScrollTop() {
  const { progress, visible } = useScrollProgress()
  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-50 group"
      aria-label="Back to top"
    >
      <div className="relative -rotate-2 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-2 text-sm font-medium text-black shadow transition group-hover:-translate-y-1 group-hover:rotate-0 group-hover:shadow-lg">
        <span className="absolute -right-2 -top-2 h-3 w-8 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
        <span className="absolute -left-2 -bottom-2 h-3 w-8 rotate-6 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
        <span
          className="pointer-events-none absolute -left-4 -top-4 h-9 w-9 rounded-full opacity-70"
          style={{ background: `conic-gradient(var(--ring) ${progress * 3.6}deg, transparent 0)` }}
        />
        <span className="relative">back to top • {progress}%</span>
      </div>
    </button>
  )
}
