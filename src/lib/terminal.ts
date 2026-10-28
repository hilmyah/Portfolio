// Mesin terminal: daftar perintah, pipe ke filter, dan tab completion. Tampilan ada di
// components/TerminalWindow.tsx; file ini tidak menyentuh DOM kecuali window.open dan matchMedia.
import { ABOUT, PROFILE, PROJECTS, PROJECT_TAGS, PROMPT_HOST, PROMPT_USER, SITE_DOMAIN, SOCIALS, TERMINAL_COMMANDS, TOOLS } from "@/data"
import type { CommandGroup, Project } from "@/data"
import { REMOTE_COMMANDS, myip, networkCommand } from "@/lib/netCommands"
import { applyFilter, isFilter, parsePipeline } from "@/lib/pipeline"
// bait: jawaban "nice try" untuk input bergaya serangan (lihat src/lib/baits.ts)
import { baitForCommand, baitForNetworkTarget, baitForOperator, baitForPath, baitForPayload } from "@/lib/baits"
import { getTheme, setTheme } from "@/lib/theme"
import type { Theme } from "@/lib/theme"
import { HOME, completePath, displayPath, listDir, lookupPath, projectSlug, resolvePath } from "@/lib/vfs"
import type { VfsNode } from "@/lib/vfs"

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
  { text: "Type 'help' to list commands. Tab completes, Up/Down walks history.", tone: "muted" },
]

const line = (text: string, tone?: Tone, href?: string): TerminalLine => ({ text, tone, href })
const blank = (): TerminalLine => ({ text: "" })
const pad = (value: string, width: number) => (value.length >= width ? value : value + " ".repeat(width - value.length))

// Direktori aktif. Hanya ada satu terminal per halaman, jadi cukup disimpan di level modul.
let cwd = HOME
export const getPromptPath = () => displayPath(cwd)

const isRemote = (name: string) => (REMOTE_COMMANDS as readonly string[]).includes(name)

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

const SOCIAL_LINKS: [label: string, url: string | undefined][] = [
  ["github", SOCIALS.github],
  ["linkedin", SOCIALS.linkedin],
  ["instagram", SOCIALS.instagram],
  ["facebook", SOCIALS.facebook],
]

/** Pesan usage dan "not found" yang sama untuk project dan open. */
function projectArgument(command: string, query: string): { project: Project } | { lines: TerminalLine[] } {
  if (!query) {
    return {
      lines: [
        line(`usage: ${command} <id|name>`, "error"),
        line(`Try: ${command} ${PROJECTS[0] ? projectSlug(PROJECTS[0]) : "<name>"}`, "muted"),
      ],
    }
  }
  const project = findProject(query)
  if (!project) return { lines: [line(`${command}: '${query}' not found`, "error"), line("Run 'projects' to see the list.", "muted")] }
  return { project }
}

const HELP_GROUPS: CommandGroup[] = ["portfolio", "files", "network", "shell"]

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
      if (isRemote(entry.command)) {
        out.push(blank(), line("Runs on the server that hosts this site. Private and LAN addresses are refused.", "muted"))
      }
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
      return { lines: [line(`projects: no project tagged '${tag}'`, "error"), line(`Known tags: ${PROJECT_TAGS.join(", ")}`, "muted")] }
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
    const found = projectArgument("project", args.join(" "))
    if ("lines" in found) return found
    const p = found.project
    const out: TerminalLine[] = [line(p.name, "accent")]
    if (p.role) out.push(line(`${pad("role", 8)}${p.role}`))
    if (p.status) out.push(line(`${pad("status", 8)}${p.status}`, "success"))
    out.push(line(`${pad("tech", 8)}${p.tech.join(", ")}`), line(`${pad("tags", 8)}${p.tags.join(", ")}`), blank(), line(p.description))
    if (p.repo || p.demo) out.push(blank())
    if (p.repo) out.push(line(`${pad("repo", 8)}${p.repo}`, "default", p.repo))
    if (p.demo) out.push(line(`${pad("demo", 8)}${p.demo}`, "default", p.demo))
    return { lines: out }
  },

  open: (args) => {
    const found = projectArgument("open", args.join(" "))
    if ("lines" in found) return found
    const p = found.project
    const url = p.repo ?? p.demo
    if (!url) return { lines: [line(`open: ${p.name} has no repository or demo link`, "error")] }
    window.open(url, "_blank", "noopener,noreferrer")
    return { lines: [line(`Opening ${p.name} in a new tab...`, "success"), line(url, "default", url)] }
  },

  tools: () => {
    const rows: TerminalLine[] = []
    for (let i = 0; i < TOOLS.length; i += 3) {
      rows.push(line("  " + TOOLS.slice(i, i + 3).map((t) => pad(t.name, 14)).join("").trimEnd()))
    }
    return { lines: [line("Tools and technologies:", "accent"), ...rows] }
  },

  contact: () => {
    const out: TerminalLine[] = [line("Contact:", "accent")]
    if (SOCIALS.email) out.push(line(`${pad("email", 10)} ${SOCIALS.email}`, "default", `mailto:${SOCIALS.email}`))
    for (const [label, url] of SOCIAL_LINKS) if (url) out.push(line(`${pad(label, 10)} ${url}`, "default", url))
    return { lines: out }
  },

  pwd: () => ({ lines: [line(cwd)] }),

  cd: (args) => {
    if (args.length > 1) return { lines: [line("cd: too many arguments", "error")] }
    const target = resolvePath(cwd, args[0] ?? "~")
    const node = lookupPath(target)
    if (!node) return { lines: baitForPath("cd", args[0], target) ?? [line(`cd: ${args[0]}: No such file or directory`, "error")] } // bait:
    if (node.kind !== "dir") return { lines: [line(`cd: ${args[0]}: Not a directory`, "error")] }
    cwd = target
    return { lines: [] }
  },

  ls: (args) => {
    const long = args.some((a) => /^-[a-z]*l/.test(a))
    const bad = args.find((a) => a.startsWith("-") && !/^-[la]+$/.test(a))
    if (bad) return { lines: [line(`ls: invalid option '${bad}' (supported: -l, -a)`, "error")] }
    const paths = args.filter((a) => !a.startsWith("-"))
    const out: TerminalLine[] = []
    for (const [index, p] of (paths.length ? paths : ["."]).entries()) {
      const node = lookupPath(resolvePath(cwd, p))
      if (!node) {
        out.push(...(baitForPath("ls", p, resolvePath(cwd, p)) ?? [line(`ls: cannot access '${p}': No such file or directory`, "error")])) // bait:
        continue
      }
      if (paths.length > 1) out.push(...(index ? [blank()] : []), line(`${p}:`, "muted"))
      if (node.kind === "file") {
        out.push(line(p))
        continue
      }
      const entries = listDir(node)
      const sizeOf = (n: VfsNode) => (n.kind === "file" ? n.content.length : 0)
      const width = Math.max(1, ...entries.map(({ node: n }) => String(sizeOf(n)).length))
      for (const { name, node: n } of entries) {
        const isDir = n.kind === "dir"
        const label = `${name}${isDir ? "/" : ""}`
        const text = long ? `${isDir ? "drwxr-xr-x" : "-rw-r--r--"}  ${String(sizeOf(n)).padStart(width)}  ${label}` : label
        out.push(line(text, isDir ? "accent" : undefined))
      }
    }
    return { lines: out }
  },

  cat: (args) => {
    if (args.length === 0) return { lines: [line("usage: cat <file>...  (try: ls, then cat about.md)", "error")] }
    const out: TerminalLine[] = []
    for (const p of args) {
      const node = lookupPath(resolvePath(cwd, p))
      if (!node) out.push(...(baitForPath("cat", p, resolvePath(cwd, p)) ?? [line(`cat: ${p}: No such file or directory`, "error")])) // bait:
      else if (node.kind === "dir") out.push(line(`cat: ${p}: Is a directory`, "error"))
      else {
        // Judul markdown disorot, kutipan diredupkan, dan URL pertama di baris jadi link.
        for (const text of node.content.replace(/\n$/, "").split("\n")) {
          const url = text.match(/https?:\/\/\S+/)?.[0]
          out.push(line(text, text.startsWith("#") ? "accent" : text.startsWith(">") ? "muted" : undefined, url))
        }
      }
    }
    return { lines: out }
  },

  tree: (args) => {
    const start = resolvePath(cwd, args[0] ?? ".")
    const root = lookupPath(start)
    if (!root) return { lines: [line(`tree: ${args[0]}: No such file or directory`, "error")] }
    if (root.kind !== "dir") return { lines: [line(args[0] ?? start)] }
    const out: TerminalLine[] = [line(args[0] ?? ".", "accent")]
    let dirs = 0
    let files = 0
    const walk = (node: typeof root, prefix: string) => {
      const entries = listDir(node)
      entries.forEach(({ name, node: child }, i) => {
        const last = i === entries.length - 1
        out.push(line(`${prefix}${last ? "└── " : "├── "}${name}${child.kind === "dir" ? "/" : ""}`, child.kind === "dir" ? "accent" : undefined))
        if (child.kind === "dir") {
          dirs += 1
          walk(child, `${prefix}${last ? "    " : "│   "}`)
        } else files += 1
      })
    }
    walk(root, "")
    out.push(blank(), line(`${dirs} ${dirs === 1 ? "directory" : "directories"}, ${files} ${files === 1 ? "file" : "files"}`, "muted"))
    return { lines: out }
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

  fetch: () => {
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
  // bait: langkah pertama yang klasik (sudo, rm -rf, nmap, IP privat) dijawab "nice try"
  const bait = handler ? (isRemote(name) ? baitForNetworkTarget(name, args) : null) : baitForCommand(rawName, args)
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
  if ("error" in parsed) return { lines: parsed.operator ? baitForOperator(parsed.operator) : [line(parsed.error, "error")] } // bait:

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
  if (command === "cd" || command === "ls" || command === "cat" || command === "tree") {
    const lastArg = parts[parts.length - 1]
    const head = leading.slice(0, leading.length - lastArg.length)
    const paths = completePath(cwd, lastArg, command === "cd")
    if (paths.length === 0) return { value: input, candidates: [] }
    if (paths.length === 1) return { value: `${head}${paths[0]}${paths[0].endsWith("/") ? "" : " "}`, candidates: [] }
    return { value: `${head}${commonPrefix(paths)}`, candidates: paths.map((p) => p.slice(p.lastIndexOf("/", p.length - 2) + 1)) }
  }

  let pool: string[] = []
  if (command === "help") pool = TERMINAL_COMMANDS.map((c) => c.command)
  else if (command === "project" || command === "open") pool = PROJECTS.map(projectSlug)
  else if (command === "theme") pool = ["dark", "light"]
  else if (isRemote(command)) pool = [SITE_DOMAIN]
  else if (command === "projects") pool = PROJECT_TAGS
  const partial = parts.slice(1).join(" ").toLowerCase()
  const matches = pool.filter((v) => v.startsWith(partial))
  if (matches.length === 0) return { value: input, candidates: [] }
  if (matches.length === 1) return { value: `${command} ${matches[0]}`, candidates: [] }
  return { value: `${command} ${commonPrefix(matches)}`, candidates: matches }
}
