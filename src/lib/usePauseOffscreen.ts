import * as React from "react"

/**
 * Menandai elemen dengan data-offscreen selama berada jauh dari layar. CSS di index.css lalu
 * menghentikan sementara semua animasi di dalamnya, karena animasi yang berjalan tetap dihitung
 * browser di setiap frame (terasa saat scroll) walaupun tidak terlihat.
 */
export function usePauseOffscreen(ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const el = ref.current
    if (!el || !("IntersectionObserver" in window)) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) delete el.dataset.offscreen
        else el.dataset.offscreen = ""
      },
      { rootMargin: "200px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
}
