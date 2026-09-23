import * as React from 'react'
import './App.css'
import { Navbar } from '@/components/Navbar'
import { Hero } from '@/components/Hero'
import { About } from '@/components/About'
import { Projects } from '@/components/Projects'
import { Footer } from '@/components/Footer'
import { ScrollTop } from '@/components/ScrollTop'

function App() {
  React.useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--radius', '10px')
    document.body.classList.add('antialiased')
    let to: number | undefined
    const onScroll = () => {
      document.documentElement.classList.add('is-scrolling')
      if (to) window.clearTimeout(to)
      to = window.setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling')
      }, 250)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (to) window.clearTimeout(to)
    }
  }, [])

  return (
    <div className="font-sans">
      <Navbar />
      <main>
        <Hero />
        <About />
        <Projects />
      </main>
      <Footer />
      <ScrollTop />
    </div>
  )
}

export default App
