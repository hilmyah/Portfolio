import * as React from "react"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Menu } from "lucide-react"
import { prefersReducedMotion, toggleTheme, useTheme } from "@/lib/theme"

export function Navbar() {
  const [open, setOpen] = React.useState(false)
  const isDark = useTheme() === "dark"
  const wipingRef = React.useRef(false)

  const linkClass = "nav-link px-3 py-2 rounded-md hover:bg-accent/60"

  // polish: scrollspy. The link of the section in view gets an underline.
  const [active, setActive] = React.useState<string | null>(null)
  React.useEffect(() => {
    const sections = ["about", "projects", "terminal", "social"]
    let frame = 0
    const update = () => {
      frame = 0
      const doc = document.documentElement
      if (window.scrollY + window.innerHeight >= doc.scrollHeight - 4) {
        setActive("social")
        return
      }
      const marker = window.innerHeight * 0.35
      let current: string | null = null
      for (const id of sections) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= marker) current = id
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])
  const current = (id: string) => (active === id ? ("location" as const) : undefined)

  const toggleThemeWithWipe = () => {
    if (wipingRef.current) return
    if (prefersReducedMotion()) {
      toggleTheme()
      return
    }
    wipingRef.current = true
    // Stacked page flip container
    const container = document.createElement('div')
    container.className = 'theme-pageflip'
    const sheetCount = 5
    const sheets: HTMLDivElement[] = []
    for (let i = 0; i < sheetCount; i++) {
      const sheet = document.createElement('div')
      sheet.className = 'sheet'
      sheet.style.animationDelay = `${i * 80}ms`
      const front = document.createElement('div')
      front.className = 'face front'
      const back = document.createElement('div')
      back.className = 'face back'
      sheet.appendChild(front)
      sheet.appendChild(back)
      container.appendChild(sheet)
      sheets.push(sheet)
    }
    document.body.appendChild(container)

    // Flip theme around the middle sheet timing
    const midTime = 80 * Math.floor(sheetCount / 2) + 220
    const themeTimer = window.setTimeout(() => { toggleTheme() }, midTime)

    // Cleanup after the last animation ends
    const total = 80 * (sheetCount - 1) + 1500
    const endTimer = window.setTimeout(() => {
      container.remove()
      wipingRef.current = false
      window.clearTimeout(themeTimer)
      window.clearTimeout(endTimer)
    }, total)
  }

  const smoothScrollTo = (hash: string) => {
    const id = hash.replace('#', '')
    const el = document.getElementById(id)
    if (!el) return
    const header = document.querySelector('header') as HTMLElement | null
    const offset = header ? header.offsetHeight + 8 : 0
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <header className="sticky top-2 z-50 mx-2 rounded-3xl border border-border overflow-hidden backdrop-blur supports-[backdrop-filter]:bg-background/70 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.35)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <a href="#hero" className="flex items-center gap-2 font-black tracking-tight text-xl md:text-2xl" aria-label="Go to top" onClick={(e) => { e.preventDefault(); smoothScrollTo('#hero') }}>
          <img src="/icons/logo-temp.png" width={28} height={28} alt="Hilmy logo" className="h-7 w-7 rounded-sm border border-border bg-card" />
          Hilmy.
        </a>
        <div className="hidden md:flex items-center gap-1">
          <a href="#about" className={linkClass} aria-current={current("about")} onClick={(e) => { e.preventDefault(); smoothScrollTo('#about') }}>About</a>
          <a href="#projects" className={linkClass} aria-current={current("projects")} onClick={(e) => { e.preventDefault(); smoothScrollTo('#projects') }}>Projects</a>
          <a href="#terminal" className={linkClass} aria-current={current("terminal")} onClick={(e) => { e.preventDefault(); smoothScrollTo('#terminal') }}>Terminal</a>
          <a href="#social" className={linkClass} aria-current={current("social")} onClick={(e) => { e.preventDefault(); smoothScrollTo('#social') }}>Social</a>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={toggleThemeWithWipe}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
        <div className="md:hidden">
          <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(v => !v)}>
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </nav>
      <div className="hidden md:block border-t border-border">
        <div className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 py-2 grid grid-flow-col auto-cols-[minmax(72px,1fr)] gap-3">
            {[
              "/img/washi.svg",
              "/img/sticker-star.svg",
              "/img/cassette.svg",
              "/img/sticker-heart.svg",
              "/img/cat.svg",
              "/img/pick.svg",
              "/img/ticket.svg",
              "/img/washi-2.svg",
              "/img/tear-paper.svg",
              "/img/starburst.svg",
              "/img/bolt.svg",
            ].map((src, i) => (
              <span
                key={src + i}
                style={{ '--r': `${(i%2?1:-1)}deg`, backgroundImage: `url('${src}')` } as React.CSSProperties}
                className={`h-7 w-full bg-center bg-no-repeat bg-contain ${i%2? 'animate-bob':'animate-drift'}`}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-2">
            <a className={linkClass} href="#about" aria-current={current("about")} onClick={(e) => { e.preventDefault(); setOpen(false); smoothScrollTo('#about') }}>About</a>
            <a className={linkClass} href="#projects" aria-current={current("projects")} onClick={(e) => { e.preventDefault(); setOpen(false); smoothScrollTo('#projects') }}>Projects</a>
            <a className={linkClass} href="#terminal" aria-current={current("terminal")} onClick={(e) => { e.preventDefault(); setOpen(false); smoothScrollTo('#terminal') }}>Terminal</a>
            <a className={linkClass} href="#social" aria-current={current("social")} onClick={(e) => { e.preventDefault(); setOpen(false); smoothScrollTo('#social') }}>Social</a>
            <Button
              variant="outline"
              onClick={toggleThemeWithWipe}
              aria-label="Toggle theme"
              className="mt-2"
            >
              {isDark ? "Light" : "Dark"} Mode
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}


