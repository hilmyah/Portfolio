import * as React from "react"
import { TERMINAL_COMMANDS } from "@/data"
import { cn } from "@/lib/utils"
import {
  PROMPT_HOST,
  PROMPT_USER,
  WELCOME_LINES,
  complete,
  runCommand,
} from "@/lib/terminal"
import type { TerminalLine, Tone } from "@/lib/terminal"

type Entry = {
  id: number
  input?: string
  lines: TerminalLine[]
}

const toneClass: Record<Tone, string> = {
  default: "text-neutral-200",
  muted: "text-neutral-500",
  accent: "text-amber-300",
  success: "text-emerald-300",
  error: "text-rose-300",
}

const QUICK_COMMANDS = TERMINAL_COMMANDS.map((c) => c.command).filter((c) => c !== "project")

function Prompt() {
  return (
    <span className="shrink-0 select-none">
      <span className="text-emerald-300">{PROMPT_USER}@{PROMPT_HOST}</span>
      <span className="text-neutral-500">:</span>
      <span className="text-sky-300">~</span>
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

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries])

  const execute = React.useCallback((raw: string) => {
    const input = raw.trim()
    const result = runCommand(input)
    const id = nextId.current++
    setEntries((prev) => (result.clear ? [] : [...prev, { id, input: raw, lines: result.lines }]))
    if (input) setHistory((prev) => (prev[prev.length - 1] === input ? prev : [...prev, input]))
    setHistoryIndex(null)
    draft.current = ""
    setValue("")
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
          { id, input: value, lines: [{ text: result.candidates.join("  "), tone: "muted" }] },
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
    const selection = window.getSelection()
    if (selection && selection.toString().length > 0) return
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <section id="terminal" className="relative mx-auto max-w-6xl scroll-mt-32 px-4 py-16">
      <h2 className="font-black text-2xl md:text-3xl mb-2 underline-scribble inline-block">Terminal</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        The same portfolio, through a shell. Type a command or pick one below.
      </p>

      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute -left-2 -top-2 z-10 h-5 w-14 -rotate-6 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
        <span aria-hidden className="pointer-events-none absolute -right-2 -top-2 z-10 h-5 w-14 rotate-6 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />

        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 card-shadow">
          <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4 py-2.5">
            <span aria-hidden className="h-3 w-3 rounded-full bg-rose-400/80" />
            <span aria-hidden className="h-3 w-3 rounded-full bg-amber-300/80" />
            <span aria-hidden className="h-3 w-3 rounded-full bg-emerald-400/80" />
            <span className="ml-2 truncate font-mono text-xs text-neutral-400">
              {PROMPT_USER}@{PROMPT_HOST}: ~
            </span>
          </div>

          <div
            ref={scrollRef}
            onClick={focusInput}
            className="h-[26rem] cursor-text overflow-y-auto px-4 py-3 font-mono text-[13px] leading-[1.5] md:text-sm"
          >
            <div role="log" aria-live="polite" aria-label="Terminal output">
              {entries.map((entry) => (
                <div key={entry.id} className="mb-2">
                  {entry.input !== undefined && (
                    <div className="flex gap-2">
                      <Prompt />
                      <span className="whitespace-pre-wrap break-all text-neutral-100">{entry.input}</span>
                    </div>
                  )}
                  {entry.lines.map((line, i) => (
                    <OutputLine key={i} line={line} />
                  ))}
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2">
              <Prompt />
              <span className="sr-only">Terminal command</span>
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  setHistoryIndex(null)
                }}
                onKeyDown={onKeyDown}
                className="min-w-0 flex-1 bg-transparent text-neutral-100 caret-amber-300 outline-none placeholder:text-neutral-600"
                placeholder="help"
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                enterKeyHint="send"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_COMMANDS.map((command) => (
          <button
            key={command}
            type="button"
            onClick={() => execute(command)}
            className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-xs transition-transform hover:-translate-y-0.5 hover:bg-accent/60 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {command}
          </button>
        ))}
      </div>
    </section>
  )
}
