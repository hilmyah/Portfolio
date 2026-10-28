// Plugin kecil untuk `vite build` (dipakai di vite.config.ts). Keduanya tidak aktif saat `npm run dev`.
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { brotliCompressSync, constants } from "node:zlib"
import type { Plugin } from "vite"
import { SITE_DOMAIN, SOCIALS } from "./src/site"

const COMPRESSIBLE = /\.(?:html|js|css|svg|json|txt|xml)$/
const MIN_BYTES = 256 // sama dengan gzip_min_length di nginx: file sekecil ini tidak perlu dikompres

/**
 * Setiap file teks di dist/ mendapat salinan .br dengan brotli level 11, yang terlalu lambat untuk
 * dikompres saat request tapi tidak masalah sekali saat build. nginx menyajikannya lewat
 * brotli_static (server/nginx/portfolio.conf).
 */
export function precompress(): Plugin {
  let outDir = ""
  return {
    name: "portfolio:precompress",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      for (const name of readdirSync(outDir, { recursive: true, encoding: "utf8" })) {
        if (!COMPRESSIBLE.test(name)) continue
        const file = path.join(outDir, name)
        const data = readFileSync(file)
        if (data.length < MIN_BYTES) continue
        const compressed = brotliCompressSync(data, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
            [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
          },
        })
        if (compressed.length < data.length) writeFileSync(`${file}.br`, compressed)
      }
    },
  }
}

/**
 * /.well-known/security.txt (RFC 9116): ke mana celah keamanan dilaporkan. Expires wajib ada dan
 * sebaiknya kurang dari setahun, jadi dihitung ulang setiap build: 364 hari dari tengah malam UTC
 * hari build, supaya build ulang di hari yang sama menghasilkan file yang sama.
 */
export function securityTxt(): Plugin {
  return {
    name: "portfolio:security-txt",
    apply: "build",
    generateBundle() {
      if (!SOCIALS.email) return
      const expires = new Date()
      expires.setUTCHours(0, 0, 0, 0)
      expires.setUTCDate(expires.getUTCDate() + 364)
      this.emitFile({
        type: "asset",
        fileName: ".well-known/security.txt",
        source: [
          `Contact: mailto:${SOCIALS.email}`,
          `Expires: ${expires.toISOString()}`,
          "Preferred-Languages: en, id",
          `Canonical: https://${SITE_DOMAIN}/.well-known/security.txt`,
          "",
        ].join("\n"),
      })
    },
  }
}
