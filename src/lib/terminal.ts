// Mesin terminal: daftar perintah, pipe ke filter, dan tab completion. Tampilan ada di
// components/TerminalWindow.tsx; file ini tidak menyentuh DOM kecuali matchMedia.
import { PROFILE, SITE_DOMAIN, TERMINAL_COMMANDS } from "@/data"
import type { CommandGroup } from "@/data"
import { REMOTE_COMMANDS, myip, networkCommand } from "@/lib/netCommands"
import { applyFilter, isFilter, parsePipeline } from "@/lib/pipeline"
// bait: jawaban "nice try" untuk input bergaya serangan (lihat src/lib/baits.ts)
import { baitForCommand, baitForNetworkTarget, baitForPayload, niceTry } from "@/lib/baits"
import { getTheme, setTheme } from "@/lib/theme"
import type { Theme } from "@/lib/theme"

export type Tone = "default" | "muted" | "accent" | "success" | "error"

export type TerminalLine = {
  text: string
  tone?: Tone
  href?: string
}

export type TerminalResult = {
  lines: TerminalLine[]
  clear?: boolean
}

/** Diberikan ke setiap perintah. Perintah yang lama berjalan mencetak progres dan berhenti saat signal di-abort. */
export type CommandContext = {
  print: (lines: TerminalLine[]) => void
  signal: AbortSignal
}

type Handler = (args: string[], ctx: CommandContext) => TerminalResult | Promise<TerminalResult>

export const WELCOME_LINES: TerminalLine[] = [
  { text: `${PROFILE.name} - ${PROFILE.role}`, tone: "accent" },
]

const line = (text: string, tone?: Tone, href?: string): TerminalLine => ({ text, tone, href })
const blank = (): TerminalLine => ({ text: "" })
const pad = (value: string, width: number) => (value.length >= width ? value : value + " ".repeat(width - value.length))

const isRemote = (name: string) => (REMOTE_COMMANDS as readonly string[]).includes(name)

const HELP_GROUPS: CommandGroup[] = ["network", "shell"]

const handlers: Record<string, Handler> = {
  help: (args) => {
    if (args[0]) {
      const name = args[0].toLowerCase()
      const entry = TERMINAL_COMMANDS.find((c) => c.command === name)
      if (!entry) {
        const hint = isFilter(name) ? `'${name}' is a filter: use it after a pipe, e.g. whois ${SITE_DOMAIN} | ${name}` : "Type 'help' to list commands."
        return { lines: [line(`help: no such command '${args[0]}'`, "error"), line(hint, "muted")] }
      }
      const out: TerminalLine[] = [line(`${entry.command} - ${entry.description}`, "accent"), blank(), line(`usage: ${entry.usage ?? entry.command}`)]
      if (entry.examples?.length) out.push(blank(), line("examples:", "muted"), ...entry.examples.map((e) => line(`  ${e}`)))
      return { lines: out }
    }
    // Di layar sempit nama grup diberi baris sendiri supaya daftar perintahnya tidak terpotong di tengah.
    const narrow = window.matchMedia("(max-width: 640px)").matches
    return {
      lines: [
        line("Commands (help <command> shows usage and examples):", "accent"),
        blank(),
        ...HELP_GROUPS.flatMap((group) => {
          const names = TERMINAL_COMMANDS.filter((c) => c.group === group).map((c) => c.command).join("  ")
          return narrow ? [line(group, "muted"), line(`  ${names}`)] : [line(`  ${pad(group, 11)}${names}`)]
        }),
        blank(),
        line("Pipes: <command> | grep, head, tail, sort, uniq, wc", "muted"),
        line("Keys:  Tab completes, Up/Down history, Ctrl+C stops, Ctrl+L clears", "muted"),
      ],
    }
  },

  theme: (args) => {
    const arg = args[0]?.toLowerCase()
    if (arg && arg !== "dark" && arg !== "light" && arg !== "toggle") return { lines: [line("usage: theme [dark|light]", "error")] }
    const next: Theme = arg === "dark" || arg === "light" ? arg : getTheme() === "dark" ? "light" : "dark"
    setTheme(next)
    return { lines: [line(`Theme set to ${next}.`, "success")] }
  },

  ...Object.fromEntries(REMOTE_COMMANDS.map((cmd) => [cmd, networkCommand(cmd)])),
  myip,

  clear: () => ({ lines: [], clear: true }),
}

function dispatch(argv: string[], ctx: CommandContext): TerminalResult | Promise<TerminalResult> {
  const [rawName, ...args] = argv
  const name = rawName.toLowerCase()
  const handler = Object.prototype.hasOwnProperty.call(handlers, name) ? handlers[name] : undefined
  // bait: langkah pertama yang klasik (sudo, rm -rf, nmap, IP privat) dijawab "nice try"
  const bait = handler ? (isRemote(name) ? baitForNetworkTarget(args) : null) : baitForCommand(rawName, args)
  if (bait) return { lines: bait }
  if (!handler) {
    const hint = isFilter(name)
      ? `'${name}' works after a pipe, for example: whois ${SITE_DOMAIN} | ${name === "grep" ? "grep -i registrar" : name}`
      : "Type 'help' to list commands."
    return { lines: [line(`${rawName}: command not found`, "error"), line(hint, "muted")] }
  }
  return handler(args, ctx)
}

export function runCommand(input: string, ctx: CommandContext): TerminalResult | Promise<TerminalResult> {
  if (!input.trim()) return { lines: [] }
  const payload = baitForPayload(input) // bait:
  if (payload) return { lines: payload }
  const parsed = parsePipeline(input)
  if ("error" in parsed) return { lines: parsed.operator ? niceTry() : [line(parsed.error, "error")] } // bait:

  const [command, ...filters] = parsed.stages
  if (filters.length === 0) return dispatch(command, ctx)

  const unknown = filters.find((stage) => !isFilter(stage[0].toLowerCase()))
  const pipedBait = unknown && baitForCommand(unknown[0], unknown.slice(1)) // bait: "... | sh" dan sejenisnya
  if (pipedBait) return { lines: pipedBait }
  if (unknown) {
    return { lines: [line(`${unknown[0]}: not available after a pipe (use grep, head, tail, sort, uniq or wc)`, "error")] }
  }

  // Dengan filter, output perintah dikumpulkan dulu dan baru ditampilkan setelah filter terakhir.
  const collected: TerminalLine[] = []
  const finish = (result: TerminalResult): TerminalResult => {
    let lines = [...collected, ...result.lines]
    for (const [name, ...args] of filters) {
      const filtered = applyFilter(name.toLowerCase(), args, lines)
      if ("error" in filtered) return { lines: [line(filtered.error, "error")] }
      lines = filtered.lines
    }
    return { lines }
  }
  const result = dispatch(command, { print: (lines) => collected.push(...lines), signal: ctx.signal })
  return result instanceof Promise ? result.then(finish) : finish(result)
}

function commonPrefix(values: string[]): string {
  if (values.length === 0) return ""
  let prefix = values[0]
  for (const v of values.slice(1)) {
    while (!v.startsWith(prefix)) prefix = prefix.slice(0, -1)
  }
  return prefix
}

export type Completion = {
  value: string
  candidates: string[]
}

export function complete(input: string): Completion {
  const leading = input.replace(/^\s+/, "")
  const parts = leading.split(/\s+/)

  if (parts.length <= 1) {
    const partial = (parts[0] ?? "").toLowerCase()
    const matches = TERMINAL_COMMANDS.map((c) => c.command).filter((c) => c.startsWith(partial))
    if (matches.length === 0) return { value: input, candidates: [] }
    if (matches.length === 1) return { value: `${matches[0]} `, candidates: [] }
    return { value: commonPrefix(matches) || input, candidates: matches }
  }

  const command = parts[0].toLowerCase()
  let pool: string[] = []
  if (command === "help") pool = TERMINAL_COMMANDS.map((c) => c.command)
  else if (command === "theme") pool = ["dark", "light"]
  else if (isRemote(command)) pool = [SITE_DOMAIN]
  const partial = parts.slice(1).join(" ").toLowerCase()
  const matches = pool.filter((v) => v.startsWith(partial))
  if (matches.length === 0) return { value: input, candidates: [] }
  if (matches.length === 1) return { value: `${command} ${matches[0]}`, candidates: [] }
  return { value: `${command} ${commonPrefix(matches)}`, candidates: matches }
}
