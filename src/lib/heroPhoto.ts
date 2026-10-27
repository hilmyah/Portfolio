import * as React from "react"

// Foto profil adalah elemen terbesar di layar pertama. Di koneksi lambat, font dan ikon tools yang
// diunduh bersamaan membuat foto baru tampil sekitar 1 detik lebih lambat, jadi keduanya menunggu
// foto selesai dulu. Penandanya class html.hero-ready (dipakai index.css untuk font) dan hook
// useHeroPhotoLoaded() (dipakai About.tsx untuk ikon). Kalau foto tidak kunjung selesai, tunggu
// paling lama MAX_WAIT_MS.
const MAX_WAIT_MS = 4000

let loaded = false
const listeners = new Set<() => void>()

/** Melepas font dan ikon sekarang juga. */
export function releaseAfterHeroPhoto() {
  if (loaded) return
  loaded = true
  document.documentElement.classList.add("hero-ready")
  listeners.forEach((listener) => listener())
}

/**
 * Dipanggil saat foto selesai diunduh setelah halaman tampil (koneksi lambat). Font dan ikon baru
 * dilepas setelah foto benar-benar tergambar (selesai di-decode, lalu dua frame), supaya pekerjaan
 * tambahan dari mengganti font tidak menunda frame yang menampilkan foto.
 */
export function heroPhotoLoaded(photo: HTMLImageElement) {
  const afterPaint = () => requestAnimationFrame(() => requestAnimationFrame(releaseAfterHeroPhoto))
  photo.decode().then(afterPaint, afterPaint)
}

if (typeof window !== "undefined") window.setTimeout(releaseAfterHeroPhoto, MAX_WAIT_MS)

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useHeroPhotoLoaded(): boolean {
  return React.useSyncExternalStore(subscribe, () => loaded)
}
