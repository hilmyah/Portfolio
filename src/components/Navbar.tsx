import * as React from "react"
import { createPortal } from "react-dom"
import { Menu, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { prefersReducedMotion, toggleTheme, useTheme } from "@/lib/theme"

const SECTIONS = [
  { id: "about", label: "About" },
  { id: "projects", label: "Projects" },
  { id: "terminal", label: "Terminal" },
  { id: "social", label: "Social" },
]

// Stiker kecil di strip bawah navbar (desktop). Indeks ganjil bergoyang naik-turun, indeks genap
// bergeser ke samping.
const STRIP = [
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
]

const LINK_CLASS = "nav-link px-3 py-2 rounded-md hover:bg-accent/60"

// Ganti tema dengan lima lembar kertas yang terbuka bergantian. Tema berganti saat lembar tengah
// menutupi layar, lalu lapisannya dilepas setelah lembar terakhir selesai.
const FLIP_SHEETS = 5
const FLIP_STAGGER_MS = 80
const FLIP_SWAP_MS = FLIP_STAGGER_MS * Math.floor(FLIP_SHEETS / 2) + 220
const FLIP_DONE_MS = FLIP_STAGGER_MS * (FLIP_SHEETS - 1) + 1500

function usePageFlipTheme() {
  const [flipping, setFlipping] = React.useState(false)
  const busy = React.useRef(false)
  const timers = React.useRef<number[]>([])

  React.useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const flip = () => {
    if (busy.current) return
    if (prefersReducedMotion()) {
      toggleTheme()
      return
    }
    busy.current = true
    setFlipping(true)
    timers.current = [
      window.setTimeout(toggleTheme, FLIP_SWAP_MS),
      window.setTimeout(() => {
        busy.current = false
        setFlipping(false)
      }, FLIP_DONE_MS),
    ]
  }

  const overlay = flipping
    ? createPortal(
        <div className="theme-pageflip">
          {Array.from({ length: FLIP_SHEETS }, (_, i) => (
            <div key={i} className="sheet" style={{ animationDelay: `${i * FLIP_STAGGER_MS}ms` }}>
              <div className="face front" />
              <div className="face back" />
            </div>
          ))}
        </div>,
        document.body
      )
    : null

  return { flip, overlay }
}

/** Bagian yang sedang dibaca: yang terakhir melewati garis 35% dari atas layar, atau Social di dasar halaman. */
function useActiveSection() {
  const [active, setActive] = React.useState<string | null>(null)

  React.useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
        setActive("social")
        return
      }
      const marker = window.innerHeight * 0.35
      let current: string | null = null
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= marker) current = id
      }
      setActive(current)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [])

  return active
}

/** Scroll halus ke sebuah bagian, berhenti tepat di bawah navbar yang menempel. */
function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const header = document.querySelector("header")
  const offset = header ? header.offsetHeight + 8 : 0
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" })
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const isDark = useTheme() === "dark"
  const active = useActiveSection()
  const { flip, overlay } = usePageFlipTheme()

  const sectionLink = (id: string, label: string, closeMenu = false) => (
    <a
      key={id}
      href={`#${id}`}
      className={LINK_CLASS}
      aria-current={active === id ? "location" : undefined}
      onClick={(e) => {
        e.preventDefault()
        if (closeMenu) setMenuOpen(false)
        scrollToSection(id)
      }}
    >
      {label}
    </a>
  )

  return (
    <header className="sticky top-2 z-50 mx-2 rounded-3xl border border-border overflow-hidden backdrop-blur supports-[backdrop-filter]:bg-background/70 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.35)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <a
          href="#hero"
          className="flex items-center gap-2 font-black tracking-tight text-xl md:text-2xl"
          aria-label="Go to top"
          onClick={(e) => {
            e.preventDefault()
            scrollToSection("hero")
          }}
        >
          <img src="/icons/logo-temp.png" width={28} height={28} alt="Hilmy logo" className="h-7 w-7 rounded-sm border border-border bg-card" />
          Hilmy.
        </a>
        <div className="hidden md:flex items-center gap-1">
          {SECTIONS.map(({ id, label }) => sectionLink(id, label))}
          <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={flip}>
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
        <div className="md:hidden">
          <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setMenuOpen((v) => !v)}>
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </nav>

      <div className="hidden md:block border-t border-border">
        <div className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 py-2 grid grid-flow-col auto-cols-[minmax(72px,1fr)] gap-3">
            {STRIP.map((src, i) => (
              <span
                key={src}
                aria-hidden
                className={`h-7 w-full bg-center bg-no-repeat bg-contain ${i % 2 ? "animate-bob" : "animate-drift"}`}
                style={{ "--r": `${i % 2 ? 1 : -1}deg`, backgroundImage: `url('${src}')` } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-2">
            {SECTIONS.map(({ id, label }) => sectionLink(id, label, true))}
            <Button variant="outline" onClick={flip} aria-label="Toggle theme" className="mt-2">
              {isDark ? "Light" : "Dark"} Mode
            </Button>
          </div>
        </div>
      )}

      {overlay}
    </header>
  )
}
