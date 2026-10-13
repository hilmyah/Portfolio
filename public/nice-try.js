// bait: fills in the path the visitor asked for on the "nice try" page.
// textContent only, so whatever is in the URL is shown as text and never parsed as HTML.
document.addEventListener("DOMContentLoaded", function () {
  var el = document.getElementById("requested")
  if (el) el.textContent = ("GET " + location.pathname + location.search).slice(0, 160)
})
