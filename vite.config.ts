import path from "node:path"
import preact from "@preact/preset-vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { precompress, securityTxt } from "./vite.plugins"

export default defineConfig({
  // Kode tetap ditulis dengan API React (import dari "react"), tapi yang dibundel adalah Preact
  // lewat preact/compat: JavaScript halaman turun dari sekitar 95 KB menjadi 25 KB (gzip).
  // precompress dan securityTxt hanya jalan saat build, lihat vite.plugins.ts.
  plugins: [preact(), tailwindcss(), securityTxt(), precompress()],
  // Saat development, /api/ diteruskan ke situs yang sudah online supaya perintah jaringan di
  // terminal memakai backend asli (server/netapi.mjs). Ganti target untuk mencoba backend lokal.
  server: {
    proxy: {
      "/api": { target: "https://hilmyah.my.id", changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
