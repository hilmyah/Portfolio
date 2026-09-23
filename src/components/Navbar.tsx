import * as React from "react"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Menu } from "lucide-react"

export function Navbar() {
  const [open, setOpen] = React.useState(false)
  const [isDark, setIsDark] = React.useState(false)
  const wipingRef = React.useRef(false)

  React.useEffect(() => {
    const root = document.documentElement
    if (isDark) root.classList.add("dark")
    else root.classList.remove("dark")
  }, [isDark])

  const linkClass = "px-3 py-2 rounded-md hover:bg-accent/60"

  const toggleThemeWithWipe = () => {
    if (wipingRef.current) return
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
    const themeTimer = window.setTimeout(() => { setIsDark(v => !v) }, midTime)

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
          <img src="/icons/logo-temp.svg" alt="Raihan logo" className="h-7 w-7 rounded-sm border border-border bg-card" />
          Raihan.
        </a>
        <div className="hidden md:flex items-center gap-1">
          <a href="#about" className={linkClass} onClick={(e) => { e.preventDefault(); smoothScrollTo('#about') }}>About</a>
          <a href="#projects" className={linkClass} onClick={(e) => { e.preventDefault(); smoothScrollTo('#projects') }}>Projects</a>
          <a href="#social" className={linkClass} onClick={(e) => { e.preventDefault(); smoothScrollTo('#social') }}>Social</a>
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
                style={{ ['--r' as any]: `${(i%2?1:-1)}deg`, backgroundImage: `url('${src}')` }}
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
            <a className={linkClass} href="#about" onClick={(e) => { e.preventDefault(); setOpen(false); smoothScrollTo('#about') }}>About</a>
            <a className={linkClass} href="#projects" onClick={(e) => { e.preventDefault(); setOpen(false); smoothScrollTo('#projects') }}>Projects</a>
            <a className={linkClass} href="#social" onClick={(e) => { e.preventDefault(); setOpen(false); smoothScrollTo('#social') }}>Social</a>
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


