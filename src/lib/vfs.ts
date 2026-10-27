// Filesystem kecil yang hanya bisa dibaca, dibangun dari src/data.ts. Tidak menyentuh disk sama
// sekali; gunanya supaya ls, cd, cat dan tree terasa seperti shell sungguhan.
import { ABOUT, PROFILE, PROJECTS, SOCIALS, TOOLS } from "@/data"
import type { Project } from "@/data"

export const HOME = "/home/visitor"

type FileNode = { kind: "file"; content: string }
type DirNode = { kind: "dir"; children: Record<string, VfsNode> }
export type VfsNode = FileNode | DirNode

export function projectSlug(project: Project): string {
  return project.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

/** Baris bernilai false/undefined dilewati, jadi field opsional bisa ditulis langsung. */
const file = (lines: (string | false | undefined)[]): FileNode => ({
  kind: "file",
  content: lines.filter((l): l is string => typeof l === "string").join("\n") + "\n",
})
const dir = (children: Record<string, VfsNode>): DirNode => ({ kind: "dir", children })

function projectFile(p: Project): FileNode {
  return file([
    `# ${p.name}`,
    "",
    p.description,
    "",
    p.role && `role:    ${p.role}`,
    p.status && `status:  ${p.status}`,
    `tech:    ${p.tech.join(", ")}`,
    `tags:    ${p.tags.join(", ")}`,
    p.repo && `repo:    ${p.repo}`,
    p.demo && `demo:    ${p.demo}`,
  ])
}

function buildTree(): DirNode {
  const home = dir({
    "about.md": file([`# ${PROFILE.name}`, "", PROFILE.role, PROFILE.tagline, "", ABOUT.bio, "", `> ${ABOUT.motto}`]),
    "contact.md": file([
      "# Contact",
      "",
      SOCIALS.email ? `email:     ${SOCIALS.email}` : undefined,
      SOCIALS.github ? `github:    ${SOCIALS.github}` : undefined,
      SOCIALS.linkedin ? `linkedin:  ${SOCIALS.linkedin}` : undefined,
      SOCIALS.instagram ? `instagram: ${SOCIALS.instagram}` : undefined,
      SOCIALS.facebook ? `facebook:  ${SOCIALS.facebook}` : undefined,
    ]),
    "tools.txt": file(TOOLS.map((t) => t.name)),
    projects: dir(Object.fromEntries(PROJECTS.map((p) => [`${projectSlug(p)}.md`, projectFile(p)]))),
  })
  return dir({ home: dir({ visitor: home }) })
}

const ROOT = buildTree()

/** Mengubah path (absolut, diawali ~, atau relatif terhadap cwd) menjadi path absolut yang sudah dinormalkan. */
export function resolvePath(cwd: string, input: string): string {
  let raw = input.trim()
  if (raw === "" || raw === "~") return HOME
  if (raw.startsWith("~/")) raw = HOME + raw.slice(1)
  const stack: string[] = []
  for (const part of (raw.startsWith("/") ? raw : `${cwd}/${raw}`).split("/")) {
    if (!part || part === ".") continue
    if (part === "..") stack.pop()
    else stack.push(part)
  }
  return "/" + stack.join("/")
}

export function lookupPath(path: string): VfsNode | undefined {
  let node: VfsNode = ROOT
  for (const part of path.split("/").filter(Boolean)) {
    if (node.kind !== "dir") return undefined
    const next: VfsNode | undefined = node.children[part]
    if (!next) return undefined
    node = next
  }
  return node
}

/** "/home/visitor/projects" menjadi "~/projects" untuk prompt. */
export function displayPath(path: string): string {
  if (path === HOME) return "~"
  if (path.startsWith(`${HOME}/`)) return `~${path.slice(HOME.length)}`
  return path
}

/** Isi folder: subfolder dulu, lalu file, masing-masing urut abjad. */
export function listDir(node: DirNode): { name: string; node: VfsNode }[] {
  return Object.keys(node.children)
    .sort((a, b) => {
      const aDir = node.children[a].kind === "dir"
      const bDir = node.children[b].kind === "dir"
      return aDir === bDir ? a.localeCompare(b) : aDir ? -1 : 1
    })
    .map((name) => ({ name, node: node.children[name] }))
}

/** Kandidat completion untuk sebagian path; nama folder diakhiri "/". */
export function completePath(cwd: string, partial: string, dirsOnly = false): string[] {
  const slash = partial.lastIndexOf("/")
  const base = slash >= 0 ? partial.slice(0, slash + 1) : ""
  const stem = partial.slice(slash + 1)
  const node = lookupPath(resolvePath(cwd, base || "."))
  if (!node || node.kind !== "dir") return []
  return listDir(node)
    .filter(({ name, node: child }) => name.startsWith(stem) && (!dirsOnly || child.kind === "dir"))
    .map(({ name, node: child }) => `${base}${name}${child.kind === "dir" ? "/" : ""}`)
}
