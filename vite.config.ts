import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // In development, /api/ goes to the deployed site so the terminal's network commands
  // use the real backend (server/netapi.mjs). Change the target to test a local one.
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
