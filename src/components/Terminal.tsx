import * as React from "react"
import { SITE_DOMAIN } from "@/data"
import { cn } from "@/lib/utils"
import { prefersReducedMotion } from "@/lib/theme"
import { Reveal } from "@/components/Reveal"
import {
  PROMPT_HOST,
  PROMPT_USER,
  getPromptPath,
  WELCOME_LINES,
  complete,
  runCommand,
} from "@/lib/terminal"
import type { TerminalLine, Tone } from "@/lib/terminal"

type Entry = {
  id: number
  input?: string
  /** Directory shown in this entry's prompt, as it was when the command ran. */
  path?: string
  lines: TerminalLine[]
}

const toneClass: Record<Tone, string> = {
  default: "text-neutral-200",
  muted: "text-neutral-500",
  accent: "text-amber-300",
  success: "text-emerald-300",
  error: "text-rose-300",
}

// A short, fixed set of starting points. Everything else is discoverable through `help`,
// so adding commands does not grow this row.
const SUGGESTIONS = ["help", "clear", "fetch", "ls", `whois ${SITE_DOMAIN}`]

// closed: not yet scrolled into view. opening: window unrolls. typing: the intro command types itself.
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
  const className = cn("whitespace-pre-wrap break-words", toneClass[line.tone ?? "default"])
  if (!line.text) return <div className="h-[1.5em]" aria-hidden />
  if (line.href) {
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
  return <div className={className}>{line.text}</div>
}

export function Terminal() {
  const [entries, setEntries] = React.useState<Entry[]>([{ id: 0, lines: WELCOME_LINES }])
  const [value, setValue] = React.useState("")
  const [history, setHistory] = React.useState<string[]>([])
  const [historyIndex, setHistoryIndex] = React.useState<number | null>(null)
  const nextId = React.useRef(1)
  const draft = React.useRef("")
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const windowRef = React.useRef<HTMLDivElement | null>(null)
  const [phase, setPhase] = React.useState<Phase>("closed")
  const [typed, setTyped] = React.useState("")
  const introDone = React.useRef(false)
  // busy: an async command (dig, whois, ping) is running; running holds its abort handle.
  const [busy, setBusy] = React.useState(false)
  const running = React.useRef<AbortController | null>(null)

  React.useEffect(() => () => running.current?.abort(), [])

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries])

  const execute = React.useCallback((raw: string, record = true) => {
    if (running.current) return
    const input = raw.trim()
    const id = nextId.current++
    const controller = new AbortController()
    const print = (lines: TerminalLine[]) => {
      if (lines.length === 0) return
      setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, lines: [...entry.lines, ...lines] } : entry)))
    }

    // The entry is added first so a command can print progress before it finishes.
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

  // Open the window the first time it scrolls into view.
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
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          start()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [execute])

  // After the window has unrolled, type the intro command and run it.
  React.useEffect(() => {
    if (phase === "opening") {
      const timer = window.setTimeout(() => setPhase("typing"), OPEN_DURATION_MS)
      return () => window.clearTimeout(timer)
    }
    if (phase === "typing") {
      let index = 0
      let finish: number | undefined
      const interval = window.setInterval(() => {
        index += 1
        setTyped(INTRO_COMMAND.slice(0, index))
        if (index >= INTRO_COMMAND.length) {
          window.clearInterval(interval)
          finish = window.setTimeout(() => {
            if (introDone.current) return
            introDone.current = true
            setTyped("")
            execute(INTRO_COMMAND, false)
            setPhase("ready")
          }, 320)
        }
      }, TYPE_INTERVAL_MS)
      return () => {
        window.clearInterval(interval)
        if (finish) window.clearTimeout(finish)
      }
    }
  }, [phase, execute])

  const ready = phase === "ready"

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key.toLowerCase() === "c" && e.ctrlKey) {
      const selection = window.getSelection()
      if (selection && selection.toString().length > 0) return // let the browser copy
      e.preventDefault()
      if (running.current) {
        running.current.abort()
      } else if (value) {
        const id = nextId.current++
        setEntries((prev) => [...prev, { id, input: `${value}^C`, path: getPromptPath(), lines: [] }])
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
      return
    }
    if (e.key === "Tab") {
      if (!value.trim()) return
      e.preventDefault()
      const result = complete(value)
      setValue(result.value)
      if (result.candidates.length > 1) {
        const id = nextId.current++
        setEntries((prev) => [
          ...prev,
          { id, input: value, path: getPromptPath(), lines: [{ text: result.candidates.join("  "), tone: "muted" }] },
        ])
      }
      return
    }
    if (e.key === "ArrowUp") {
      if (history.length === 0) return
      e.preventDefault()
      if (historyIndex === null) draft.current = value
      const index = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(index)
      setValue(history[index])
      return
    }
    if (e.key === "ArrowDown") {
      if (historyIndex === null) return
      e.preventDefault()
      const index = historyIndex + 1
      if (index >= history.length) {
        setHistoryIndex(null)
        setValue(draft.current)
      } else {
        setHistoryIndex(index)
        setValue(history[index])
      }
      return
    }
    if (e.key.toLowerCase() === "l" && e.ctrlKey) {
      e.preventDefault()
      setEntries([])
    }
  }

  const focusInput = () => {
    if (!ready) return
    const selection = window.getSelection()
    if (selection && selection.toString().length > 0) return
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <section id="terminal" className="relative mx-auto max-w-6xl scroll-mt-32 px-4 py-16">
      <Reveal>
        <h2 className="font-black text-2xl md:text-3xl mb-2 underline-scribble inline-block">Terminal</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          The same portfolio, through a shell. Type a command, or start with help.
        </p>
      </Reveal>

      {/* min-height reserves the open size (26rem body + two 40px bars + 2px border) so nothing below shifts */}
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
          {/* polish: crt. Faint scanlines, vignette and phosphor glow over the screen. */}
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

    </section>
  )
}
