import { StrictMode } from "react"
import { createRoot, hydrateRoot } from "react-dom/client"
import "./index.css"
import App from "./App"

const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// File ini juga dijalankan di Node saat build (lihat prerender di bawah), jadi bagian browser dijaga.
if (typeof window !== "undefined") {
  // bait: pesan untuk yang membuka console browser sambil mencari celah.
  console.log(
    "%cNice try.%c\nLooking for a way in? There is nothing hidden here, the source is public:\nhttps://github.com/hilmyah/Portfolio",
    "font: 700 20px ui-monospace, monospace; color: #f5c542",
    "font: 13px ui-monospace, monospace",
  )

  // Hasil build: #root sudah berisi halaman, cukup disambungkan ke event (hydrate).
  // `npm run dev`: #root masih kosong, halaman dirender dari awal.
  const root = document.getElementById("root")!
  if (root.firstElementChild) hydrateRoot(root, app)
  else createRoot(root).render(app)
}

/**
 * Dipanggil sekali saat `vite build` untuk mengisi index.html (lihat src/prerender.tsx), tidak
 * pernah di browser. Kodenya di-import di sini supaya tidak ikut terunduh pengunjung.
 */
export async function prerender() {
  const { default: prerenderPage } = await import("./prerender")
  return prerenderPage(app)
}
