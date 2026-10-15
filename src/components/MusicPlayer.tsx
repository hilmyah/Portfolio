import * as React from "react"
import { SONGS } from "@/data"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Repeat, Shuffle, SkipBack, SkipForward, Play, Pause, Volume2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { prefersReducedMotion } from "@/lib/theme"

/** Fades an edge only while there is hidden text beyond it, so the first and last letters stay crisp. */
function updateFades(box: HTMLElement) {
  const max = box.scrollWidth - box.clientWidth
  box.style.setProperty("--fade-l", box.scrollLeft > 1 ? "14px" : "0px")
  box.style.setProperty("--fade-r", box.scrollLeft < max - 1 ? "18px" : "0px")
}

/**
 * One line of text that never gets cut off: when it is wider than its box it drifts to the end,
 * waits, drifts back, and so on (like the title on a music player). Visitors can also drag it with
 * the mouse, swipe it on a touch screen or scroll it with a trackpad; it waits a moment after that.
 * With the OS "reduce motion" setting on it stays still, but can still be dragged or swiped.
 */
function ScrollingText({ text, containerClassName, textClassName }: { text: string; containerClassName?: string; textClassName?: string }) {
  const boxRef = React.useRef<HTMLDivElement | null>(null)
  const pausedUntil = React.useRef(0)
  const drag = React.useRef<{ x: number; left: number } | null>(null)
  const [overflowing, setOverflowing] = React.useState(false)
  const [reduceMotion] = React.useState(prefersReducedMotion)

  React.useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const measure = () => {
      setOverflowing(box.scrollWidth > box.clientWidth + 2)
      updateFades(box)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [text])

  React.useEffect(() => {
    const box = boxRef.current
    if (!box || !overflowing || reduceMotion) return
    const SPEED = 28 // px per second
    const REST = 1600 // ms to wait at each end
    let frame = 0
    let last = 0
    let pos = box.scrollLeft
    let dir = 1
    let restUntil = performance.now() + REST
    const step = (now: number) => {
      frame = requestAnimationFrame(step)
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      // Hovering, dragging or a recent swipe/scroll: follow the visitor instead of moving.
      if (drag.current || now < pausedUntil.current || box.matches(":hover")) {
        pos = box.scrollLeft
        return
      }
      if (now < restUntil) return
      const max = box.scrollWidth - box.clientWidth
      pos = Math.min(max, Math.max(0, pos + dir * SPEED * dt))
      if (pos >= max || pos <= 0) {
        dir = pos >= max ? -1 : 1
        restUntil = now + REST
      }
      box.scrollLeft = pos
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [overflowing, reduceMotion, text])

  const pause = () => {
    pausedUntil.current = performance.now() + 2500
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!overflowing || e.pointerType !== "mouse" || e.button !== 0) return
    drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
  }
  const endDrag = () => {
    if (!drag.current) return
    drag.current = null
    pause()
  }

  // Faded edges hint that there is more text to either side (see updateFades).
  const fade = "linear-gradient(to right, transparent, #000 var(--fade-l, 0px), #000 calc(100% - var(--fade-r, 18px)), transparent)"

  return (
    <div
      ref={boxRef}
      className={`min-w-0 overflow-x-auto overflow-y-hidden whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${overflowing ? "cursor-grab select-none active:cursor-grabbing" : ""} ${containerClassName || ""} ${textClassName || ""}`}
      style={overflowing ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
      title={overflowing ? text : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onScroll={(e) => updateFades(e.currentTarget)}
      onTouchStart={pause}
      onWheel={pause}
    >
      <span className="inline-block pr-1">{text}</span>
    </div>
  )
}

type AudioState = {
  currentIndex: number
  isPlaying: boolean
  progress: number // seconds
  duration: number // seconds
  volume: number // 0 - 1
  shuffle: boolean
  repeat: boolean
}

type PlayerProps = { minimal?: boolean }

/** With a single song, shuffle has nothing to mix: the button stays off and explains why instead. */
const SINGLE_TRACK = SONGS.length < 2
const SHUFFLE_HINT = "There's only 1 song, so shuffle isn't needed."

export function MusicPlayer(props: PlayerProps) {
  if (SONGS.length === 0) return null
  return <MusicPlayerInner {...props} />
}

function MusicPlayerInner({ minimal = false }: PlayerProps) {
  const [state, setState] = React.useState<AudioState>({
    currentIndex: 0,
    isPlaying: false,
    progress: 0,
    duration: 0,
    volume: 0.8,
    shuffle: false,
    repeat: false,
  })

  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  // Shuffle hint: shown on hover (mouse) or for a moment after a tap/click (touch screens have no hover).
  const [shuffleHint, setShuffleHint] = React.useState(false)
  const hintTimer = React.useRef<number | undefined>(undefined)
  const hintId = React.useId()
  React.useEffect(() => () => window.clearTimeout(hintTimer.current), [])
  const flashShuffleHint = () => {
    setShuffleHint(true)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setShuffleHint(false), 2500)
  }
  // Tracks played before the current one, so "previous" walks back through a shuffled order too.
  const historyRef = React.useRef<number[]>([])

  const currentSong = SONGS[state.currentIndex]

  React.useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = state.volume
  }, [state.volume])

  React.useEffect(() => {
    if (!audioRef.current) return
    if (state.isPlaying) audioRef.current.play().catch(() => {})
    else audioRef.current.pause()
  }, [state.isPlaying, state.currentIndex])

  const onTimeUpdate = () => {
    const a = audioRef.current
    if (!a) return
    setState((s) => ({ ...s, progress: a.currentTime, duration: a.duration || 0 }))
  }

  const seek = (time: number) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = time
    setState((s) => ({ ...s, progress: time }))
  }

  const format = (sec: number) => {
    if (!isFinite(sec)) return "0:00"
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  /** Shuffle never picks the song that is already playing (when there is another one to pick). */
  const pickNext = (s: AudioState) => {
    if (!s.shuffle || SONGS.length < 2) return (s.currentIndex + 1) % SONGS.length
    const others = SONGS.map((_, i) => i).filter((i) => i !== s.currentIndex)
    return others[Math.floor(Math.random() * others.length)]
  }

  const restartCurrent = () => {
    const a = audioRef.current
    if (a) a.currentTime = 0
    setState((s) => ({ ...s, progress: 0 }))
  }

  const goTo = (index: number, keepPlaying?: boolean) => {
    if (index === state.currentIndex) return
    historyRef.current = [...historyRef.current.slice(-49), state.currentIndex]
    setState((s) => ({ ...s, currentIndex: index, progress: 0, isPlaying: keepPlaying ?? s.isPlaying }))
  }

  const next = () => {
    const index = pickNext(state)
    if (index === state.currentIndex) restartCurrent()
    else goTo(index)
  }

  const prev = () => {
    // Like most players: past the first few seconds, "previous" restarts the current song.
    if (state.progress > 3) return restartCurrent()
    const previous = historyRef.current.pop()
    const index = previous ?? (state.currentIndex - 1 + SONGS.length) % SONGS.length
    if (index === state.currentIndex) return restartCurrent()
    setState((s) => ({ ...s, currentIndex: index, progress: 0 }))
  }

  // With repeat on, the <audio loop> attribute replays the song and "ended" never fires.
  // With repeat off and nothing else to play (one song), it plays once and stops at the start.
  const onEnded = () => {
    const index = pickNext(state)
    if (index === state.currentIndex) {
      restartCurrent()
      setState((s) => ({ ...s, isPlaying: false }))
    } else {
      goTo(index, true)
    }
  }

  const toggleClass = (active: boolean) =>
    "relative " + (active ? "bg-accent text-foreground after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-current" : "text-muted-foreground")

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))) return
      if (e.code === "Space") {
        e.preventDefault()
        setState((s) => ({ ...s, isPlaying: !s.isPlaying }))
      } else if (e.code === "ArrowRight") {
        seek(Math.min(state.progress + 5, state.duration))
      } else if (e.code === "ArrowLeft") {
        seek(Math.max(state.progress - 5, 0))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state.progress, state.duration])

  return (
    <Card className="overflow-hidden card-shadow">
      <CardHeader className="flex flex-col gap-4">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <div className="space-y-4">
            {/* polish: vinyl. A record slides out from behind the cover and spins while a song plays. */}
            <div className="relative">
            <span aria-hidden className="vinyl" data-playing={state.isPlaying} />
            <div className={`relative z-10 aspect-square overflow-hidden rounded-md border border-border bg-muted ${state.isPlaying ? 'animate-wobble-soft shadow-lg' : ''}`}>
              <img src={currentSong.albumArt} alt="current album art" className="h-full w-full object-cover" />
              <span aria-hidden className="pointer-events-none absolute -left-1 -top-1 h-4 w-10 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
              <span aria-hidden className="pointer-events-none absolute -right-1 -top-1 h-4 w-10 rotate-6 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
              <span aria-hidden className="absolute right-3 top-3 h-16 w-0.5 bg-black/50 origin-top rotate-12 rounded-full" />
            </div>
            </div>
          </div>
          <div className="min-w-0 self-center">
            {!minimal && (
              <>
                <div className="relative inline-block -rotate-1 rounded-md border border-border bg-accent/40 px-3 py-2 shadow">
                  <p className="font-handwriting text-lg md:text-2xl italic leading-snug" aria-live="polite">
                    {currentSong.lyric?.trim() ? `“${currentSong.lyric}”` : 'Speak your mind, and let the music play.'}
                  </p>
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <div className="hidden md:flex items-end gap-1" aria-hidden>
                    <span className={`eq-bar ${state.isPlaying ? 'animate-eq' : ''}`} />
                    <span className={`eq-bar delay-100 ${state.isPlaying ? 'animate-eq' : ''}`} />
                    <span className={`eq-bar delay-200 ${state.isPlaying ? 'animate-eq' : ''}`} />
                    <span className={`eq-bar delay-300 ${state.isPlaying ? 'animate-eq' : ''}`} />
                    <span className={`eq-bar delay-400 ${state.isPlaying ? 'animate-eq' : ''}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <ScrollingText
                      text={currentSong.title}
                      containerClassName="max-w-[260px] md:max-w-[420px]"
                      textClassName="text-2xl md:text-3xl font-black"
                    />
                    <ScrollingText
                      text={currentSong.artist}
                      containerClassName="max-w-[260px] md:max-w-[420px]"
                      textClassName="text-base md:text-lg text-muted-foreground"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {!minimal && <span className="w-10 text-xs tabular-nums">{format(state.progress)}</span>}
          {/* The played part of the bar shows the album-cover gradient (.seek-fill in index.css). */}
          <Slider
            min={0}
            max={Math.max(state.duration, 0.00001)}
            step={0.1}
            value={state.progress}
            onChange={(e) => seek(Number((e.target as HTMLInputElement).value))}
            aria-label="Seek"
            className="seek-fill"
            style={{ "--p": `${state.duration > 0 ? Math.min(100, (state.progress / state.duration) * 100) : 0}%` } as React.CSSProperties}
          />
          {!minimal && <span className="w-10 text-xs tabular-nums text-right">{format(state.duration)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            {SINGLE_TRACK ? (
              <span className="group relative inline-flex">
                <Button variant="ghost" size="icon" className={toggleClass(false) + " cursor-help"} onClick={flashShuffleHint} aria-disabled="true" aria-label="Shuffle" aria-describedby={hintId}>
                  <Shuffle className="h-5 w-5" />
                </Button>
                <span
                  id={hintId}
                  role="tooltip"
                  data-show={shuffleHint}
                  className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-max max-w-[13rem] translate-y-1 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs leading-snug text-popover-foreground opacity-0 shadow-md transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-has-[:focus-visible]:translate-y-0 group-has-[:focus-visible]:opacity-100 data-[show=true]:translate-y-0 data-[show=true]:opacity-100"
                >
                  {SHUFFLE_HINT}
                  <span aria-hidden className="absolute left-3.5 top-full -mt-1 h-2 w-2 rotate-45 border-b border-r border-border bg-popover" />
                </span>
              </span>
            ) : (
              <Button variant="ghost" size="icon" className={toggleClass(state.shuffle)} onClick={() => setState((s) => ({ ...s, shuffle: !s.shuffle }))} aria-pressed={state.shuffle} aria-label="Shuffle" title={state.shuffle ? "Shuffle: on" : "Shuffle: off"}>
                <Shuffle className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={prev} aria-label="Previous">
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => setState((s) => ({ ...s, isPlaying: !s.isPlaying }))} aria-label={state.isPlaying ? "Pause" : "Play"}>
              {state.isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={next} aria-label="Next">
              <SkipForward className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className={toggleClass(state.repeat)} onClick={() => setState((s) => ({ ...s, repeat: !s.repeat }))} aria-pressed={state.repeat} aria-label="Repeat" title={state.repeat ? "Repeat this song: on" : "Repeat this song: off"}>
              <Repeat className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            {!minimal && (
              <>
                <Volume2 className="h-4 w-4 shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.volume}
                  onChange={(e) => setState((s) => ({ ...s, volume: Number(e.target.value) }))}
                  aria-label="Volume"
                  className="h-2 w-full min-w-10 max-w-28 cursor-pointer rounded-full bg-muted"
                />
              </>
            )}
          </div>
        </div>
        <audio
          ref={audioRef}
          src={currentSong.src}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          loop={state.repeat}
          preload="none"
        />
      </CardContent>
    </Card>
  )
}
