import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
