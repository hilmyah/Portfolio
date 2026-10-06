import {
  ABOUT,
  PROFILE,
  PROJECTS,
  PROJECT_TAGS,
  SOCIALS,
  TERMINAL_COMMANDS,
  TOOLS,
} from "@/data"
import type { Project } from "@/data"

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

type Handler = (args: string[]) => TerminalResult

const handlers: Record<string, Handler> = {
  help: () => {
    const width = Math.max(...TERMINAL_COMMANDS.map((c) => c.command.length)) + 2
    return {
      lines: [
        line("Available commands:", "accent"),
        ...TERMINAL_COMMANDS.map((c) => line(`  ${pad(c.command, width)}${c.description}`)),
        blank(),
        line("Usage: project <id|name>    projects [tag]", "muted"),
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

export function runCommand(input: string): TerminalResult {
  const trimmed = input.trim()
  if (!trimmed) return { lines: [] }
  const [rawName, ...args] = trimmed.split(/\s+/)
  const name = rawName.toLowerCase()
  const handler = Object.prototype.hasOwnProperty.call(handlers, name) ? handlers[name] : undefined
  if (!handler) {
    return {
      lines: [
        line(`${rawName}: command not found`, "error"),
        line("Type 'help' to list commands.", "muted"),
      ],
    }
  }
  return handler(args)
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
  if (command === "project") pool = PROJECTS.map(projectSlug)
  else if (command === "projects") pool = PROJECT_TAGS
  const matches = pool.filter((v) => v.startsWith(partial))
  if (matches.length === 0) return { value: input, candidates: [] }
  if (matches.length === 1) return { value: `${command} ${matches[0]}`, candidates: [] }
  return { value: `${command} ${commonPrefix(matches)}`, candidates: matches }
}
