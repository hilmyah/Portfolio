import * as React from "react"
import { SOCIALS, PROFILE } from "@/data"

export function Footer() {
  return (
    <footer id="social" className="relative border-t border-border bg-transparent">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <img src="/img/clouds.svg" className="absolute left-6 top-4 h-16 opacity-60" alt="" />
        <img src="/img/mountain.svg" className="absolute right-6 bottom-6 h-20 opacity-60" alt="" />
        <img src="/img/tree.svg" className="absolute left-6 bottom-6 h-16 opacity-70" alt="" />
        <img src="/img/photo.svg" className="absolute right-1/3 top-3 h-16 rotate-2 opacity-90" alt="" />
        <img src="/img/bread2.svg" className="absolute left-1/2 bottom-4 -translate-x-1/2 h-12 -rotate-6 opacity-95" alt="" />
        <img src="/img/flower3.svg" className="absolute right-28 top-6 h-12 rotate-3 opacity-95" alt="" />
        <img src="/img/milk.svg" className="absolute right-1/4 bottom-12 h-12 -rotate-2 opacity-90" alt="" />
        <img src="/img/coffee2.svg" className="absolute left-24 top-8 h-12 opacity-90" alt="" />
        <img src="/img/toast.svg" className="absolute left-10 bottom-10 h-12 rotate-3 opacity-95" alt="" />
        <img src="/img/pencil.svg" className="absolute left-1/3 top-4 h-16 opacity-95" alt="" />
        <img src="/img/tape.svg" className="absolute left-1/2 top-0 -translate-x-1/2 h-8 opacity-70" alt="" />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-3">
            {SOCIALS.github && (
              <a href={SOCIALS.github} target="_blank" rel="noreferrer" className="relative -rotate-1 rounded-md border border-border bg-background/70 px-3 py-1 text-sm font-medium transition-transform hover:-translate-y-1 hover:rotate-0 hover:shadow hover:bg-accent/60">
                GitHub
                <span className="pointer-events-none absolute -right-2 -top-2 h-3 w-8 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
              </a>
            )}
            {SOCIALS.linkedin && (
              <a href={SOCIALS.linkedin} target="_blank" rel="noreferrer" className="relative rotate-1 rounded-md border border-border bg-background/70 px-3 py-1 text-sm font-medium transition-transform hover:-translate-y-1 hover:rotate-0 hover:shadow hover:bg-accent/60">
                LinkedIn
                <span className="pointer-events-none absolute -left-2 -bottom-2 h-3 w-8 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
              </a>
            )}
            {SOCIALS.instagram && (
              <a href={SOCIALS.instagram} target="_blank" rel="noreferrer" className="relative -rotate-2 rounded-md border border-border bg-background/70 px-3 py-1 text-sm font-medium transition-transform hover:-translate-y-1 hover:rotate-0 hover:shadow hover:bg-accent/60">
                Instagram
                <span className="pointer-events-none absolute -right-2 -bottom-2 h-3 w-8 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
              </a>
            )}
            {SOCIALS.email && (
              <a href={`mailto:${SOCIALS.email}`} className="relative rotate-2 rounded-md border border-border bg-background/70 px-3 py-1 text-sm font-medium transition-transform hover:-translate-y-1 hover:rotate-0 hover:shadow hover:bg-accent/60">
                Email
                <span className="pointer-events-none absolute -left-2 -top-2 h-3 w-8 bg-[url('/img/tape.svg')] bg-contain bg-no-repeat" />
              </a>
            )}
          </div>
          {/* back-to-top removed per request; floating ScrollTop remains */}
        </div>
        <p className="mt-6 text-center text-2xl md:text-3xl italic font-handwriting -rotate-1">I yearn for meaningful work and genuine connections.</p>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <span className="inline-block rounded-md ghibli-pill px-2 py-1">
            © {new Date().getFullYear()} {PROFILE.name} · brewed with coffee and late-night commits.
          </span>
        </p>
      </div>
    </footer>
  )
}


