// Semua ikon tools dalam satu file JS: satu request, bernama hash, disimpan browser setahun.
// Diunduh About.tsx setelah foto profil tampil, dan diperiksa saat build oleh src/prerender.tsx.
//
// Menambah ikon: taruh <nama>.svg di folder ini, lalu tulis nama itu di TOOLS (src/data.ts).
// Isi SVG dibawa apa adanya (?raw) lalu dijadikan data URI, jadi filenya tidak diubah sedikit pun.

const files = import.meta.glob<string>("./*.svg", { query: "?raw", import: "default", eager: true })

/** Nama file tanpa .svg -> data URI siap dipakai sebagai src <img>. */
export const TOOL_ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [path.slice(2, -4), `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`])
)
