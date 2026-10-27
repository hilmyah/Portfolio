import * as React from "react"
import { Reveal } from "@/components/Reveal"
import { TerminalWindow } from "@/components/TerminalWindow"
import { usePauseOffscreen } from "@/lib/usePauseOffscreen"

export function Terminal() {
  const sectionRef = React.useRef<HTMLElement | null>(null)
  usePauseOffscreen(sectionRef)

  return (
    <section ref={sectionRef} id="terminal" className="relative mx-auto max-w-6xl scroll-mt-32 px-4 py-16">
      <Reveal>
        <h2 className="font-black text-2xl md:text-3xl mb-2 underline-scribble inline-block">Terminal</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          The same portfolio, through a shell. Type a command, or start with help.
        </p>
      </Reveal>
      <TerminalWindow />
    </section>
  )
}
