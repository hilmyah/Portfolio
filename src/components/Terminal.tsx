import * as React from "react"
import type { ComponentType } from "react"
import { Reveal } from "@/components/Reveal"
import { usePauseOffscreen } from "@/lib/usePauseOffscreen"

type LoadState = { Window: ComponentType } | "waiting" | "failed"

/**
 * Kode terminal (sekitar 14 KB gzip, ditambah font JetBrains Mono) baru diunduh saat bagian ini
 * hampir terlihat. Saat halaman pertama dibuka, bandwidth dipakai dulu untuk foto profil.
 * Selama menunggu, jendela terminal memang belum terlihat (lihat .terminal-window di index.css),
 * jadi tempatnya cukup diisi kotak kosong setinggi jendela supaya layout tidak bergeser.
 */
function useTerminalWindow(section: React.RefObject<HTMLElement | null>): LoadState {
  const [state, setState] = React.useState<LoadState>("waiting")

  React.useEffect(() => {
    const el = section.current
    if (!el) return
    let active = true
    const load = () =>
      import("@/components/TerminalWindow")
        .then((m) => active && setState({ Window: m.TerminalWindow }))
        .catch(() => active && setState("failed"))

    if (!("IntersectionObserver" in window)) {
      load()
      return () => {
        active = false
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        load()
      },
      { rootMargin: "300px 0px" }
    )
    observer.observe(el)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [section])

  return state
}

export function Terminal() {
  const sectionRef = React.useRef<HTMLElement | null>(null)
  usePauseOffscreen(sectionRef)
  const terminal = useTerminalWindow(sectionRef)

  return (
    <section ref={sectionRef} id="terminal" className="relative mx-auto max-w-6xl scroll-mt-32 px-4 py-16">
      <Reveal>
        <h2 className="font-black text-2xl md:text-3xl mb-2 underline-scribble inline-block">Terminal</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          The same portfolio, through a shell. Type a command, or start with help.
        </p>
      </Reveal>
      {typeof terminal === "object" ? (
        <terminal.Window />
      ) : (
        <div className="min-h-[calc(26rem+82px)]">
          {terminal === "failed" && (
            <p className="text-sm text-muted-foreground">The terminal could not be loaded. Refresh the page to try again.</p>
          )}
        </div>
      )}
    </section>
  )
}
