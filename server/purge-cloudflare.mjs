// Menghapus file tertentu dari cache Cloudflare. Dipanggil server/deploy.sh setelah rilis baru
// aktif, supaya HTML dan file dari public/ yang berubah langsung terlihat tanpa menunggu cache habis.
//
// Butuh environment CF_ZONE_ID dan CF_API_TOKEN (API token dengan izin Zone > Cache Purge > Purge,
// hanya untuk zone hilmyah.my.id). Yang dibersihkan hanya URL yang diberikan, jadi cache subdomain
// lain di zone yang sama tidak tersentuh.
//
// usage: node purge-cloudflare.mjs <url situs> <path>...
//   path relatif ke root situs; "" berarti halaman utama (/)

const API = process.env.CF_API_URL ?? "https://api.cloudflare.com/client/v4" // CF_API_URL hanya untuk tes
const BATCH = 100 // batas URL per request purge, sama di semua paket Cloudflare
const zone = process.env.CF_ZONE_ID ?? ""
const token = process.env.CF_API_TOKEN ?? ""
const [site, ...paths] = process.argv.slice(2)

if (!/^[0-9a-f]{32}$/.test(zone) || !token) {
  console.error("purge: CF_ZONE_ID (32 karakter hex) atau CF_API_TOKEN belum diisi")
  process.exit(2)
}
if (!site) {
  console.error("usage: node purge-cloudflare.mjs <url situs> <path>...")
  process.exit(2)
}

const urls = paths.map((p) => new URL(p.split("/").map(encodeURIComponent).join("/"), `${site.replace(/\/$/, "")}/`).href)

for (let i = 0; i < urls.length; i += BATCH) {
  let response
  try {
    response = await fetch(`${API}/zones/${zone}/purge_cache`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ files: urls.slice(i, i + BATCH) }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    console.error(`purge: API Cloudflare tidak bisa dihubungi (${error.cause?.code ?? error.name})`)
    process.exit(1)
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success !== true) {
    const reason = data.errors?.map((e) => `${e.code} ${e.message}`).join("; ") || `HTTP ${response.status}`
    console.error(`purge: ditolak Cloudflare (${reason})`)
    process.exit(1)
  }
}
console.log(`purge: ${urls.length} URL dihapus dari cache Cloudflare`)
