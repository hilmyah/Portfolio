// Applies the saved or OS-preferred theme before first paint to avoid a light flash.
// Kept as a file (not inline) so the Content-Security-Policy can stay at script-src 'self'.
try {
  var t = localStorage.getItem("theme")
  if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  if (t === "dark") document.documentElement.classList.add("dark")
} catch (e) {
  // storage blocked: the app falls back to the OS preference once it loads
}
