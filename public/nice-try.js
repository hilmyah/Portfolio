// bait: menampilkan path yang diminta pengunjung di halaman "nice try".
// Hanya lewat textContent, jadi isi URL selalu tampil sebagai teks dan tidak pernah dibaca sebagai HTML.
document.addEventListener("DOMContentLoaded", function () {
  var el = document.getElementById("requested")
  if (el) el.textContent = ("GET " + location.pathname + location.search).slice(0, 160)
})
