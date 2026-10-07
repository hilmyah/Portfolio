// Shell-like parsing for the terminal: quoting, pipes, and the text filters that can follow a pipe.
// Filters run in the browser on the lines a command produced. Nothing here executes anything.
import type { TerminalLine } from "@/lib/terminal"

export type Pipeline = { stages: string[][] } | { error: string }

/** Splits a command line into pipe stages of arguments, honouring single and double quotes. */
export function parsePipeline(input: string): Pipeline {
  const stages: string[][] = [[]]
  let current = ""
  let hasToken = false
  let quote: '"' | "'" | null = null

  const pushToken = () => {
    if (hasToken) stages[stages.length - 1].push(current)
    current = ""
    hasToken = false
  }

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quote) {
      if (ch === quote) quote = null
      else if (ch === "\\" && quote === '"' && i + 1 < input.length && '"\\'.includes(input[i + 1])) current += input[++i]
      else current += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      hasToken = true
    } else if (ch === "\\" && i + 1 < input.length) {
      current += input[++i]
      hasToken = true
    } else if (/\s/.test(ch)) {
      pushToken()
    } else if (ch === "|") {
      if (input[i + 1] === "|") return { error: "'||' is not supported here. Only pipes (|) into grep, head, tail, sort, uniq and wc." }
      pushToken()
      stages.push([])
    } else if (ch === ";" || ch === "&" || ch === ">" || ch === "<" || ch === "`" || (ch === "$" && input[i + 1] === "(")) {
      const shown = ch === "$" ? "$(" : ch === "&" && input[i + 1] === "&" ? "&&" : ch
      return { error: `'${shown}' is not supported here. This is not a full shell: one command, optionally piped (|) into filters.` }
    } else {
      current += ch
      hasToken = true
    }
  }
  if (quote) return { error: `unterminated ${quote} quote` }
  pushToken()
  if (stages.some((stage, index) => stage.length === 0 && (index > 0 || stages.length > 1))) {
    return { error: "syntax error near '|'" }
  }
  return { stages }
}

export const FILTER_NAMES = ["grep", "head", "tail", "sort", "uniq", "wc", "cat"] as const

export function isFilter(name: string): boolean {
  return (FILTER_NAMES as readonly string[]).includes(name)
}

type FilterResult = { lines: TerminalLine[] } | { error: string }

const plain = (text: string): TerminalLine => ({ text })

/** Splits "-iv" style flag clusters; returns the flags and the remaining operands. */
function splitFlags(args: string[], allowed: string, takesValue = ""): { flags: Set<string>; values: Map<string, string>; rest: string[] } | { error: string } {
  const flags = new Set<string>()
  const values = new Map<string, string>()
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--") {
      rest.push(...args.slice(i + 1))
      break
    }
    if (a.length > 1 && a.startsWith("-") && !/^-\d+$/.test(a)) {
      for (let j = 1; j < a.length; j++) {
        const flag = a[j]
        if (takesValue.includes(flag)) {
          const value = a.slice(j + 1) || args[++i]
          if (value === undefined) return { error: `option -${flag} needs a value` }
          values.set(flag, value)
          break
        }
        if (!allowed.includes(flag)) return { error: `option -${flag} is not supported` }
        flags.add(flag)
      }
    } else {
      rest.push(a)
    }
  }
  return { flags, values, rest }
}

function lineCount(args: string[], name: string): { count: number } | { error: string } {
  let count = 10
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    const raw = a === "-n" ? args[++i] : /^-n\d+$/.test(a) ? a.slice(2) : /^-\d+$/.test(a) ? a.slice(1) : null
    if (raw === null || raw === undefined) return { error: `${name}: usage: ${name} [-n count]` }
    count = Number(raw)
    if (!Number.isInteger(count) || count < 0) return { error: `${name}: invalid line count '${raw}'` }
  }
  return { count }
}

export function applyFilter(name: string, args: string[], input: TerminalLine[]): FilterResult {
  switch (name) {
    case "cat":
      return { lines: input }

    case "grep": {
      const parsed = splitFlags(args, "ivcnEFo")
      if ("error" in parsed) return { error: `grep: ${parsed.error}` }
      const { flags, rest } = parsed
      if (rest.length !== 1) return { error: "usage: grep [-i] [-v] [-c] [-n] [-F] <pattern>" }
      let regex: RegExp
      const escaped = rest[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      try {
        regex = new RegExp(flags.has("F") ? escaped : rest[0], flags.has("i") ? "i" : "")
      } catch {
        regex = new RegExp(escaped, flags.has("i") ? "i" : "")
      }
      const matched = input
        .map((l, index) => ({ l, index }))
        .filter(({ l }) => regex.test(l.text) !== flags.has("v"))
      if (flags.has("c")) return { lines: [plain(String(matched.length))] }
      return {
        lines: matched.map(({ l, index }) => {
          let text = l.text
          if (flags.has("o") && !flags.has("v")) text = l.text.match(regex)?.[0] ?? ""
          return { ...l, text: flags.has("n") ? `${index + 1}:${text}` : text }
        }),
      }
    }

    case "head":
    case "tail": {
      const parsed = lineCount(args, name)
      if ("error" in parsed) return { error: parsed.error }
      if (parsed.count === 0) return { lines: [] }
      return { lines: name === "head" ? input.slice(0, parsed.count) : input.slice(-parsed.count) }
    }

    case "sort": {
      const parsed = splitFlags(args, "run")
      if ("error" in parsed) return { error: `sort: ${parsed.error}` }
      if (parsed.rest.length) return { error: "usage: sort [-r] [-u] [-n]" }
      const { flags } = parsed
      let lines = [...input].sort((a, b) =>
        flags.has("n") ? (parseFloat(a.text) || 0) - (parseFloat(b.text) || 0) : a.text.localeCompare(b.text)
      )
      if (flags.has("r")) lines.reverse()
      if (flags.has("u")) lines = lines.filter((l, i) => i === 0 || l.text !== lines[i - 1].text)
      return { lines }
    }

    case "uniq": {
      const parsed = splitFlags(args, "c")
      if ("error" in parsed) return { error: `uniq: ${parsed.error}` }
      if (parsed.rest.length) return { error: "usage: uniq [-c]" }
      const groups: { line: TerminalLine; count: number }[] = []
      for (const l of input) {
        const last = groups[groups.length - 1]
        if (last && last.line.text === l.text) last.count += 1
        else groups.push({ line: l, count: 1 })
      }
      return {
        lines: groups.map(({ line, count }) => (parsed.flags.has("c") ? plain(`${String(count).padStart(7)} ${line.text}`) : line)),
      }
    }

    case "wc": {
      const parsed = splitFlags(args, "lwc")
      if ("error" in parsed) return { error: `wc: ${parsed.error}` }
      if (parsed.rest.length) return { error: "usage: wc [-l] [-w] [-c]" }
      const text = input.map((l) => l.text).join("\n")
      const counts = {
        l: input.length,
        w: text.split(/\s+/).filter(Boolean).length,
        c: text.length + (input.length ? 1 : 0),
      }
      const wanted = (["l", "w", "c"] as const).filter((k) => parsed.flags.size === 0 || parsed.flags.has(k))
      return { lines: [plain(wanted.map((k) => String(counts[k])).join(" "))] }
    }

    default:
      return { error: `${name}: not available as a filter (try ${FILTER_NAMES.join(", ")})` }
  }
}
