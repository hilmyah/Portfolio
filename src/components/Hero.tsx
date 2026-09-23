import * as React from "react"
import { PROFILE } from "@/data"
import { MusicPlayer } from "@/components/MusicPlayer"

// Activity stickers as emojis (no text labels)
const stickers = [
  { label: "code", emoji: "💻" },
  { label: "coffee", emoji: "☕" },
  { label: "guitar", emoji: "🎸" },
  { label: "books", emoji: "📚" },
  { label: "film", emoji: "🎬" },
  { label: "fashion", emoji: "🧥" },
  { label: "music", emoji: "🎵" },
  { label: "nature", emoji: "⛰️" },
  { label: "bakery", emoji: "🥐" },
  { label: "cycling", emoji: "🚴" },
  { label: "craft", emoji: "✂️" },
]

type Side = "top" | "right" | "bottom" | "left"

type FreeSticker = {
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

// Indie scrapbook layout constants
const STORAGE_KEY = 'heroStickerInstances:v10'
const MAX_ATTEMPTS = 64
const MIN_DISTANCE_PCT = 7
const CONTAINER_PADDING = 12
const OUTSIDE_DISTANCE_RANGE: readonly [number, number] = [12, 22]
const EDGE_OFFSET_RANGE: readonly [number, number] = [-4, 4]
const TANGENT_RANGE: readonly [number, number] = [-14, 14]
const ROTATE_RANGE: readonly [number, number] = [-9, 9]
const SCALE_OUTSIDE_RANGE: readonly [number, number] = [1.02, 1.15]
const SCALE_EDGE_RANGE: readonly [number, number] = [0.95, 1.06]
const DELAY_RANGE: readonly [number, number] = [0, 900]
const DURATION_RANGE: readonly [number, number] = [3400, 6400]

function rng(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
  }
}

function loadSavedLayout(): FreeSticker[] | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FreeSticker[]
    if (!Array.isArray(parsed) || parsed.length !== stickers.length) return null
    return parsed
  } catch { return null }
}

function saveLayout(data: FreeSticker[]): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

function pickSidesSequence(count: number): Side[] {
  const base: Side[] = ["top", "right", "bottom", "left"]
  const seq = Array.from({ length: count }, (_, i) => base[i % base.length])
  shuffleInPlace(seq)
  return seq
}

function generateLayout(containerRect: DOMRect, cardRect: DOMRect, pool: { emoji: string }[]): FreeSticker[] {
  const poolCopy = [...pool]
  shuffleInPlace(poolCopy)
  const placed: FreeSticker[] = []
  const sides = pickSidesSequence(poolCopy.length)

  const placeOne = (emoji: string, index: number): FreeSticker => {
    let candidate: FreeSticker | null = null
    let attempts = 0
    while (attempts < MAX_ATTEMPTS) {
      attempts++
      const side = sides[index]
      const t = (rng(0.12, 0.88) + rng(0.12, 0.88)) / 2
      const mode = Math.random() < 0.6 ? 'outside' : 'edge'
      const outsideDist = rng(...OUTSIDE_DISTANCE_RANGE)
      const edgeOffset = rng(...EDGE_OFFSET_RANGE)
      const tangent = rng(...TANGENT_RANGE)

      let x = 0
      let y = 0
      if (side === 'top') {
        y = cardRect.top + (mode === 'edge' ? -2 + edgeOffset : -outsideDist)
        x = cardRect.left + CONTAINER_PADDING + t * (cardRect.width - CONTAINER_PADDING * 2) + tangent
      } else if (side === 'bottom') {
        y = cardRect.bottom + (mode === 'edge' ? 2 + edgeOffset : outsideDist)
        x = cardRect.left + CONTAINER_PADDING + t * (cardRect.width - CONTAINER_PADDING * 2) + tangent
      } else if (side === 'left') {
        x = cardRect.left + (mode === 'edge' ? -2 + edgeOffset : -outsideDist)
        y = cardRect.top + CONTAINER_PADDING + t * (cardRect.height - CONTAINER_PADDING * 2) + tangent
      } else {
        x = cardRect.right + (mode === 'edge' ? 2 + edgeOffset : outsideDist)
        y = cardRect.top + CONTAINER_PADDING + t * (cardRect.height - CONTAINER_PADDING * 2) + tangent
      }

      const leftPct = ((x - containerRect.left) / containerRect.width) * 100
      const topPct = ((y - containerRect.top) / containerRect.height) * 100

      const rotateDeg = rng(...ROTATE_RANGE)
      const scale = mode === 'outside' ? rng(...SCALE_OUTSIDE_RANGE) : rng(...SCALE_EDGE_RANGE)
      const z = 20
      const anim: FreeSticker['anim'] = Math.random() < 0.5 ? 'bob' : 'drift'
      const delayMs = Math.floor(rng(...DELAY_RANGE))
      const durationMs = Math.floor(rng(...DURATION_RANGE))

      const attempt: FreeSticker = { id: index, emoji, topPct, leftPct, rotateDeg, scale, z, anim, delayMs, durationMs }

      const farEnough = placed.every(p => {
        const dx = p.leftPct - attempt.leftPct
        const dy = p.topPct - attempt.topPct
        const dist = Math.hypot(dx, dy)
        return dist >= MIN_DISTANCE_PCT
      })
      if (farEnough) { candidate = attempt; break }
    }

    if (!candidate) {
      const leftPct = ((cardRect.left - containerRect.left) / containerRect.width) * 100 - 6 + rng(-3, 3)
      const topPct = ((cardRect.top - containerRect.top) / containerRect.height) * 100 - 6 + rng(-3, 3)
      candidate = { id: index, emoji, topPct, leftPct, rotateDeg: rng(-6, 6), scale: 1, z: 20, anim: 'bob', delayMs: 0, durationMs: 4200 }
    }

    return candidate
  }

  poolCopy.forEach((s, idx) => {
    placed.push(placeOne(s.emoji, idx))
  })

  return placed
}

export function Hero() {
  const [instances, setInstances] = React.useState<FreeSticker[]>([])
  const colRef = React.useRef<HTMLDivElement | null>(null)
  const cardRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const saved = loadSavedLayout()
    if (saved) {
      setInstances(saved)
      return
    }
    const gen = () => {
      const col = colRef.current
      const card = cardRef.current
      if (!col || !card) return
      const layout = generateLayout(col.getBoundingClientRect(), card.getBoundingClientRect(), stickers)
      setInstances(layout)
      saveLayout(layout)
    }
    requestAnimationFrame(gen)
  }, [])
  return (
    <section id="hero" className="relative mx-auto max-w-6xl px-4 py-10 md:py-16">
      <div className="grid gap-8 md:grid-cols-2 items-start">
        <div className="relative" ref={colRef}>
          <div
            className="relative z-10 mx-auto aspect-[7/9] w-72 md:w-80 rounded-[12px] border border-border bg-muted overflow-hidden shadow-[0_25px_50px_-12px_rgb(0_0_0_/_45%)] rotate-[-2deg]"
            aria-label="Portrait placeholder"
            ref={cardRef}
          >
            <img
              src={PROFILE.photo.src}
              width={PROFILE.photo.width}
              height={PROFILE.photo.height}
              alt={PROFILE.photo.alt}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-[url('/placeholder/paper-texture.svg')] opacity-20 mix-blend-overlay" />
            <div className="absolute left-2 top-2 rotate-6 bg-yellow-200 px-3 py-1 text-sm shadow border border-yellow-300 text-black">hello!</div>
            <div className="pointer-events-none absolute -right-4 top-6 h-10 w-10 rotate-6 bg-[url('/img/clip.svg')] bg-contain bg-no-repeat opacity-80" />
            <span aria-hidden className="absolute -left-3 -bottom-3 h-10 w-24 rotate-[-4deg] bg-[url('/img/washi.svg')] bg-contain bg-no-repeat opacity-80" />
          </div>
          {/* free-floating stickers around the card edges/outside; layered above the photo but away from center */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            {instances.map((it) => (
              <span
                key={it.id}
                aria-hidden
                style={{
                  top: `${it.topPct}%`,
                  left: `${it.leftPct}%`,
                  zIndex: it.z,
                  ["--rot" as any]: `${it.rotateDeg}deg`,
                  ["--scale" as any]: it.scale,
                  animationDelay: `${it.delayMs}ms`,
                  animationDuration: `${it.durationMs}ms`,
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 text-2xl md:text-3xl transition-transform duration-300 ease-out will-change-transform select-none sticker ${
                  it.anim === "bob" ? "animate-bob-sticker" : "animate-drift-sticker"
                } hover:[--scale:1.15] active:[--scale:.95] pointer-events-auto`}
                role="img"
              >
                {it.emoji}
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


