import * as React from "react"
import { PROJECTS } from "@/data"
import { cn } from "@/lib/utils"

type Group = { folder: string; items: typeof PROJECTS }

const groups: Record<string, Group> = PROJECTS.reduce((acc, p) => {
  if (!acc[p.folder]) acc[p.folder] = { folder: p.folder, items: [] as any }
  ;(acc[p.folder].items as any).push(p)
  return acc
}, {} as Record<string, Group>)

export function Projects() {
  const [openFolder, setOpenFolder] = React.useState<string | null>(null)
  const folderNames = Object.keys(groups)
  const noteClasses = [
    "bg-yellow-100 border-yellow-300",
    "bg-pink-100 border-pink-300",
    "bg-purple-100 border-purple-300",
    "bg-green-100 border-green-300",
    "bg-blue-100 border-blue-300",
  ]

  return (
    <section id="projects" className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="font-black text-2xl md:text-3xl mb-6">Projects</h2>
      <div className="grid md:grid-cols-1 gap-4 items-start">
        {folderNames.map((folder, idx) => (
          <div
            key={folder}
            className={cn("relative rounded-lg border border-border bg-card transition-all paper-shadow")}
          >
            <span aria-hidden className="pointer-events-none absolute -left-1 -top-1 h-4 w-10 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
            <span aria-hidden className="pointer-events-none absolute -right-1 -top-1 h-4 w-10 rotate-6 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute -right-3 -top-5 h-8 w-8 rotate-12 bg-[url('/img/clip.svg')] bg-contain bg-no-repeat transition-opacity",
                openFolder === folder ? "opacity-0" : "opacity-100"
              )}
            />
            <button
              className="w-full text-left px-4 py-3 font-semibold border-b border-border flex items-center justify-between transition-transform hover:-translate-y-0.5 hover:shadow"
              onClick={() => setOpenFolder((f) => (f === folder ? null : folder))}
              aria-expanded={openFolder === folder}
            >
              <span className="inline-flex items-center gap-2">
                <span className="select-none">📁</span>
                <span className={"relative -rotate-1 px-2 py-0.5 rounded border text-black " + noteClasses[idx % noteClasses.length]}>{folder}</span>
              </span>
              <span className="text-sm text-muted-foreground">{groups[folder].items.length} files</span>
            </button>
            <div
              className={cn(
                "grid overflow-hidden transition-[grid-template-rows]",
                openFolder === folder ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
              id={`folder-${folder}`}
            >
              <div className="min-h-0">
                <ul className="divide-y divide-border">
                  {groups[folder].items.map((p) => (
                    <li key={p.id} className="relative p-5 flex gap-5 transition-transform hover:translate-x-1 bg-card/60">
                      <span aria-hidden className="pointer-events-none absolute left-3 top-2 h-6 w-6 bg-[url('/img/pin.svg')] bg-contain bg-no-repeat" />
                      <span aria-hidden className="pointer-events-none absolute right-3 top-2 h-6 w-6 bg-[url('/img/clip.svg')] bg-contain bg-no-repeat" />
                      <img src={p.thumbnail} alt={`${p.name} thumbnail`} className="h-40 w-64 md:h-44 md:w-72 rounded-md border border-border object-cover shadow" />
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{p.name}</span>
                          <div className="flex gap-1">
                            {p.tech.map((t) => (
                              <span key={t} className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">{t}</span>
                            ))}
                          </div>
                        </div>
                        <p className="text-left text-sm text-muted-foreground whitespace-pre-line">{p.description}</p>
                        <div className="mt-2 flex gap-3 text-sm">
                          {p.repo && (
                            <a className="relative -rotate-1 rounded border border-border bg-background/70 px-2 py-0.5 transition-all hover:-translate-y-0.5 hover:rotate-0 hover:shadow" href={p.repo} target="_blank" rel="noreferrer">repo</a>
                          )}
                          {p.demo && (
                            <a className="relative rotate-1 rounded border border-border bg-background/70 px-2 py-0.5 transition-all hover:-translate-y-0.5 hover:rotate-0 hover:shadow" href={p.demo} target="_blank" rel="noreferrer">demo</a>
                          )}
                        </div>
                      </div>
                      <span className="pointer-events-none absolute -left-1 -top-1 h-4 w-10 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}


