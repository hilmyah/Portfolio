import {
  ABOUT,
  PROFILE,
  PROJECTS,
  PROJECT_TAGS,
  SITE_DOMAIN,
  SOCIALS,
  TERMINAL_COMMANDS,
  TOOLS,
} from "@/data"
import type { Project } from "@/data"
import { REMOTE_COMMANDS, networkCommand } from "@/lib/netCommands"
import { applyFilter, isFilter, parsePipeline } from "@/lib/pipeline"
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

export const PROMPT_USER = "visitor"
export const PROMPT_HOST = "hilmyah"

export const WELCOME_LINES: TerminalLine[] = [
  { text: `${PROFILE.name} - ${PROFILE.role}`, tone: "accent" },
  { text: "Type 'help' to list commands. Tab completes, Up/Down walks history.", tone: "muted" },
]

const line = (text: string, tone?: Tone, href?: string): TerminalLine => ({ text, tone, href })
const blank = (): TerminalLine => ({ text: "" })

export function projectSlug(project: Project): string {
  return project.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function findProject(query: string): Project | undefined {
  const q = query.toLowerCase().trim()
  if (!q) return undefined
  return (
    PROJECTS.find((p) => p.id === q) ??
    PROJECTS.find((p) => projectSlug(p) === q) ??
    PROJECTS.find((p) => p.name.toLowerCase() === q) ??
    PROJECTS.find((p) => projectSlug(p).startsWith(q.replace(/\s+/g, "-")))
  )
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length)
}

function socialLines(): TerminalLine[] {
  const out: TerminalLine[] = []
  if (SOCIALS.github) out.push(line(`${pad("github", 10)} ${SOCIALS.github}`, "default", SOCIALS.github))
  if (SOCIALS.linkedin) out.push(line(`${pad("linkedin", 10)} ${SOCIALS.linkedin}`, "default", SOCIALS.linkedin))
  if (SOCIALS.instagram) out.push(line(`${pad("instagram", 10)} ${SOCIALS.instagram}`, "default", SOCIALS.instagram))
  return out
}

/** Passed to every command. Long-running commands print progress and stop when the signal aborts. */
export type CommandContext = {
  print: (lines: TerminalLine[]) => void
  signal: AbortSignal
}

type Handler = (args: string[], ctx: CommandContext) => TerminalResult | Promise<TerminalResult>

const handlers: Record<string, Handler> = {
  help: () => {
    const width = Math.max(...TERMINAL_COMMANDS.map((c) => c.command.length)) + 2
    return {
      lines: [
        line("Available commands:", "accent"),
        ...TERMINAL_COMMANDS.map((c) => line(`  ${pad(c.command, width)}${c.description}`)),
        blank(),
        line("Arguments:", "muted"),
        line("  projects [tag]", "muted"),
        line("  project <id|name>", "muted"),
        line("  open <id|name>", "muted"),
        line("  theme [dark|light]", "muted"),
        blank(),
        line("Network tools run on the server with their usual flags:", "muted"),
        line("  ping -c 3 github.com", "muted"),
        line("  dig -x 1.1.1.1 @8.8.8.8 +short", "muted"),
        line("  whois hilmyah.my.id | grep -i \"name server\"", "muted"),
        line("  nslookup -type=MX hilmyah.my.id      host -t NS hilmyah.my.id", "muted"),
        line("  traceroute -m 15 1.1.1.1", "muted"),
        blank(),
        line("Pipes: any command | grep, head, tail, sort, uniq, wc", "muted"),
        line("Ctrl+C stops a running command, Ctrl+L clears the screen.", "muted"),
      ],
    }
  },

  about: () => ({
    lines: [
      line(PROFILE.name, "accent"),
      line(`${PROFILE.role} | ${PROFILE.tagline}`, "muted"),
      blank(),
      line(ABOUT.bio),
      blank(),
      line(ABOUT.motto, "muted"),
    ],
  }),

  projects: (args) => {
    const tag = args[0]?.toLowerCase()
    const list = tag ? PROJECTS.filter((p) => p.tags.includes(tag)) : PROJECTS
    if (tag && list.length === 0) {
      return {
        lines: [
          line(`projects: no project tagged '${tag}'`, "error"),
          line(`Known tags: ${PROJECT_TAGS.join(", ")}`, "muted"),
        ],
      }
    }
    if (list.length === 0) return { lines: [line("No projects listed yet.", "muted")] }
    const width = Math.max(...list.map((p) => projectSlug(p).length)) + 2
    return {
      lines: [
        line(tag ? `Projects tagged '${tag}':` : "Projects:", "accent"),
        ...list.map((p) => line(`  ${pad(p.id, 3)}${pad(projectSlug(p), width)}${p.tags.join(", ")}`)),
        blank(),
        line("Run 'project <id|name>' for details.", "muted"),
      ],
    }
  },

  project: (args) => {
    const query = args.join(" ")
    if (!query) {
      return {
        lines: [
          line("usage: project <id|name>", "error"),
          line(`Try: project ${PROJECTS[0] ? projectSlug(PROJECTS[0]) : "<name>"}`, "muted"),
        ],
      }
    }
    const p = findProject(query)
    if (!p) {
      return {
        lines: [
          line(`project: '${query}' not found`, "error"),
          line("Run 'projects' to see the list.", "muted"),
        ],
      }
    }
    const out: TerminalLine[] = [line(p.name, "accent")]
    if (p.role) out.push(line(`${pad("role", 8)}${p.role}`))
    if (p.status) out.push(line(`${pad("status", 8)}${p.status}`, "success"))
    out.push(line(`${pad("tech", 8)}${p.tech.join(", ")}`))
    out.push(line(`${pad("tags", 8)}${p.tags.join(", ")}`))
    out.push(blank())
    out.push(line(p.description))
    if (p.repo || p.demo) out.push(blank())
    if (p.repo) out.push(line(`${pad("repo", 8)}${p.repo}`, "default", p.repo))
    if (p.demo) out.push(line(`${pad("demo", 8)}${p.demo}`, "default", p.demo))
    return { lines: out }
  },

  skills: () => {
    const names = TOOLS.map((t) => t.name)
    const rows: TerminalLine[] = []
    for (let i = 0; i < names.length; i += 3) {
      rows.push(line("  " + names.slice(i, i + 3).map((n) => pad(n, 14)).join("").trimEnd()))
    }
    return { lines: [line("Tools and technologies:", "accent"), ...rows] }
  },

  contact: () => {
    const out: TerminalLine[] = [line("Contact:", "accent")]
    if (SOCIALS.email) out.push(line(`${pad("email", 10)} ${SOCIALS.email}`, "default", `mailto:${SOCIALS.email}`))
    out.push(...socialLines())
    return { lines: out }
  },

  open: (args) => {
    const query = args.join(" ")
    if (!query) {
      return {
        lines: [
          line("usage: open <id|name>", "error"),
          line(`Try: open ${PROJECTS[0] ? projectSlug(PROJECTS[0]) : "<name>"}`, "muted"),
        ],
      }
    }
    const p = findProject(query)
    if (!p) {
      return {
        lines: [
          line(`open: '${query}' not found`, "error"),
          line("Run 'projects' to see the list.", "muted"),
        ],
      }
    }
    const url = p.repo ?? p.demo
    if (!url) return { lines: [line(`open: ${p.name} has no repository or demo link`, "error")] }
    window.open(url, "_blank", "noopener,noreferrer")
    return {
      lines: [
        line(`Opening ${p.name} in a new tab...`, "success"),
        line(url, "default", url),
      ],
    }
  },

  theme: (args) => {
    const arg = args[0]?.toLowerCase()
    if (arg && arg !== "dark" && arg !== "light" && arg !== "toggle") {
      return { lines: [line("usage: theme [dark|light]", "error")] }
    }
    const next: Theme =
      arg === "dark" || arg === "light" ? arg : getTheme() === "dark" ? "light" : "dark"
    setTheme(next)
    return { lines: [line(`Theme set to ${next}.`, "success")] }
  },

  ...Object.fromEntries(REMOTE_COMMANDS.map((cmd) => [cmd, networkCommand(cmd)])),

  clear: () => ({ lines: [], clear: true }),

  neofetch: () => {
    const github = SOCIALS.github?.replace(/^https?:\/\//, "")
    const title = `${PROMPT_USER}@${PROMPT_HOST}`
    const out: TerminalLine[] = [
      line(title, "accent"),
      line("-".repeat(title.length), "muted"),
      line(`${pad("name", 10)}${PROFILE.name}`),
      line(`${pad("role", 10)}${PROFILE.role}`),
      line(`${pad("focus", 10)}${PROFILE.tagline}`),
      line(`${pad("projects", 10)}${PROJECTS.length}`),
      line(`${pad("tools", 10)}${TOOLS.length}`),
    ]
    if (github) out.push(line(`${pad("github", 10)}${github}`, "default", SOCIALS.github))
    return { lines: out }
  },
}

function dispatch(argv: string[], ctx: CommandContext): TerminalResult | Promise<TerminalResult> {
  const [rawName, ...args] = argv
  const name = rawName.toLowerCase()
  const handler = Object.prototype.hasOwnProperty.call(handlers, name) ? handlers[name] : undefined
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
  const parsed = parsePipeline(input)
  if ("error" in parsed) return { lines: [line(parsed.error, "error")] }

  const [command, ...filters] = parsed.stages
  if (filters.length === 0) return dispatch(command, ctx)

  const unknown = filters.find((stage) => !isFilter(stage[0].toLowerCase()))
  if (unknown) {
    return { lines: [line(`${unknown[0]}: not available after a pipe (use grep, head, tail, sort, uniq or wc)`, "error")] }
  }

  // With filters, the command's output is collected first and shown only after the last filter.
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
  const partial = parts.slice(1).join(" ").toLowerCase()
  let pool: string[] = []
  if (command === "project" || command === "open") pool = PROJECTS.map(projectSlug)
  else if (command === "theme") pool = ["dark", "light"]
  else if ((REMOTE_COMMANDS as readonly string[]).includes(command)) pool = [SITE_DOMAIN]
  else if (command === "projects") pool = PROJECT_TAGS
  const matches = pool.filter((v) => v.startsWith(partial))
  if (matches.length === 0) return { value: input, candidates: [] }
  if (matches.length === 1) return { value: `${command} ${matches[0]}`, candidates: [] }
  return { value: `${command} ${commonPrefix(matches)}`, candidates: matches }
}
