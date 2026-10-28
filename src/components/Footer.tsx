import bread from "@/assets/img/bread2.svg"
import clouds from "@/assets/img/clouds.svg"
import coffee from "@/assets/img/coffee2.svg"
import flower from "@/assets/img/flower3.svg"
import milk from "@/assets/img/milk.svg"
import mountain from "@/assets/img/mountain.svg"
import pencil from "@/assets/img/pencil.svg"
import photo from "@/assets/img/photo.svg"
import tapeImage from "@/assets/img/tape.svg"
import toast from "@/assets/img/toast.svg"
import tree from "@/assets/img/tree.svg"
import { PROFILE, SOCIALS } from "@/data"
import { cn } from "@/lib/utils"

// Gambar dekorasi di latar footer. Gambar kecil seperti ini ikut masuk ke file JS saat build
// (data URI), jadi tidak butuh request sendiri.
const DECORATIONS = [
  [clouds, "left-6 top-4 h-16 opacity-60"],
  [mountain, "right-6 bottom-6 h-20 opacity-60"],
  [tree, "left-6 bottom-6 h-16 opacity-70"],
  [photo, "right-1/3 top-3 h-16 rotate-2 opacity-90"],
  [bread, "left-1/2 bottom-4 -translate-x-1/2 h-12 -rotate-6 opacity-95"],
  [flower, "right-28 top-6 h-12 rotate-3 opacity-95"],
  [milk, "right-1/4 bottom-12 h-12 -rotate-2 opacity-90"],
  [coffee, "left-24 top-8 h-12 opacity-90"],
  [toast, "left-10 bottom-10 h-12 rotate-3 opacity-95"],
  [pencil, "left-1/3 top-4 h-16 opacity-95"],
  [tapeImage, "left-1/2 top-0 -translate-x-1/2 h-8 opacity-70"],
] as const

// Tiap link sosial media ditempel miring dengan selotip di sudut yang berbeda.
const LINKS = [
  { label: "GitHub", href: SOCIALS.github, tilt: "-rotate-1", tape: "-right-2 -top-2" },
  { label: "LinkedIn", href: SOCIALS.linkedin, tilt: "rotate-1", tape: "-left-2 -bottom-2" },
  { label: "Instagram", href: SOCIALS.instagram, tilt: "-rotate-2", tape: "-right-2 -bottom-2" },
  { label: "Facebook", href: SOCIALS.facebook, tilt: "rotate-1", tape: "-right-2 -top-2" },
  { label: "Email", href: SOCIALS.email && `mailto:${SOCIALS.email}`, tilt: "rotate-2", tape: "-left-2 -top-2" },
]

export function Footer() {
  return (
    <footer id="social" className="relative border-t border-border bg-transparent">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        {DECORATIONS.map(([src, position]) => (
          <img key={position} src={src} className={cn("absolute", position)} alt="" loading="lazy" decoding="async" />
        ))}
      </div>
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-3">
            {LINKS.map(({ label, href, tilt, tape }) => {
              if (!href) return null
              const external = !href.startsWith("mailto:")
              return (
                <a
                  key={label}
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  className={cn(
                    "relative rounded-md border border-border bg-background/70 px-3 py-1 text-sm font-medium transition-transform hover:-translate-y-1 hover:rotate-0 hover:shadow hover:bg-accent/60",
                    tilt
                  )}
                >
                  {/* garis bawah yang memanjang saat hover (.link-grow di index.css) */}
                  <span className="link-grow">{label}</span>
                  <span className={cn("pointer-events-none absolute h-3 w-8 bg-[url('@/assets/img/tape.svg')] bg-contain bg-no-repeat", tape)} />
                </a>
              )
            })}
          </div>
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
