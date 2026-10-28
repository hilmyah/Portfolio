import * as React from "react"
import { PROJECTS } from "@/data"
import type { Project } from "@/data"
import { Reveal } from "@/components/Reveal"
import { cn } from "@/lib/utils"

// Project dikelompokkan per folder, dengan urutan sesuai kemunculan pertama di data.ts.
const FOLDERS = PROJECTS.reduce<Map<string, Project[]>>((folders, project) => {
  folders.set(project.folder, [...(folders.get(project.folder) ?? []), project])
  return folders
}, new Map())

// Warna kertas label folder, bergiliran.
const LABEL_COLORS = [
  "bg-yellow-100 border-yellow-300",
  "bg-pink-100 border-pink-300",
  "bg-purple-100 border-purple-300",
  "bg-green-100 border-green-300",
  "bg-blue-100 border-blue-300",
]

const TAPE = "pointer-events-none absolute h-4 w-10 bg-[url('@/assets/img/tape.svg')] bg-contain bg-no-repeat"

function ProjectItem({ project }: { project: Project }) {
  const linkClass = "relative rounded border border-border bg-background/70 px-2 py-0.5 transition hover:-translate-y-0.5 hover:rotate-0 hover:shadow"
  return (
    <li className="relative p-5 flex flex-col sm:flex-row gap-5 transition-transform hover:translate-x-1 bg-card/60">
      <span aria-hidden className="pointer-events-none absolute left-3 top-2 h-6 w-6 bg-[url('@/assets/img/pin.svg')] bg-contain bg-no-repeat" />
      <span aria-hidden className="pointer-events-none absolute right-3 top-2 h-6 w-6 bg-[url('@/assets/img/clip.svg')] bg-contain bg-no-repeat" />
      {project.thumbnail && (
        <img
          src={project.thumbnail}
          alt={`${project.name} thumbnail`}
          className="h-40 w-full sm:w-64 md:h-44 md:w-72 shrink-0 rounded-md border border-border object-cover shadow"
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="min-w-0 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold truncate">{project.name}</span>
          <div className="flex flex-wrap gap-1">
            {project.tech.map((t) => (
              <span key={t} className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">{t}</span>
            ))}
          </div>
        </div>
        <p className="text-left text-sm text-muted-foreground whitespace-pre-line">{project.description}</p>
        <div className="mt-2 flex gap-3 text-sm">
          {project.repo && (
            <a className={cn(linkClass, "-rotate-1")} href={project.repo} target="_blank" rel="noreferrer">repo</a>
          )}
          {project.demo && (
            <a className={cn(linkClass, "rotate-1")} href={project.demo} target="_blank" rel="noreferrer">demo</a>
          )}
        </div>
      </div>
      <span className={cn(TAPE, "-left-1 -top-1")} />
    </li>
  )
}

export function Projects() {
  const [openFolder, setOpenFolder] = React.useState<string | null>(null)
  if (PROJECTS.length === 0) return null

  return (
    <section id="projects" className="mx-auto max-w-6xl scroll-mt-32 px-4 py-16">
      <h2 className="font-black text-2xl md:text-3xl mb-6">Projects</h2>
      <div className="grid md:grid-cols-1 gap-4 items-start">
        {[...FOLDERS].map(([folder, items], idx) => {
          const open = openFolder === folder
          return (
            <Reveal key={folder} delay={idx * 90}>
              <div className="relative rounded-lg border border-border bg-card paper-shadow">
                <span aria-hidden className={cn(TAPE, "-left-1 -top-1")} />
                <span aria-hidden className={cn(TAPE, "-right-1 -top-1 rotate-6")} />
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute -right-3 -top-5 h-8 w-8 rotate-12 bg-[url('@/assets/img/clip.svg')] bg-contain bg-no-repeat transition-opacity",
                    open ? "opacity-0" : "opacity-100"
                  )}
                />
                <button
                  className="w-full text-left px-4 py-3 font-semibold border-b border-border flex items-center justify-between transition-transform hover:-translate-y-0.5 hover:shadow"
                  onClick={() => setOpenFolder(open ? null : folder)}
                  aria-expanded={open}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="select-none">📁</span>
                    <span className={cn("relative -rotate-1 px-2 py-0.5 rounded border text-black", LABEL_COLORS[idx % LABEL_COLORS.length])}>{folder}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {items.length} {items.length === 1 ? "file" : "files"}
                  </span>
                </button>
                {/* Buka-tutup folder: tinggi baris grid dianimasikan dari 0fr ke 1fr. */}
                <div className={cn("grid overflow-hidden transition-[grid-template-rows]", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} id={`folder-${folder}`}>
                  <div className="min-h-0">
                    <ul className="divide-y divide-border">
                      {items.map((p) => (
                        <ProjectItem key={p.id} project={p} />
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}
