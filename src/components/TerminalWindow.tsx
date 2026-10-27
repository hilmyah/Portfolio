import * as React from "react"
import { SITE_DOMAIN } from "@/data"
import { PROMPT_HOST, PROMPT_USER, WELCOME_LINES, complete, getPromptPath, runCommand } from "@/lib/terminal"
import type { TerminalLine, Tone } from "@/lib/terminal"
import { prefersReducedMotion } from "@/lib/theme"
import { cn } from "@/lib/utils"

type Entry = {
  id: number
  input?: string
  /** Direktori yang tampil di prompt entri ini, sesuai saat perintahnya dijalankan. */
  path?: string
  lines: TerminalLine[]
}

const TONE_CLASS: Record<Tone, string> = {
  default: "text-neutral-200",
  muted: "text-neutral-500",
  accent: "text-amber-300",
  success: "text-emerald-300",
  error: "text-rose-300",
}

// Beberapa titik awal saja. Sisanya bisa ditemukan lewat `help`, jadi menambah perintah tidak
// membuat baris ini makin panjang.
const SUGGESTIONS = ["help", "clear", "fetch", "ls", `whois ${SITE_DOMAIN}`]

// closed: belum terlihat di layar. opening: jendela terbuka. typing: perintah pembuka mengetik sendiri.
type Phase = "closed" | "opening" | "typing" | "ready"

const INTRO_COMMAND = "fetch"
const OPEN_DURATION_MS = 1050
const TYPE_INTERVAL_MS = 85

function Prompt({ path }: { path: string }) {
  return (
    <span className="shrink-0 select-none">
      <span className="text-emerald-300">{PROMPT_USER}@{PROMPT_HOST}</span>
      <span className="text-neutral-500">:</span>
      <span className="text-sky-300">{path}</span>
      <span className="text-neutral-500">$</span>
    </span>
  )
}

function OutputLine({ line }: { line: TerminalLine }) {
  const className = cn("whitespace-pre-wrap break-words", TONE_CLASS[line.tone ?? "default"])
  if (!line.text) return <div className="h-[1.5em]" aria-hidden />
  if (!line.href) return <div className={className}>{line.text}</div>
  const external = !line.href.startsWith("mailto:")
  return (
    <div className={className}>
      <a
        href={line.href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className="underline decoration-neutral-600 underline-offset-4 hover:text-teal-300 hover:decoration-teal-300 focus-visible:outline-none focus-visible:text-teal-300"
      >
        {line.text}
      </a>
    </div>
  )
}

export function TerminalWindow() {
  const [entries, setEntries] = React.useState<Entry[]>([{ id: 0, lines: WELCOME_LINES }])
  const [value, setValue] = React.useState("")
  const [history, setHistory] = React.useState<string[]>([])
  const [historyIndex, setHistoryIndex] = React.useState<number | null>(null)
  const [phase, setPhase] = React.useState<Phase>("closed")
  const [typed, setTyped] = React.useState("")
  // busy: perintah async (dig, whois, ping) sedang berjalan; running menyimpan pembatalnya.
  const [busy, setBusy] = React.useState(false)
  const running = React.useRef<AbortController | null>(null)
  const nextId = React.useRef(1)
  const draft = React.useRef("")
  const introDone = React.useRef(false)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const windowRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => () => running.current?.abort(), [])

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries])

  const addEntry = (entry: Omit<Entry, "id">) => {
    const id = nextId.current++
    setEntries((prev) => [...prev, { id, ...entry }])
    return id
  }

  const execute = React.useCallback((raw: string, record = true) => {
    if (running.current) return
    const input = raw.trim()
    const id = nextId.current++
    const controller = new AbortController()
    const print = (lines: TerminalLine[]) => {
      if (lines.length === 0) return
      setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, lines: [...entry.lines, ...lines] } : entry)))
    }

    // Entri ditambahkan lebih dulu, supaya perintah bisa mencetak progres sebelum selesai.
    // Path dibaca sekarang, sebelum perintah seperti cd mengubahnya.
    const path = getPromptPath()
    setEntries((prev) => [...prev, { id, input: raw, path, lines: [] }])
    if (input && record) setHistory((prev) => (prev[prev.length - 1] === input ? prev : [...prev, input]))
    setHistoryIndex(null)
    draft.current = ""
    setValue("")

    const result = runCommand(input, { print, signal: controller.signal })
    if (!(result instanceof Promise)) {
      if (result.clear) setEntries([])
      else print(result.lines)
      return
    }

    running.current = controller
    setBusy(true)
    result
      .then((done) => print(done.lines))
      .catch(() => print([{ text: "Command failed unexpectedly.", tone: "error" }]))
      .finally(() => {
        running.current = null
        setBusy(false)
      })
  }, [])

  // Jendela terbuka saat pertama kali terlihat di layar.
  React.useEffect(() => {
    const el = windowRef.current
    if (!el) return
    const start = () => {
      if (introDone.current) return
      if (prefersReducedMotion()) {
        introDone.current = true
        execute(INTRO_COMMAND, false)
        setPhase("ready")
        return
      }
      setPhase((current) => (current === "closed" ? "opening" : current))
    }
    if (!("IntersectionObserver" in window)) {
      start()
      return
    }
    const observer = new IntersectionObserver(
      (observed) => {
        if (observed.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          start()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [execute])

  // Setelah jendela terbuka, perintah pembuka diketik huruf demi huruf lalu dijalankan.
  React.useEffect(() => {
    if (phase === "opening") {
      const timer = window.setTimeout(() => setPhase("typing"), OPEN_DURATION_MS)
      return () => window.clearTimeout(timer)
    }
    if (phase !== "typing") return
    let index = 0
    let finish: number | undefined
    const interval = window.setInterval(() => {
      index += 1
      setTyped(INTRO_COMMAND.slice(0, index))
      if (index < INTRO_COMMAND.length) return
      window.clearInterval(interval)
      finish = window.setTimeout(() => {
        if (introDone.current) return
        introDone.current = true
        setTyped("")
        execute(INTRO_COMMAND, false)
        setPhase("ready")
      }, 320)
    }, TYPE_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(finish)
    }
  }, [phase, execute])

  const ready = phase === "ready"

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key.toLowerCase()
    if (e.ctrlKey && key === "c") {
      // Ada teks yang diseleksi: biarkan browser menyalinnya.
      if (window.getSelection()?.toString()) return
      e.preventDefault()
      if (running.current) {
        running.current.abort()
      } else if (value) {
        addEntry({ input: `${value}^C`, path: getPromptPath(), lines: [] })
        setValue("")
        setHistoryIndex(null)
      }
      return
    }
    if (busy) {
      if (e.key !== "Tab") e.preventDefault()
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      execute(value)
    } else if (e.key === "Tab") {
      if (!value.trim()) return
      e.preventDefault()
      const result = complete(value)
      setValue(result.value)
      if (result.candidates.length > 1) {
        addEntry({ input: value, path: getPromptPath(), lines: [{ text: result.candidates.join("  "), tone: "muted" }] })
      }
    } else if (e.key === "ArrowUp") {
      if (history.length === 0) return
      e.preventDefault()
      if (historyIndex === null) draft.current = value
      const index = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(index)
      setValue(history[index])
    } else if (e.key === "ArrowDown") {
      if (historyIndex === null) return
      e.preventDefault()
      const index = historyIndex + 1
      setHistoryIndex(index >= history.length ? null : index)
      setValue(index >= history.length ? draft.current : history[index])
    } else if (e.ctrlKey && key === "l") {
      e.preventDefault()
      setEntries([])
    }
  }

  const focusInput = () => {
    if (!ready || window.getSelection()?.toString()) return
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    // min-height menyediakan ukuran saat terbuka (body 26rem + dua bar 40px + border 2px), jadi isi di bawahnya tidak bergeser
    <div ref={windowRef} className="terminal-window relative min-h-[calc(26rem+82px)]" data-open={phase !== "closed"}>
      <span aria-hidden className="pointer-events-none absolute -left-2 -top-2 z-10 h-5 w-14 -rotate-6 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
      <span aria-hidden className="pointer-events-none absolute -right-2 -top-2 z-10 h-5 w-14 rotate-6 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />

      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 card-shadow">
        <div className="flex h-10 items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4">
          <span aria-hidden className="h-3 w-3 rounded-full bg-rose-400/80" />
          <span aria-hidden className="h-3 w-3 rounded-full bg-amber-300/80" />
          <span aria-hidden className="h-3 w-3 rounded-full bg-emerald-400/80" />
          <span className="ml-2 truncate font-mono text-xs text-neutral-400">
            {PROMPT_USER}@{PROMPT_HOST}: {getPromptPath()}
          </span>
        </div>

        <div className="terminal-body">
          <div>
            <span aria-hidden className="terminal-sweep" />
            <span aria-hidden className="terminal-crt" />
            <div
              ref={scrollRef}
              onClick={focusInput}
              className="terminal-glow h-[26rem] cursor-text overflow-y-auto px-4 py-3 font-mono text-[13px] leading-[1.5] md:text-sm"
            >
              <div role="log" aria-live="polite" aria-label="Terminal output">
                {entries.map((entry) => (
                  <div key={entry.id} className="mb-2">
                    {entry.input !== undefined && (
                      <div className="flex gap-2">
                        <Prompt path={entry.path ?? "~"} />
                        <span className="whitespace-pre-wrap break-all text-neutral-100">{entry.input}</span>
                      </div>
                    )}
                    {entry.lines.map((line, i) => (
                      <OutputLine key={i} line={line} />
                    ))}
                  </div>
                ))}
              </div>

              {!ready && (
                <div className="flex items-center gap-2" aria-hidden>
                  <Prompt path={getPromptPath()} />
                  <span className="text-neutral-100">
                    {typed}
                    <span className="terminal-cursor" />
                  </span>
                </div>
              )}
              <label className={cn("flex items-center gap-2", !ready && "hidden")}>
                {busy ? <span aria-hidden className="terminal-cursor" /> : <Prompt path={getPromptPath()} />}
                <span className="sr-only">Terminal command</span>
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value)
                    setHistoryIndex(null)
                  }}
                  onKeyDown={onKeyDown}
                  readOnly={busy}
                  className={cn(
                    "min-w-0 flex-1 bg-transparent text-neutral-100 outline-none placeholder:text-neutral-600",
                    busy ? "caret-transparent" : "caret-amber-300"
                  )}
                  placeholder={busy ? "" : "help"}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  enterKeyHint="send"
                />
              </label>
            </div>
            <div className="flex h-10 items-center gap-1.5 overflow-x-auto border-t border-neutral-800 bg-neutral-900 px-3 [scrollbar-width:none]">
              {busy ? (
                <button
                  type="button"
                  onClick={() => running.current?.abort()}
                  className="shrink-0 rounded px-2 py-0.5 font-mono text-xs text-rose-300 ring-1 ring-rose-400/40 transition-colors hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                >
                  ^C stop
                </button>
              ) : (
                <span className="shrink-0 pr-1 font-mono text-[11px] text-neutral-500">try</span>
              )}
              {SUGGESTIONS.map((command) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => execute(command)}
                  disabled={!ready || busy}
                  className="shrink-0 rounded px-2 py-0.5 font-mono text-xs text-neutral-300 ring-1 ring-neutral-700 transition-colors hover:bg-neutral-800 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-40"
                >
                  {command}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
