import type { CSSProperties } from "react"
import { ABOUT, TOOLS, PROFILE } from "@/data"
import { Tooltip } from "@/components/ui/tooltip"
import { Reveal } from "@/components/Reveal"

export function About() {
  return (
    <section id="about" className="relative scroll-mt-32 mx-auto max-w-6xl px-4 py-16">
      <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] items-start">
        <Reveal className="relative">
          <div className="rounded-xl border border-border bg-card p-6 card-shadow relative">
            <h2 className="font-black text-2xl md:text-3xl mb-2 underline-scribble inline-block">About</h2>
            <p className="leading-relaxed">
              Hi! I&apos;m {PROFILE.name}. {ABOUT.bio}
            </p>
            <p className="mt-3 italic">{ABOUT.motto}</p>
            <span aria-hidden className="absolute -right-3 -top-2 h-7 w-7 bg-[url('/img/pixel-heart.svg')] bg-contain bg-no-repeat animate-bob" />
            <span aria-hidden className="absolute right-8 -bottom-3 h-7 w-7 bg-[url('/img/pacman.svg')] bg-contain bg-no-repeat animate-bob" />
            <span aria-hidden className="absolute -right-5 bottom-5 h-10 w-16 bg-[url('/img/redhood.png')] bg-contain bg-no-repeat animate-drift" />
          </div>

          <div className="absolute -top-6 -left-4 rotate-[-3deg] rounded-md border border-yellow-300 bg-yellow-100 px-3 py-2 text-sm shadow text-black">Keep learning • Stay kind</div>
        </Reveal>

        <Reveal className="relative" delay={140}>
          <div className="flex flex-wrap gap-3">
            {TOOLS.map((t, i) => {
              const rot = ((i * 17) % 7) - 3
              const y = ((i * 23) % 6) - 3
              const x = ((i * 31) % 6) - 3
              const dur = 6 + ((i * 7) % 5)
              return (
                <Tooltip key={t.name} content={<div><span className="font-semibold">{t.name}</span></div>}>
                  <img
                    src={t.icon}
                    alt={`${t.name} icon`}
                    className={`h-10 w-10 md:h-12 md:w-12 rounded-md border border-border bg-card p-2 shadow dark:border-neutral-300 dark:bg-neutral-100 transition-transform hover:scale-110 hover:-rotate-2 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring animate-indie-idle`}
                    style={{ transform: `translate(calc(${x}px + var(--idle-tx)), calc(${y}px + var(--idle-ty))) rotate(calc(${rot}deg + var(--idle-rot)))`, '--idle-dur': `${dur}s` } as CSSProperties}
                  />
                </Tooltip>
              )
            })}
          </div>
        </Reveal>
      </div>
    </section>
  )
}


