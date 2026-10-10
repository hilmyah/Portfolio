import * as React from "react"
import { SONGS } from "@/data"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Repeat, Shuffle, SkipBack, SkipForward, Play, Pause, Volume2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

function ScrollingText({ text, containerClassName, textClassName }: { text: string; containerClassName?: string; textClassName?: string }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const measureRef = React.useRef<HTMLDivElement | null>(null)
  const [shouldMarquee, setShouldMarquee] = React.useState(false)
  const [durationMs, setDurationMs] = React.useState(18000)

  React.useEffect(() => {
    const doMeasure = () => {
      const container = containerRef.current
      const measureEl = measureRef.current
      if (!container || !measureEl) return
      const needs = measureEl.scrollWidth > container.clientWidth + 2
      setShouldMarquee(needs)
      if (needs) {
        const overflow = measureEl.scrollWidth - container.clientWidth
        const pxPerSec = 60
        const ms = Math.min(28000, Math.max(12000, Math.round((overflow / pxPerSec) * 1000)))
        setDurationMs(ms)
      }
    }
    const raf = requestAnimationFrame(doMeasure)
    const ro = new ResizeObserver(doMeasure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [text])

  return (
    <div ref={containerRef} className={`relative overflow-hidden min-w-0 ${containerClassName || ""}`}>
      {/* hidden measuring element to decide overflow without affecting layout */}
      <div ref={measureRef} className={`absolute left-0 top-0 invisible whitespace-nowrap pointer-events-none ${textClassName || ""}`}>{text}</div>
      {shouldMarquee ? (
        <div
          ref={contentRef}
          className={`flex w-max animate-marquee ${textClassName || ""}`}
          style={{ animationDuration: `${durationMs}ms` }}
          aria-label={text}
        >
          <span className="pr-10 whitespace-nowrap">{text}</span>
          <span className="pr-10 whitespace-nowrap" aria-hidden>
            {text}
          </span>
        </div>
      ) : (
        <div ref={contentRef} className={`truncate whitespace-nowrap ${textClassName || ""}`} aria-label={text}>
          {text}
        </div>
      )}
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
  const onEnded = () => {
    const index = pickNext(state)
    if (index === state.currentIndex) {
      restartCurrent()
      audioRef.current?.play().catch(() => {})
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
                  <div className="min-w-0">
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
          <Slider
            min={0}
            max={Math.max(state.duration, 0.00001)}
            step={0.1}
            value={state.progress}
            onChange={(e) => seek(Number((e.target as HTMLInputElement).value))}
            aria-label="Seek"
          />
          {!minimal && <span className="w-10 text-xs tabular-nums text-right">{format(state.duration)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" className={toggleClass(state.shuffle)} onClick={() => setState((s) => ({ ...s, shuffle: !s.shuffle }))} aria-pressed={state.shuffle} aria-label="Shuffle" title={state.shuffle ? "Shuffle: on" : "Shuffle: off"}>
              <Shuffle className="h-5 w-5" />
            </Button>
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
