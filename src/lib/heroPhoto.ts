import * as React from "react"

// Foto profil adalah elemen terbesar di layar pertama. Di koneksi lambat, 23 ikon tools yang
// diunduh bersamaan membuat foto tampil lebih lambat, jadi ikon menunggu foto selesai dulu
// (About.tsx memakai useHeroPhotoLoaded()). Kalau foto tidak kunjung selesai, tunggu paling lama
// MAX_WAIT_MS.
const MAX_WAIT_MS = 4000

let loaded = false
const listeners = new Set<() => void>()

/** Melepas ikon sekarang juga. */
export function releaseAfterHeroPhoto() {
  if (loaded) return
  loaded = true
  listeners.forEach((listener) => listener())
}

/**
 * Dipanggil saat foto selesai diunduh setelah halaman tampil (koneksi lambat). Ikon baru dilepas
 * setelah foto benar-benar tergambar (selesai di-decode, lalu dua frame).
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
