import * as React from "react"
import { Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react"
import { SONGS } from "@/data"
import { ScrollingText } from "@/components/ScrollingText"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"

type PlayerState = {
  index: number
  playing: boolean
  progress: number // detik
  duration: number // detik
  volume: number // 0 sampai 1
  shuffle: boolean
  repeat: boolean
}

type PlayerProps = { minimal?: boolean }

// Dengan satu lagu, shuffle tidak punya apa-apa untuk diacak: tombolnya tetap off dan menjelaskan alasannya.
const SINGLE_TRACK = SONGS.length < 2
const SHUFFLE_HINT = "There's only 1 song, so shuffle isn't needed."

function formatTime(sec: number) {
  if (!isFinite(sec)) return "0:00"
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

/** Lagu berikutnya. Shuffle tidak pernah memilih lagu yang sedang diputar (kalau ada pilihan lain). */
function nextIndex(s: PlayerState) {
  if (!s.shuffle || SONGS.length < 2) return (s.index + 1) % SONGS.length
  const others = SONGS.map((_, i) => i).filter((i) => i !== s.index)
  return others[Math.floor(Math.random() * others.length)]
}

const toggleClass = (active: boolean) =>
  "relative " +
  (active
    ? "bg-accent text-foreground after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-current"
    : "text-muted-foreground")

/** Petunjuk shuffle: muncul saat hover (mouse) atau sebentar setelah diklik/diketuk (layar sentuh tidak punya hover). */
function ShuffleHint() {
  const [show, setShow] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)
  const id = React.useId()
  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  const flash = () => {
    setShow(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShow(false), 2500)
  }

  return (
    <span className="group relative inline-flex">
      <Button variant="ghost" size="icon" className={toggleClass(false) + " cursor-help"} onClick={flash} aria-disabled="true" aria-label="Shuffle" aria-describedby={id}>
        <Shuffle className="h-5 w-5" />
      </Button>
      <span
        id={id}
        role="tooltip"
        data-show={show}
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-max max-w-[13rem] translate-y-1 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs leading-snug text-popover-foreground opacity-0 shadow-md transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-has-[:focus-visible]:translate-y-0 group-has-[:focus-visible]:opacity-100 data-[show=true]:translate-y-0 data-[show=true]:opacity-100"
      >
        {SHUFFLE_HINT}
        <span aria-hidden className="absolute left-3.5 top-full -mt-1 h-2 w-2 rotate-45 border-b border-r border-border bg-popover" />
      </span>
    </span>
  )
}

export function MusicPlayer(props: PlayerProps) {
  if (SONGS.length === 0) return null
  return <Player {...props} />
}

function Player({ minimal = false }: PlayerProps) {
  const [state, setState] = React.useState<PlayerState>({
    index: 0,
    playing: false,
    progress: 0,
    duration: 0,
    volume: 0.8,
    shuffle: false,
    repeat: false,
  })
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  // Urutan lagu yang sudah diputar, supaya "previous" juga bisa mundur di urutan acak.
  const history = React.useRef<number[]>([])
  // Salinan state terbaru untuk handler keyboard, supaya listener-nya cukup dipasang sekali.
  // useLayoutEffect: diperbarui tepat setelah render, sebelum tombol berikutnya ditekan. Dengan
  // useEffect (yang di Preact baru jalan setelah frame berikutnya), panah kanan yang ditekan dua
  // kali dengan cepat hanya maju 5 detik.
  const latest = React.useRef(state)
  React.useLayoutEffect(() => {
    latest.current = state
  })

  const song = SONGS[state.index]

  React.useEffect(() => {
    if (audioRef.current) audioRef.current.volume = state.volume
  }, [state.volume])

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (state.playing) audio.play().catch(() => {})
    else audio.pause()
  }, [state.playing, state.index])

  const togglePlay = () => setState((s) => ({ ...s, playing: !s.playing }))

  const seek = React.useCallback((time: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = time
    setState((s) => ({ ...s, progress: time }))
  }, [])

  const restart = () => {
    if (audioRef.current) audioRef.current.currentTime = 0
    setState((s) => ({ ...s, progress: 0 }))
  }

  const goTo = (index: number, playing?: boolean) => {
    if (index === state.index) return
    history.current = [...history.current.slice(-49), state.index]
    setState((s) => ({ ...s, index, progress: 0, playing: playing ?? s.playing }))
  }

  const next = () => {
    const index = nextIndex(state)
    if (index === state.index) restart()
    else goTo(index)
  }

  const prev = () => {
    // Seperti player pada umumnya: lewat dari 3 detik, "previous" mengulang lagu yang sedang diputar.
    if (state.progress > 3) return restart()
    const index = history.current.pop() ?? (state.index - 1 + SONGS.length) % SONGS.length
    if (index === state.index) return restart()
    setState((s) => ({ ...s, index, progress: 0 }))
  }

  // Repeat on: atribut loop di <audio> mengulang lagu dan "ended" tidak pernah terjadi.
  // Repeat off tanpa lagu lain (satu lagu): diputar sekali, lalu berhenti dan kembali ke awal.
  const onEnded = () => {
    const index = nextIndex(state)
    if (index === state.index) {
      restart()
      setState((s) => ({ ...s, playing: false }))
    } else {
      goTo(index, true)
    }
  }

  // Spasi: play/pause. Panah kiri/kanan: mundur/maju 5 detik. Diabaikan saat mengetik atau di tombol.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))) return
      const { progress, duration } = latest.current
      if (e.code === "Space") {
        e.preventDefault()
        setState((s) => ({ ...s, playing: !s.playing }))
      } else if (e.code === "ArrowRight") {
        seek(Math.min(progress + 5, duration))
      } else if (e.code === "ArrowLeft") {
        seek(Math.max(progress - 5, 0))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [seek])

  const percent = state.duration > 0 ? Math.min(100, (state.progress / state.duration) * 100) : 0

  return (
    <Card className="overflow-hidden card-shadow">
      <CardHeader className="flex flex-col gap-4">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <div className="space-y-4">
            {/* Piringan hitam (.vinyl) keluar dari balik sampul dan berputar saat lagu diputar. */}
            <div className="relative">
              <span aria-hidden className="vinyl" data-playing={state.playing} />
              <div className={`relative z-10 aspect-square overflow-hidden rounded-md border border-border bg-muted ${state.playing ? "animate-wobble-soft shadow-lg" : ""}`}>
                <img src={song.albumArt} alt="current album art" className="h-full w-full object-cover" />
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
                    {song.lyric?.trim() ? `“${song.lyric}”` : "Speak your mind, and let the music play."}
                  </p>
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <div className="hidden md:flex items-end gap-1" aria-hidden>
                    {[0, 100, 200, 300, 400].map((delay) => (
                      <span key={delay} className="eq-bar">
                        <span className={state.playing ? "animate-eq" : undefined} style={{ animationDelay: `${delay}ms` }} />
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <ScrollingText text={song.title} className="max-w-[260px] md:max-w-[420px] text-2xl md:text-3xl font-black" />
                    <ScrollingText text={song.artist} className="max-w-[260px] md:max-w-[420px] text-base md:text-lg text-muted-foreground" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {!minimal && <span className="w-10 text-xs tabular-nums">{formatTime(state.progress)}</span>}
          {/* Bagian yang sudah diputar memakai gradasi sampul album (.seek-fill di index.css). */}
          <Slider
            min={0}
            max={Math.max(state.duration, 0.00001)}
            step={0.1}
            value={state.progress}
            onChange={(e) => seek(Number(e.currentTarget.value))}
            aria-label="Seek"
            className="seek-fill"
            style={{ "--p": `${percent}%` } as React.CSSProperties}
          />
          {!minimal && <span className="w-10 text-xs tabular-nums text-right">{formatTime(state.duration)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            {SINGLE_TRACK ? (
              <ShuffleHint />
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className={toggleClass(state.shuffle)}
                onClick={() => setState((s) => ({ ...s, shuffle: !s.shuffle }))}
                aria-pressed={state.shuffle}
                aria-label="Shuffle"
                title={state.shuffle ? "Shuffle: on" : "Shuffle: off"}
              >
                <Shuffle className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={prev} aria-label="Previous">
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button variant="secondary" size="icon" onClick={togglePlay} aria-label={state.playing ? "Pause" : "Play"}>
              {state.playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={next} aria-label="Next">
              <SkipForward className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={toggleClass(state.repeat)}
              onClick={() => setState((s) => ({ ...s, repeat: !s.repeat }))}
              aria-pressed={state.repeat}
              aria-label="Repeat"
              title={state.repeat ? "Repeat this song: on" : "Repeat this song: off"}
            >
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
                  onChange={(e) => {
                    const volume = Number(e.currentTarget.value)
                    setState((s) => ({ ...s, volume }))
                  }}
                  aria-label="Volume"
                  className="h-2 w-full min-w-10 max-w-28 cursor-pointer rounded-full bg-muted"
                />
              </>
            )}
          </div>
        </div>
        <audio
          ref={audioRef}
          src={song.src}
          onTimeUpdate={(e) => {
            const audio = e.currentTarget
            setState((s) => ({ ...s, progress: audio.currentTime, duration: audio.duration || 0 }))
          }}
          onEnded={onEnded}
          loop={state.repeat}
          preload="none"
        />
      </CardContent>
    </Card>
  )
}
