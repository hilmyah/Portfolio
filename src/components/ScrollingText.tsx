import * as React from "react"
import { prefersReducedMotion } from "@/lib/theme"

const SPEED = 28 // px per detik
const REST_MS = 1600 // berhenti sebentar di setiap ujung
const PAUSE_MS = 2500 // jeda setelah pengunjung menggeser teksnya sendiri

type Props = { text: string; className?: string }

// Satu putaran: diam di kiri, jalan ke kanan, diam di kanan, jalan kembali ke kiri.
function cycle(max: number) {
  const travel = (max / SPEED) * 1000
  return { travel, total: 2 * (REST_MS + travel) }
}

/** Posisi (px dari kiri) dan arah gerak pada waktu t (ms) di dalam putaran. */
function positionAt(t: number, max: number): { pos: number; dir: 1 | -1 } {
  const { travel, total } = cycle(max)
  const time = ((t % total) + total) % total
  if (time < REST_MS) return { pos: 0, dir: 1 }
  if (time < REST_MS + travel) return { pos: ((time - REST_MS) / travel) * max, dir: 1 }
  if (time < 2 * REST_MS + travel) return { pos: max, dir: -1 }
  return { pos: max - ((time - 2 * REST_MS - travel) / travel) * max, dir: -1 }
}

/** Kebalikan positionAt: waktu di dalam putaran untuk posisi dan arah tertentu. */
function timeAt(pos: number, dir: 1 | -1, max: number) {
  const { travel } = cycle(max)
  const progress = Math.min(1, Math.max(0, pos / max))
  return dir > 0 ? REST_MS + progress * travel : 2 * REST_MS + travel + (1 - progress) * travel
}

/** Fase pada waktu t: tepi mana yang perlu pudar, dan berapa ms sampai fase berikutnya. */
function phaseAt(t: number, max: number) {
  const { travel, total } = cycle(max)
  const time = ((t % total) + total) % total
  const ends = [REST_MS, REST_MS + travel, 2 * REST_MS + travel, total]
  const index = ends.findIndex((end) => time < end)
  // diam di kiri | jalan ke kanan | diam di kanan | jalan ke kiri
  const fades = ([[false, true], [true, true], [true, false], [true, true]] as const)[index]
  return { left: fades[0], right: fades[1], remaining: ends[index] - time }
}

/**
 * Satu baris teks yang tidak pernah terpotong. Kalau lebih lebar dari kotaknya, teks berjalan pelan
 * ke ujung, berhenti, lalu kembali (seperti judul lagu di music player). Pengunjung juga bisa
 * menggesernya langsung: drag dengan mouse, swipe di layar sentuh, atau scroll trackpad.
 * Dengan pengaturan "kurangi animasi" di OS teks diam, tapi tetap bisa digeser.
 *
 * Gerakan otomatisnya animasi translate (Web Animations API), jadi dijalankan compositor tanpa kerja
 * per frame di main thread. Begitu pengunjung menggeser sendiri, animasinya dihentikan dan posisinya
 * dipindah ke scroll biasa; setelah jeda, animasi dilanjutkan dari posisi itu.
 */
export function ScrollingText({ text, className = "" }: Props) {
  const boxRef = React.useRef<HTMLDivElement | null>(null)
  const textRef = React.useRef<HTMLSpanElement | null>(null)
  const drag = React.useRef<{ x: number; left: number } | null>(null)
  // Diisi efek auto-scroll: dipanggil handler drag untuk menghentikan dan melanjutkan gerakan.
  const control = React.useRef({ hold: () => {}, release: () => {} })
  // true selama gerakan otomatis berjalan; saat itu scrollLeft selalu 0 dan bukan posisi teks.
  const animating = React.useRef(false)
  const [max, setMax] = React.useState(0)
  const [reduceMotion] = React.useState(prefersReducedMotion)
  const overflowing = max > 2

  // Tepi kiri/kanan memudar hanya kalau masih ada teks tersembunyi di sisi itu.
  const setFades = React.useCallback((left: boolean, right: boolean) => {
    const box = boxRef.current
    if (!box) return
    box.style.setProperty("--fade-l", left ? "14px" : "0px")
    box.style.setProperty("--fade-r", right ? "18px" : "0px")
  }, [])
  const fadesForScroll = React.useCallback((scrollLeft: number, limit: number) => setFades(scrollLeft > 1, scrollLeft < limit - 1), [setFades])

  // Lebar teks dibanding kotaknya. Teks juga dipantau karena lebarnya berubah saat font selesai dimuat.
  React.useEffect(() => {
    const box = boxRef.current
    const span = textRef.current
    if (!box || !span) return
    const measure = () => setMax(Math.max(0, span.offsetWidth - box.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    observer.observe(span)
    return () => observer.disconnect()
  }, [text])

  React.useEffect(() => {
    const box = boxRef.current
    const span = textRef.current
    if (!box || !span) return
    fadesForScroll(box.scrollLeft, max)
    if (!overflowing || reduceMotion) return
    const { travel, total } = cycle(max)

    let animation: Animation | null = null
    let fadeTimer = 0
    let resumeTimer = 0
    let hovered = false
    let held = false // sedang di-drag
    let dir: 1 | -1 = 1

    // Tepi pudar hanya berubah di batas fase, jadi cukup diperbarui empat kali per putaran.
    const scheduleFades = () => {
      window.clearTimeout(fadeTimer)
      if (!animation || animation.playState !== "running") return
      const phase = phaseAt(Number(animation.currentTime ?? 0), max)
      setFades(phase.left, phase.right)
      fadeTimer = window.setTimeout(scheduleFades, phase.remaining + 20)
    }

    const start = (fromTime: number) => {
      animation = span.animate(
        [
          { translate: "0 0", offset: 0 },
          { translate: "0 0", offset: REST_MS / total },
          { translate: `${-max}px 0`, offset: (REST_MS + travel) / total },
          { translate: `${-max}px 0`, offset: (2 * REST_MS + travel) / total },
          { translate: "0 0", offset: 1 },
        ],
        { duration: total, iterations: Infinity }
      )
      animation.currentTime = fromTime
      animating.current = true
      if (hovered) animation.pause()
      scheduleFades()
    }

    // Pindah ke mode scroll biasa: animasi dihentikan dan posisinya diteruskan ke scrollLeft.
    const toScroll = () => {
      window.clearTimeout(resumeTimer)
      window.clearTimeout(fadeTimer)
      if (!animation) return
      const at = positionAt(Number(animation.currentTime ?? 0), max)
      dir = at.dir
      animation.cancel()
      animation = null
      animating.current = false
      box.scrollLeft = at.pos
      fadesForScroll(at.pos, max)
    }

    // Kembali ke animasi dari posisi scroll sekarang, ke arah yang sama seperti sebelumnya.
    const resumeLater = () => {
      window.clearTimeout(resumeTimer)
      resumeTimer = window.setTimeout(() => {
        if (hovered || held || animation) return
        const pos = box.scrollLeft
        box.scrollLeft = 0
        start(timeAt(pos, dir, max))
      }, PAUSE_MS)
    }

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      hovered = true
      animation?.pause()
      window.clearTimeout(fadeTimer)
    }
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      hovered = false
      if (animation) {
        animation.play()
        scheduleFades()
      } else if (!held) {
        resumeLater()
      }
    }
    const onTouchStart = () => toScroll()
    const onTouchEnd = () => resumeLater()
    const onWheel = () => {
      toScroll()
      resumeLater()
    }

    control.current = {
      hold: () => {
        held = true
        toScroll()
      },
      release: () => {
        held = false
        resumeLater()
      },
    }
    box.addEventListener("pointerenter", onEnter)
    box.addEventListener("pointerleave", onLeave)
    box.addEventListener("touchstart", onTouchStart, { passive: true })
    box.addEventListener("touchend", onTouchEnd, { passive: true })
    box.addEventListener("wheel", onWheel, { passive: true })

    box.scrollLeft = 0
    start(0)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(resumeTimer)
      animation?.cancel()
      animating.current = false
      control.current = { hold: () => {}, release: () => {} }
      box.removeEventListener("pointerenter", onEnter)
      box.removeEventListener("pointerleave", onLeave)
      box.removeEventListener("touchstart", onTouchStart)
      box.removeEventListener("touchend", onTouchEnd)
      box.removeEventListener("wheel", onWheel)
    }
  }, [max, overflowing, reduceMotion, setFades, fadesForScroll])

  // Drag dengan mouse. Di layar sentuh kotaknya cukup di-swipe karena memang bisa di-scroll.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!overflowing || e.pointerType !== "mouse" || e.button !== 0) return
    control.current.hold()
    drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
  }
  const endDrag = () => {
    if (!drag.current) return
    drag.current = null
    control.current.release()
  }

  const fade = "linear-gradient(to right, transparent, #000 var(--fade-l, 0px), #000 calc(100% - var(--fade-r, 18px)), transparent)"

  return (
    <div
      ref={boxRef}
      className={`min-w-0 no-scrollbar overflow-x-auto overflow-y-hidden whitespace-nowrap ${overflowing ? "cursor-grab select-none active:cursor-grabbing" : ""} ${className}`}
      style={overflowing ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
      title={overflowing ? text : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onScroll={(e) => {
        if (!animating.current) fadesForScroll(e.currentTarget.scrollLeft, max)
      }}
    >
      <span ref={textRef} className="inline-block pr-1">
        {text}
      </span>
    </div>
  )
}
