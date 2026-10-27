// Memasang tema tersimpan (atau tema OS) sebelum halaman tampil, supaya tidak berkedip putih.
// Sengaja file terpisah, bukan inline, supaya Content-Security-Policy tetap script-src 'self'.
try {
  var t = localStorage.getItem("theme")
  if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  if (t === "dark") document.documentElement.classList.add("dark")
} catch (e) {
  // localStorage diblokir: aplikasi memakai tema OS setelah dimuat
}
