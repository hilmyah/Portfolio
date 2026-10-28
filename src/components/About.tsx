import * as React from "react"
import type { CSSProperties } from "react"
import { ABOUT, PROFILE, TOOLS, type Tool } from "@/data"
import { Reveal } from "@/components/Reveal"
import { Tooltip } from "@/components/ui/tooltip"
import { useHeroPhotoLoaded } from "@/lib/heroPhoto"
import { usePauseOffscreen } from "@/lib/usePauseOffscreen"

// GIF transparan 1x1. Dipakai sebagai src ikon selama ikonnya belum diunduh: kotak ikon sudah tampil
// dengan ukuran aslinya, tapi belum ada request.
const BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

/**
 * Ikon tools (satu file, src/assets/tools/icons.ts) baru diunduh setelah foto profil tampil (lihat
 * src/lib/heroPhoto.ts), supaya bandwidth awal dipakai untuk foto. Sampai saat itu semua kotak memakai
 * BLANK_IMAGE, sama seperti HTML hasil prerender, jadi halaman bisa disambungkan tanpa selisih.
 *
 * Setelah filenya tiba, ikon dipasang satu per satu di task terpisah (efek berjalan setelah frame
 * digambar). Browser mengurai setiap SVG saat src-nya dipasang; 21 ikon sekaligus menahan main thread
 * kira-kira 90 ms, di HP bisa beberapa kali lipat.
 */
function useToolIcons(): (tool: Tool, index: number) => string {
  const photoLoaded = useHeroPhotoLoaded()
  const [icons, setIcons] = React.useState<Record<string, string> | null>(null)
  const [shown, setShown] = React.useState(0)

  React.useEffect(() => {
    if (!photoLoaded || icons) return
    let active = true
    import("@/assets/tools/icons")
      .then((m) => active && setIcons(m.TOOL_ICONS))
      .catch(() => {
        // gagal diunduh: kotak ikon tetap kosong, sisa halaman tidak terpengaruh
      })
    return () => {
      active = false
    }
  }, [photoLoaded, icons])

  React.useEffect(() => {
    if (!icons || shown >= TOOLS.length) return
    const timer = window.setTimeout(() => setShown((n) => n + 1))
    return () => window.clearTimeout(timer)
  }, [icons, shown])

  return (tool, index) => (icons && index < shown ? (icons[tool.icon] ?? BLANK_IMAGE) : BLANK_IMAGE)
}

/** Posisi miring "tempelan" tiap ikon. Dihitung dari urutannya, jadi selalu sama di setiap kunjungan. */
function toolStyle(i: number): CSSProperties {
  const rot = ((i * 17) % 7) - 3
  const y = ((i * 23) % 6) - 3
  const x = ((i * 31) % 6) - 3
  const cycle = 6 + ((i * 7) % 5) // detik per putaran; keyframes berisi 10 putaran (index.css)
  // --tilt diisi saat hover; ditaruh di transform karena properti rotate dipakai animasi idle.
  return { transform: `translate(${x}px, ${y}px) rotate(calc(${rot}deg + var(--tilt, 0deg)))`, "--idle-dur": `${cycle * 10}s` } as CSSProperties
}

export function About() {
  const sectionRef = React.useRef<HTMLElement | null>(null)
  usePauseOffscreen(sectionRef)
  const iconFor = useToolIcons()

  return (
    <section ref={sectionRef} id="about" className="relative scroll-mt-32 mx-auto max-w-6xl px-4 py-16">
      <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] items-start">
        <Reveal className="relative">
          <div className="rounded-xl border border-border bg-card p-6 card-shadow relative">
            <h2 className="font-black text-2xl md:text-3xl mb-2 underline-scribble inline-block">About</h2>
            <p className="leading-relaxed">
              Hi! I&apos;m {PROFILE.name}. {ABOUT.bio}
            </p>
            <p className="mt-3 italic">{ABOUT.motto}</p>
            <span aria-hidden className="absolute -right-3 -top-2 h-7 w-7 bg-[url('@/assets/img/pixel-heart.svg')] bg-contain bg-no-repeat animate-bob" />
            <span aria-hidden className="absolute right-8 -bottom-3 h-7 w-7 bg-[url('@/assets/img/pacman.svg')] bg-contain bg-no-repeat animate-bob" />
            <span aria-hidden className="absolute -right-5 bottom-5 h-10 w-16 bg-[url('@/assets/img/redhood.svg')] bg-contain bg-no-repeat animate-drift" />
          </div>

          <div className="absolute -top-6 -left-4 rotate-[-3deg] rounded-md border border-yellow-300 bg-yellow-100 px-3 py-2 text-sm shadow text-black">Keep learning • Stay kind</div>
        </Reveal>

        <Reveal className="relative" delay={140}>
          <div className="flex flex-wrap gap-3">
            {TOOLS.map((tool, i) => (
              <Tooltip key={tool.name} content={<div><span className="font-semibold">{tool.name}</span></div>}>
                {/* .tool-pop: ikon muncul bergantian setelah bagian ini terlihat */}
                <span className="tool-pop inline-block" style={{ "--i": i } as CSSProperties}>
                  {/* .tool-icon: ikon bergerak pelan dengan bayangan yang "bernapas" (index.css) */}
                  <span className="tool-icon rounded-md transition-transform hover:scale-110 hover:[--tilt:-2deg]" style={toolStyle(i)}>
                    <span aria-hidden className="tool-shadow tool-shadow-rest" />
                    <span aria-hidden className="tool-shadow tool-shadow-lift" />
                    <img
                      src={iconFor(tool, i)}
                      alt={`${tool.name} icon`}
                      className="block h-10 w-10 md:h-12 md:w-12 rounded-md border border-border bg-card p-2 shadow dark:border-neutral-300 dark:bg-neutral-100 hover:shadow-lg"
                    />
                  </span>
                </span>
              </Tooltip>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
