import * as React from "react"
import { About } from "@/components/About"
import { Footer } from "@/components/Footer"
import { Hero } from "@/components/Hero"
import { Navbar } from "@/components/Navbar"
import { NotFound } from "@/components/NotFound"
import { Projects } from "@/components/Projects"
import { ScrollTop } from "@/components/ScrollTop"
import { Terminal } from "@/components/Terminal"

/**
 * html.is-scrolling selama halaman di-scroll dan 250 ms sesudahnya. Dipakai index.css untuk
 * menggoyang scrollbar dan menghentikan sementara animasi dekorasi selama scroll.
 */
function useScrollingClass() {
  React.useEffect(() => {
    const root = document.documentElement
    let timer: number | undefined
    const onScroll = () => {
      root.classList.add("is-scrolling")
      window.clearTimeout(timer)
      timer = window.setTimeout(() => root.classList.remove("is-scrolling"), 250)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.clearTimeout(timer)
    }
  }, [])
}

export default function App() {
  useScrollingClass()
  return (
    <div className="font-sans overflow-x-clip">
      <Navbar />
      <main>
        <NotFound />
        <Hero />
        <About />
        <Projects />
        <Terminal />
      </main>
      <Footer />
      <ScrollTop />
    </div>
  )
}
