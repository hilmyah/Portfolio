import * as React from "react"
import { PROFILE } from "@/data"
import { MusicPlayer } from "@/components/MusicPlayer"
import { heroPhotoLoaded, releaseAfterHeroPhoto } from "@/lib/heroPhoto"
import { prefersReducedMotion } from "@/lib/theme"
import { usePauseOffscreen } from "@/lib/usePauseOffscreen"

// Stiker hobi di sekitar foto. Posisinya diacak sekali per pengunjung lalu disimpan di
// localStorage, supaya tidak berpindah-pindah setiap halaman dibuka.
const STICKER_EMOJIS = ["💻", "☕", "🎸", "📚", "🎬", "🧥", "🎵", "⛰️", "🥐", "🚴", "✂️"]

// Naikkan versi key ini kalau bentuk datanya berubah, supaya layout lama tidak dipakai lagi.
const STORAGE_KEY = "heroStickerInstances:v10"

type Sticker = {
  id: number
  emoji: string
  topPct: number
  leftPct: number
  rotateDeg: number
  scale: number
  z: number
  anim: "bob" | "drift"
  delayMs: number
  durationMs: number
}

type Side = "top" | "right" | "bottom" | "left"
type Range = readonly [number, number]

const MAX_ATTEMPTS = 64
const MIN_DISTANCE_PCT = 7 // jarak minimum antar stiker, dalam persen ukuran kolom
const EDGE_PADDING = 12 // px dari sudut kartu foto
const OUTSIDE_DISTANCE: Range = [12, 22] // px di luar tepi kartu
const EDGE_OFFSET: Range = [-4, 4] // px dari tepi kartu, untuk stiker yang menempel di tepi
const TANGENT_JITTER: Range = [-14, 14]
const ROTATE: Range = [-9, 9]
const SCALE_OUTSIDE: Range = [1.02, 1.15]
const SCALE_EDGE: Range = [0.95, 1.06]
const DELAY_MS: Range = [0, 900]
const DURATION_MS: Range = [3400, 6400]

const random = ([min, max]: Range) => Math.random() * (max - min) + min

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function loadLayout(): Sticker[] | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Sticker[] | null
    return Array.isArray(parsed) && parsed.length === STICKER_EMOJIS.length ? parsed : null
  } catch {
    return null
  }
}

function saveLayout(layout: Sticker[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // localStorage tidak tersedia: layout diacak lagi di kunjungan berikutnya
  }
}

/** Titik acak di salah satu sisi kartu, sedikit di luar (60%) atau tepat di tepinya (40%). */
function pointNear(card: DOMRect, side: Side): { x: number; y: number; outside: boolean } {
  const outside = Math.random() < 0.6
  const t = (random([0.12, 0.88]) + random([0.12, 0.88])) / 2 // cenderung ke tengah sisi
  const distance = random(OUTSIDE_DISTANCE)
  const edge = random(EDGE_OFFSET)
  const tangent = random(TANGENT_JITTER)
  const alongX = card.left + EDGE_PADDING + t * (card.width - EDGE_PADDING * 2) + tangent
  const alongY = card.top + EDGE_PADDING + t * (card.height - EDGE_PADDING * 2) + tangent
  switch (side) {
    case "top":
      return { x: alongX, y: card.top + (outside ? -distance : -2 + edge), outside }
    case "bottom":
      return { x: alongX, y: card.bottom + (outside ? distance : 2 + edge), outside }
    case "left":
      return { x: card.left + (outside ? -distance : -2 + edge), y: alongY, outside }
    case "right":
      return { x: card.right + (outside ? distance : 2 + edge), y: alongY, outside }
  }
}

function generateLayout(column: DOMRect, card: DOMRect): Sticker[] {
  const emojis = shuffle(STICKER_EMOJIS)
  const sides = shuffle(emojis.map((_, i): Side => (["top", "right", "bottom", "left"] as const)[i % 4]))
  const placed: Sticker[] = []

  emojis.forEach((emoji, id) => {
    let sticker: Sticker | null = null
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !sticker; attempt++) {
      const { x, y, outside } = pointNear(card, sides[id])
      const candidate: Sticker = {
        id,
        emoji,
        topPct: ((y - column.top) / column.height) * 100,
        leftPct: ((x - column.left) / column.width) * 100,
        rotateDeg: random(ROTATE),
        scale: random(outside ? SCALE_OUTSIDE : SCALE_EDGE),
        z: 20,
        anim: Math.random() < 0.5 ? "bob" : "drift",
        delayMs: Math.floor(random(DELAY_MS)),
        durationMs: Math.floor(random(DURATION_MS)),
      }
      const farEnough = placed.every((p) => Math.hypot(p.leftPct - candidate.leftPct, p.topPct - candidate.topPct) >= MIN_DISTANCE_PCT)
      if (farEnough) sticker = candidate
    }
    // Tidak menemukan tempat kosong: taruh dekat sudut kiri atas kartu.
    placed.push(
      sticker ?? {
        id,
        emoji,
        topPct: ((card.top - column.top) / column.height) * 100 - 6 + random([-3, 3]),
        leftPct: ((card.left - column.left) / column.width) * 100 - 6 + random([-3, 3]),
        rotateDeg: random([-6, 6]),
        scale: 1,
        z: 20,
        anim: "bob",
        delayMs: 0,
        durationMs: 4200,
      }
    )
  })
  return placed
}

/** Foto condong mengikuti kursor dengan kilau tipis. Hanya untuk mouse/trackpad. */
function useTilt(area: React.RefObject<HTMLDivElement | null>, card: React.RefObject<HTMLDivElement | null>) {
  React.useEffect(() => {
    const areaEl = area.current
    const cardEl = card.current
    if (!areaEl || !cardEl) return
    if (!window.matchMedia("(pointer: fine)").matches || prefersReducedMotion()) return
    let frame = 0
    const apply = (x: number, y: number) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        cardEl.style.setProperty("--tilt-x", `${(x * 7).toFixed(2)}deg`)
        cardEl.style.setProperty("--tilt-y", `${(-y * 7).toFixed(2)}deg`)
        cardEl.style.setProperty("--glare-x", `${(50 + x * 45).toFixed(1)}%`)
        cardEl.style.setProperty("--glare-y", `${(50 + y * 45).toFixed(1)}%`)
      })
    }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v))
    const onMove = (e: PointerEvent) => {
      const r = cardEl.getBoundingClientRect()
      cardEl.dataset.tilting = "true"
      apply(clamp(((e.clientX - r.left) / r.width) * 2 - 1), clamp(((e.clientY - r.top) / r.height) * 2 - 1))
    }
    const onLeave = () => {
      delete cardEl.dataset.tilting
      apply(0, 0)
    }
    areaEl.addEventListener("pointermove", onMove)
    areaEl.addEventListener("pointerleave", onLeave)
    return () => {
      cancelAnimationFrame(frame)
      areaEl.removeEventListener("pointermove", onMove)
      areaEl.removeEventListener("pointerleave", onLeave)
    }
  }, [area, card])
}

export function Hero() {
  const [stickers, setStickers] = React.useState<Sticker[]>([])
  const columnRef = React.useRef<HTMLDivElement | null>(null)
  const cardRef = React.useRef<HTMLDivElement | null>(null)
  const sectionRef = React.useRef<HTMLElement | null>(null)
  const photoRef = React.useRef<HTMLImageElement | null>(null)
  useTilt(columnRef, cardRef)
  usePauseOffscreen(sectionRef)

  // Foto sudah selesai diunduh sebelum halaman tampil (koneksi cepat atau dari cache): ikut tergambar
  // di frame pertama, jadi font dan ikon bisa langsung dilepas.
  React.useEffect(() => {
    if (photoRef.current?.complete) releaseAfterHeroPhoto()
  }, [])

  React.useEffect(() => {
    const saved = loadLayout()
    if (saved) {
      setStickers(saved)
      return
    }
    // Ukuran kartu baru pasti setelah frame pertama selesai di-layout.
    const frame = requestAnimationFrame(() => {
      if (!columnRef.current || !cardRef.current) return
      const layout = generateLayout(columnRef.current.getBoundingClientRect(), cardRef.current.getBoundingClientRect())
      setStickers(layout)
      saveLayout(layout)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <section ref={sectionRef} id="hero" className="relative mx-auto max-w-6xl px-4 py-10 md:py-16">
      <div className="grid gap-8 lg:grid-cols-2 items-start">
        <div className="relative" ref={columnRef}>
          <div
            ref={cardRef}
            className="hero-tilt relative z-10 mx-auto aspect-[7/9] w-72 md:w-80 rounded-[12px] border border-border bg-muted overflow-hidden shadow-[0_25px_50px_-12px_rgb(0_0_0_/_45%)] rotate-[-2deg]"
            aria-label="Portrait of Hilmy Adhyandra Hamzah"
          >
            <img
              ref={photoRef}
              src={PROFILE.photo.src}
              width={PROFILE.photo.width}
              height={PROFILE.photo.height}
              alt={PROFILE.photo.alt}
              className="h-full w-full object-cover"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onLoad={(e) => heroPhotoLoaded(e.currentTarget)}
              onError={(e) => heroPhotoLoaded(e.currentTarget)}
            />
            <div className="absolute inset-0 bg-[url('/placeholder/paper-texture.svg')] opacity-20 mix-blend-overlay" />
            <div className="absolute left-2 top-2 rotate-6 bg-yellow-200 px-3 py-1 text-sm shadow border border-yellow-300 text-black">hello!</div>
            <div className="pointer-events-none absolute -right-4 top-6 h-10 w-10 rotate-6 bg-[url('/img/clip.svg')] bg-contain bg-no-repeat opacity-80" />
            <span aria-hidden className="absolute -left-3 -bottom-3 h-10 w-24 rotate-[-4deg] bg-[url('/img/washi.svg')] bg-contain bg-no-repeat opacity-80" />
          </div>

          {/* Stiker berada di atas foto, tapi diletakkan di tepi kartu supaya wajah tidak tertutup. */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            {stickers.map((s) => (
              <span
                key={s.id}
                aria-hidden
                role="img"
                className={`sticker absolute text-2xl md:text-3xl transition-transform duration-300 ease-out select-none pointer-events-auto hover:[--scale:1.15] active:[--scale:.95] ${
                  s.anim === "bob" ? "animate-bob-sticker" : "animate-drift-sticker"
                }`}
                style={
                  {
                    top: `${s.topPct}%`,
                    left: `${s.leftPct}%`,
                    zIndex: s.z,
                    "--rot": `${s.rotateDeg}deg`,
                    "--base-scale": s.scale,
                    animationDelay: `${s.delayMs}ms`,
                    // keyframes berisi 10 putaran (lihat catatan animasi di index.css)
                    animationDuration: `${s.durationMs * 10}ms`,
                  } as React.CSSProperties
                }
              >
                {s.emoji}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <MusicPlayer />
        </div>
      </div>
    </section>
  )
}
