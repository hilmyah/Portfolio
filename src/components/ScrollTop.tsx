import * as React from "react"

export function ScrollTop() {
  const [progress, setProgress] = React.useState(0)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
      const p = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0
      setProgress(p)
      setVisible(scrollTop > 200)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const ring = {
    background: `conic-gradient(var(--ring) ${progress * 3.6}deg, transparent 0)`
  } as React.CSSProperties

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-50 group"
      aria-label="Back to top"
    >
      <div className="relative -rotate-2 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-2 text-sm font-medium text-black shadow transition-all group-hover:-translate-y-1 group-hover:rotate-0 group-hover:shadow-lg">
        <span className="absolute -right-2 -top-2 h-3 w-8 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
        <span className="absolute -left-2 -bottom-2 h-3 w-8 rotate-6 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
        <span className="pointer-events-none absolute -left-4 -top-4 h-9 w-9 rounded-full opacity-70" style={ring} />
        <span className="relative">back to top • {Math.round(progress)}%</span>
      </div>
    </button>
  )
}


