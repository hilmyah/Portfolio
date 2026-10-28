// Dipanggil saat build oleh prerender di @preact/preset-vite (vite.config.ts), tidak pernah di
// browser. index.html jadi sudah berisi halaman utuh, sehingga browser bisa langsung menggambarnya
// tanpa menunggu JavaScript; JavaScript lalu hanya menyambungkan event (hydrate, src/main.tsx).
//
// Aturan untuk komponen: render di sini berjalan di Node, tanpa window, document, localStorage
// atau matchMedia. Yang bergantung pada pengunjung (tema, URL, ukuran layar, data tersimpan) dibaca
// di useEffect atau dipilih lewat CSS. Saat menyambungkan, Preact tidak mengoreksi atribut yang
// berbeda dari HTML ini, jadi selisih tidak menimbulkan error tapi tampil salah.
import type { ReactElement } from "react"
import { renderToString } from "preact-render-to-string"
import { TOOL_ICONS } from "@/assets/tools/icons"
import { PROFILE, SITE_URL, SOCIALS, TOOLS } from "@/data"

export default function prerenderPage(app: ReactElement) {
  // Build gagal kalau TOOLS menyebut ikon yang filenya tidak ada, daripada kotak kosong di situs.
  const missing = TOOLS.filter((tool) => !TOOL_ICONS[tool.icon]).map((tool) => `src/assets/tools/${tool.icon}.svg`)
  if (missing.length) throw new Error(`Ikon tools tidak ditemukan: ${missing.join(", ")}`)

  // Data terstruktur untuk mesin pencari: pemilik situs dan akun resminya (sameAs).
  // Format: https://developers.google.com/search/docs/appearance/structured-data/profile-page
  const profilePage = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: SITE_URL,
    mainEntity: {
      "@type": "Person",
      name: PROFILE.name,
      alternateName: PROFILE.handle,
      description: `${PROFILE.role}. ${PROFILE.tagline.replaceAll(" • ", ", ")}.`,
      image: new URL(PROFILE.photo.src, SITE_URL).href,
      url: SITE_URL,
      sameAs: [SOCIALS.github, SOCIALS.linkedin, SOCIALS.instagram, SOCIALS.facebook].filter(Boolean),
    },
  }

  return {
    html: renderToString(app),
    head: {
      elements: new Set([
        // Foto profil (elemen terbesar di layar pertama) mulai diunduh sebelum <body> dibaca.
        { type: "link", props: { rel: "preload", as: "image", href: PROFILE.photo.src, fetchpriority: "high" } },
        // "<" di-escape supaya isi JSON tidak bisa menutup tag <script>.
        { type: "script", props: { type: "application/ld+json", children: JSON.stringify(profilePage).replace(/</g, "\\u003c") } },
      ]),
    },
  }
}
