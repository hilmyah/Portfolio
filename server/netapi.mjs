// Backend terminal portfolio: menjalankan sekumpulan tool jaringan sungguhan di mesin yang
// meng-hosting situs ini, lalu mengalirkan output-nya kembali ke browser.
//
//   POST /api/run   {"cmd": "dig", "args": ["-x", "1.1.1.1", "+short"]}
//   GET  /api/health
//
// Perintah: ping, dig, nslookup, host, traceroute (binary sistem) dan whois (bawaan, TCP 43).
// Tanpa dependency; butuh Node 18+. Hanya listen di localhost; nginx meneruskan /api/ ke sini.
//
// Ini bukan shell. Pemanggilnya pengunjung anonim, jadi:
//   - hanya perintah dan flag di bawah yang diterima; tidak ada yang lewat shell
//   - setiap host yang akan dihubungi tool di-resolve di sini dulu (lewat resolver publik, bukan
//     resolver LAN), dan alamat privat, loopback, link-local, CGNAT dan multicast ditolak, supaya
//     LAN tidak bisa diintip; tool tidak pernah diberi opsi yang membuatnya memilih host lain
//     sendiri (tidak ada dig +trace)
//   - hanya request JSON dari situs sendiri yang diterima, jadi website lain tidak bisa menyuruh
//     browser pengunjungnya menjalankan perintah
//   - tool DNS memakai resolver publik, kecuali pengunjung menyebut resolver publik lain
//   - alamat privat di output traceroute disamarkan
//   - setiap perintah punya batas waktu dan batas ukuran output; request dibatasi per menit
import { spawn } from "node:child_process"
import { Resolver } from "node:dns/promises"
import { createServer } from "node:http"
import { connect, isIP } from "node:net"

const PORT = Number(process.env.NETAPI_PORT ?? 8787)
const HOST = process.env.NETAPI_HOST ?? "127.0.0.1"
const BIN_DIR = process.env.NETAPI_BIN_DIR ?? "" // tes mengarahkannya ke binary tiruan
const DEFAULT_RESOLVER = process.env.NETAPI_RESOLVER ?? "1.1.1.1"
// Nama host di-resolve lewat resolver publik, bukan resolver sistem (sering kali router rumah),
// supaya API ini tidak bisa dipakai mencari nama yang hanya ada di LAN.
const resolver = new Resolver({ timeout: 3000, tries: 2 })
resolver.setServers([...new Set([DEFAULT_RESOLVER, "1.1.1.1", "8.8.8.8"])])
// Khusus tes: port whois selain 43, dan peta host -> alamat yang melewati filter alamat.
// Biarkan keduanya kosong di production.
const WHOIS_PORT = Number(process.env.NETAPI_WHOIS_PORT ?? 43)
const TEST_HOSTS = process.env.NETAPI_TEST_HOSTS ? JSON.parse(process.env.NETAPI_TEST_HOSTS) : {}

const PER_CLIENT_PER_MINUTE = 12
const GLOBAL_PER_MINUTE = 120
const MAX_CONCURRENT = 4
const MAX_OUTPUT_BYTES = 96 * 1024
const MAX_BODY_BYTES = 4096

// bait: request yang hanya dikirim penyerang mendapat "nice try" di pesan error-nya.
const NICE_TRY_LAN = "Nice try: the network behind this server is off limits."
const SHELL_TRICK = /[;&|`$<>\\]|\.\.\//

class UserError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key)

// ---------------------------------------------------------------- filter alamat

function ipv4ToInt(ip) {
  return ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0)
}

const BLOCKED_V4 = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
].map(([base, bits]) => ({ base: ipv4ToInt(base), size: 2 ** (32 - bits) }))

function isBlockedV4(ip) {
  const value = ipv4ToInt(ip)
  return BLOCKED_V4.some(({ base, size }) => value >= base && value < base + size)
}

/** "2002:c0a8::1" -> [0x2002, 0xc0a8, 0, 0, 0, 0, 0, 1]; bagian IPv4 bertitik di akhir juga ditangani. */
function expandV6(ip) {
  let text = ip.toLowerCase().split("%")[0]
  const dotted = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number)
    text = `${text.slice(0, -dotted[0].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [head, tail] = text.split("::")
  const left = head ? head.split(":") : []
  const right = tail ? tail.split(":") : []
  const groups = tail === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
  return groups.map((g) => parseInt(g || "0", 16))
}

function isBlockedV6(ip) {
  const g = expandV6(ip)
  const v4 = (hi, lo) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
  if (g.slice(0, 6).every((x) => x === 0)) return true // ::, ::1 dan IPv4-compatible ::a.b.c.d
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return true // IPv4-mapped ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return true // NAT64 64:ff9b::/96 dan 64:ff9b:1::/48
  if (g[0] === 0x2002) return isBlockedV4(v4(g[1], g[2])) // 6to4 membawa alamat IPv4
  if (g[0] === 0x2001 && g[1] === 0) return true // Teredo 2001::/32
  if (g[0] === 0x2001 && g[1] === 0xdb8) return true // dokumentasi 2001:db8::/32
  if (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true // discard 100::/64
  if ((g[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0) return true // link-local, site-local lama
  if ((g[0] & 0xff00) === 0xff00) return true // ff00::/8 multicast
  return false
}

function isBlockedAddress(ip) {
  const family = isIP(ip)
  if (family === 4) return isBlockedV4(ip)
  if (family === 6) return isBlockedV6(ip)
  return true
}

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9-]{2,63}$/
// Pertanyaan DNS boleh berupa satu label ("com") atau root (".").
const DNS_NAME_RE = /^(?=.{1,253}$)(\.|([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.?)$/

function cleanHost(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.$/, "")
}

async function resolvePublicDns(host) {
  const [v4, v6] = await Promise.allSettled([resolver.resolve4(host), resolver.resolve6(host)])
  return [
    ...(v4.status === "fulfilled" ? v4.value.map((address) => ({ address, family: 4 })) : []),
    ...(v6.status === "fulfilled" ? v6.value.map((address) => ({ address, family: 6 })) : []),
  ]
}

/** Me-resolve host yang akan dihubungi tool dan mengembalikan { address, family } yang publik. */
async function publicTarget(raw, wantFamily = 0) {
  const host = cleanHost(raw)
  if (has(TEST_HOSTS, host)) return { host, address: TEST_HOSTS[host], family: 4 }
  let usable
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new UserError(`${host} is in a private or reserved address range. ${NICE_TRY_LAN}`, 403)
    usable = [{ address: host, family: isIP(host) }]
  } else if (HOSTNAME_RE.test(host)) {
    // Pesannya sama untuk nama yang tidak ada dan nama yang hanya menunjuk ke alamat privat,
    // jadi jawabannya tidak membocorkan nama internal mana yang ada.
    usable = (await resolvePublicDns(host)).filter((a) => !isBlockedAddress(a.address))
    if (usable.length === 0) throw new UserError(`${host} does not resolve to a public address`, 422)
  } else {
    throw new UserError(`'${String(raw).slice(0, 80)}' is not a valid host name or IP address`)
  }
  if (wantFamily) {
    usable = usable.filter((a) => a.family === wantFamily)
    if (usable.length === 0) throw new UserError(`${host} has no IPv${wantFamily} address`, 422)
  }
  return { host, ...(usable.find((a) => a.family === 4) ?? usable[0]) }
}

function dnsName(raw) {
  const name = String(raw).trim().toLowerCase()
  if (!DNS_NAME_RE.test(name)) throw new UserError(`'${String(raw).slice(0, 80)}' is not a valid domain name`)
  return name
}

function publicIpLiteral(raw) {
  const ip = cleanHost(raw)
  if (!isIP(ip)) throw new UserError(`'${String(raw).slice(0, 80)}' is not an IP address`)
  if (isBlockedAddress(ip)) throw new UserError(`${ip} is in a private or reserved address range. ${NICE_TRY_LAN}`, 403)
  return ip
}

function intOption(value, name, min, max) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw new UserError(`${name} must be between ${min} and ${max}`)
  return n
}

/** Baris "# host resolves to alamat" di awal output, kalau target diberikan sebagai nama. */
const resolvedBanner = (target) => (target.host === target.address ? "" : `# ${target.host} resolves to ${target.address}\n`)

// ---------------------------------------------------------------- penyusun perintah
// Setiap builder mengubah argumen pengunjung menjadi { bin, argv, deadline }, atau melempar UserError.

const RECORD_TYPES = new Set(["A", "AAAA", "ANY", "CAA", "CNAME", "DNSKEY", "DS", "MX", "NS", "PTR", "SOA", "SRV", "TXT"])
const DIG_OPTIONS = new Set([
  "short", "noall", "all", "answer", "noanswer", "authority", "noauthority", "additional", "noadditional",
  "question", "noquestion", "comments", "nocomments", "stats", "nostats", "cmd", "nocmd", "tcp", "notcp",
  "dnssec", "nodnssec", "multiline", "nomultiline", "recurse", "norecurse", "ttlid", "nottlid",
])
// +trace sengaja tidak ada: dig akan menanyai sendiri setiap name server di sepanjang delegasi,
// di alamat yang dipilih pemilik domain (termasuk alamat privat), melewati filter di atas.

const builders = {
  async ping(args) {
    let count = 4
    let family = 0
    let target
    for (let i = 0; i < args.length; i++) {
      const a = args[i]
      if (a === "-c") count = intOption(args[++i], "count", 1, 10)
      else if (/^-c\d+$/.test(a)) count = intOption(a.slice(2), "count", 1, 10)
      else if (a === "-4") family = 4
      else if (a === "-6") family = 6
      else if (a === "-n") continue
      else if (a.startsWith("-")) throw new UserError(`ping: option '${a}' is not available here (allowed: -c count, -4, -6)`)
      else if (target) throw new UserError("ping: only one host can be given")
      else target = a
    }
    if (!target) throw new UserError("usage: ping [-c count] [-4|-6] <host>")
    const resolved = await publicTarget(target, family)
    return {
      bin: "ping",
      argv: ["-n", resolved.family === 6 ? "-6" : "-4", "-c", String(count), "-W", "2", "-w", String(count + 4), resolved.address],
      deadline: (count + 8) * 1000,
      banner: resolvedBanner(resolved),
    }
  },

  async dig(args) {
    const argv = []
    let server
    let name
    let type
    let reverse
    for (let i = 0; i < args.length; i++) {
      const a = args[i]
      if (a.startsWith("@")) server = (await publicTarget(a.slice(1))).address
      else if (a === "-x") reverse = publicIpLiteral(args[++i])
      else if (a === "-t") type = String(args[++i] ?? "").toUpperCase()
      else if (a === "-4" || a === "-6") argv.push(a)
      else if (a.startsWith("+")) {
        if (!DIG_OPTIONS.has(a.slice(1).toLowerCase())) throw new UserError(`dig: option '${a}' is not available here`)
        argv.push(a.toLowerCase())
      } else if (a.startsWith("-")) throw new UserError(`dig: option '${a}' is not available here (allowed: -x, -t, -4, -6, @server, +options)`)
      else if (RECORD_TYPES.has(a.toUpperCase()) && type === undefined) type = a.toUpperCase()
      else if (name === undefined) name = dnsName(a)
      else throw new UserError("dig: only one name can be given")
    }
    if (type !== undefined && !RECORD_TYPES.has(type)) throw new UserError(`dig: record type '${type}' is not available here`)
    if (reverse && name) throw new UserError("dig: use either a name or -x <ip>, not both")
    const question = reverse ? ["-x", reverse] : [name ?? ".", type ?? (name ? "A" : "NS")]
    return {
      bin: "dig",
      argv: [`@${server ?? DEFAULT_RESOLVER}`, ...question, ...argv, "+time=3", "+tries=1"],
      deadline: 10000,
    }
  },

  async nslookup(args) {
    let type
    const positional = []
    for (const a of args) {
      const option = a.match(/^-(?:type|query|q)=([a-z]+)$/i)
      if (option) type = option[1].toUpperCase()
      else if (a.startsWith("-")) throw new UserError(`nslookup: option '${a}' is not available here (allowed: -type=TYPE)`)
      else positional.push(a)
    }
    if (positional.length < 1 || positional.length > 2) throw new UserError("usage: nslookup [-type=TYPE] <name|ip> [server]")
    if (type !== undefined && !RECORD_TYPES.has(type)) throw new UserError(`nslookup: record type '${type}' is not available here`)
    const subject = isIP(cleanHost(positional[0])) ? publicIpLiteral(positional[0]) : dnsName(positional[0])
    const server = positional[1] ? (await publicTarget(positional[1])).address : DEFAULT_RESOLVER
    return { bin: "nslookup", argv: ["-timeout=3", "-retry=1", ...(type ? [`-type=${type}`] : []), subject, server], deadline: 12000 }
  },

  async host(args) {
    const argv = []
    const positional = []
    for (let i = 0; i < args.length; i++) {
      const a = args[i]
      if (a === "-t") {
        const type = String(args[++i] ?? "").toUpperCase()
        if (!RECORD_TYPES.has(type)) throw new UserError(`host: record type '${type}' is not available here`)
        argv.push("-t", type)
      } else if (a === "-4" || a === "-6" || a === "-a" || a === "-v") argv.push(a)
      else if (a.startsWith("-")) throw new UserError(`host: option '${a}' is not available here (allowed: -t TYPE, -a, -v, -4, -6)`)
      else positional.push(a)
    }
    if (positional.length < 1 || positional.length > 2) throw new UserError("usage: host [-t TYPE] <name|ip> [server]")
    const subject = isIP(cleanHost(positional[0])) ? publicIpLiteral(positional[0]) : dnsName(positional[0])
    const server = positional[1] ? (await publicTarget(positional[1])).address : DEFAULT_RESOLVER
    return { bin: "host", argv: ["-W", "3", ...argv, subject, server], deadline: 12000 }
  },

  async traceroute(args) {
    let family = 0
    let maxHops = 20
    let target
    for (let i = 0; i < args.length; i++) {
      const a = args[i]
      if (a === "-m") maxHops = intOption(args[++i], "max hops", 1, 30)
      else if (a === "-4") family = 4
      else if (a === "-6") family = 6
      else if (a === "-n") continue
      else if (a.startsWith("-")) throw new UserError(`traceroute: option '${a}' is not available here (allowed: -m hops, -4, -6)`)
      else if (target) throw new UserError("traceroute: only one host can be given")
      else target = a
    }
    if (!target) throw new UserError("usage: traceroute [-m hops] [-4|-6] <host>")
    const resolved = await publicTarget(target, family)
    return {
      bin: "traceroute",
      // -n: tanpa reverse lookup (lebih cepat, dan resolver lokal tidak ikut terpakai). Satu probe per hop, tunggu 1 detik.
      argv: ["-n", resolved.family === 6 ? "-6" : "-4", "-q", "1", "-w", "1", "-m", String(maxHops), resolved.address],
      deadline: (maxHops + 6) * 1000,
      banner: resolvedBanner(resolved),
      maskPrivate: true,
    }
  },
}

// ---------------------------------------------------------------- whois (TCP 43, tanpa binary)

function whoisQuery(address, query, signal) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    const socket = connect({ host: address, port: WHOIS_PORT, timeout: 8000 })
    const stop = () => socket.destroy()
    signal.addEventListener("abort", stop, { once: true })
    socket.on("connect", () => socket.write(`${query}\r\n`))
    socket.on("data", (chunk) => {
      size += chunk.length
      if (size > MAX_OUTPUT_BYTES) return socket.destroy()
      chunks.push(chunk)
    })
    socket.on("timeout", () => socket.destroy(new Error("timeout")))
    socket.on("error", reject)
    socket.on("close", () => {
      signal.removeEventListener("abort", stop)
      resolve(Buffer.concat(chunks).toString("utf8"))
    })
  })
}

/** Mengikuti rujukan IANA -> registry -> registrar, dan memeriksa setiap host rujukan sebelum dihubungi. */
async function runWhois(args, write, signal) {
  let server
  let subject
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "-h") server = args[++i]
    else if (a === "-H") continue
    else if (a.startsWith("-")) throw new UserError(`whois: option '${a}' is not available here (allowed: -h server)`)
    else if (subject) throw new UserError("whois: only one name or address can be given")
    else subject = cleanHost(a)
  }
  if (!subject) throw new UserError("usage: whois [-h server] <domain|ip>")
  if (!isIP(subject) && !DNS_NAME_RE.test(subject)) throw new UserError(`'${subject.slice(0, 80)}' is not a valid domain or IP address`)

  let next = server ?? "whois.iana.org"
  const visited = new Set()
  for (let hop = 0; hop < 4 && next && !visited.has(next); hop++) {
    visited.add(next)
    const target = await publicTarget(next)
    let text
    try {
      text = await whoisQuery(target.address, subject, signal)
    } catch {
      write(`whois: could not reach ${target.host}\n`)
      return 1
    }
    if (signal.aborted) return 130
    const referral =
      text.match(/^refer:\s*(\S+)/im)?.[1] ??
      text.match(/^\s*Registrar WHOIS Server:\s*(?:whois:\/\/)?(\S+)/im)?.[1] ??
      text.match(/^ReferralServer:\s*(?:r?whois:\/\/)?([^\s:/]+)/im)?.[1]
    const following = !server && referral && !visited.has(cleanHost(referral)) && hop < 3
    // Jawaban IANA hanya penunjuk; ditampilkan hanya kalau tidak ada lanjutan.
    if (!(target.host === "whois.iana.org" && following)) {
      write(`# ${target.host}\n\n${text.trim()}\n\n`)
    }
    next = following ? cleanHost(referral) : undefined
  }
  return 0
}

// ---------------------------------------------------------------- pembatasan request

const hits = new Map()
let globalHits = []
let running = 0

function allow(client) {
  const now = Date.now()
  const windowStart = now - 60_000
  globalHits = globalHits.filter((t) => t > windowStart)
  const mine = (hits.get(client) ?? []).filter((t) => t > windowStart)
  if (mine.length >= PER_CLIENT_PER_MINUTE || globalHits.length >= GLOBAL_PER_MINUTE) {
    hits.set(client, mine)
    return false
  }
  mine.push(now)
  globalHits.push(now)
  hits.set(client, mine)
  return true
}

// Catatan client yang sudah sepi lebih dari semenit dibuang, supaya Map tidak terus membesar.
setInterval(() => {
  const windowStart = Date.now() - 60_000
  for (const [client, times] of hits) {
    if (times.every((t) => t <= windowStart)) hits.delete(client)
  }
}, 60_000).unref()

// ---------------------------------------------------------------- http

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  })
  res.end(payload)
}

/**
 * Alamat pengunjung untuk rate limit: header cf-connecting-ip (Cloudflare), x-real-ip (nginx) atau
 * x-forwarded-for. Kalau isinya bukan alamat IP, dipakai alamat koneksinya langsung.
 */
function clientOf(req) {
  const header = req.headers["cf-connecting-ip"] ?? req.headers["x-real-ip"] ?? String(req.headers["x-forwarded-for"] ?? "").split(",")[0]
  const value = String(header ?? "").trim()
  return isIP(value) ? value : (req.socket.remoteAddress ?? "unknown")
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on("data", (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new UserError("request too large", 413))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

// Setiap deretan angka hex, titik dan titik dua adalah kandidat; hanya alamat IPv4/IPv6 privat yang diganti.
const ADDRESS_LIKE = /[0-9a-f.:]{2,}(?:%[\w.-]+)?/gi
function maskPrivateAddresses(text) {
  return text.replace(ADDRESS_LIKE, (token) => (isIP(token) && isBlockedAddress(token) ? "[private]" : token))
}

/** Output dikirim sebagai server-sent events supaya lewat nginx dan Cloudflare tanpa ditahan buffer. */
function openStream(res) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store, no-transform",
    "x-accel-buffering": "no",
    "x-content-type-options": "nosniff",
  })
  let sent = 0
  return {
    write(text) {
      if (!text || sent >= MAX_OUTPUT_BYTES || res.writableEnded) return
      const room = MAX_OUTPUT_BYTES - sent
      const piece = text.length > room ? `${text.slice(0, room)}\n[output truncated]\n` : text
      sent += piece.length
      res.write(`data: ${JSON.stringify(piece)}\n\n`)
    },
    end(code) {
      if (res.writableEnded) return
      res.write(`event: done\ndata: ${JSON.stringify({ code })}\n\n`)
      res.end()
    },
  }
}

/** Menjalankan binary tanpa shell, mengalirkan stdout/stderr, dan mematikannya kalau lewat batas waktu. */
function runBinary(plan, stream, signal) {
  return new Promise((resolve) => {
    const child = spawn(BIN_DIR ? `${BIN_DIR}/${plan.bin}` : plan.bin, plan.argv, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin", LC_ALL: "C" },
    })
    const timer = setTimeout(() => child.kill("SIGKILL"), plan.deadline)
    const emit = (chunk) => stream.write(plan.maskPrivate ? maskPrivateAddresses(String(chunk)) : String(chunk))
    signal.addEventListener("abort", () => child.kill("SIGKILL"), { once: true })
    child.stdout.on("data", emit)
    child.stderr.on("data", emit)
    child.on("error", (error) => {
      clearTimeout(timer)
      stream.write(error.code === "ENOENT" ? `${plan.bin}: not installed on the server\n` : `${plan.bin}: could not be started\n`)
      stream.end(127)
      resolve()
    })
    child.on("close", (code, killedBy) => {
      clearTimeout(timer)
      if (killedBy === "SIGKILL" && !signal.aborted) stream.write(`\n${plan.bin}: stopped after ${Math.round(plan.deadline / 1000)} s\n`)
      stream.end(code ?? 137)
      resolve()
    })
  })
}

async function handleRun(req, res) {
  // Halaman dari situs lain hanya bisa mengirim request "sederhana" tanpa preflight CORS, dan API ini
  // tidak menjawab preflight. Mewajibkan JSON berarti website lain tidak bisa memicu perintah dari
  // browser pengunjungnya.
  const contentType = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase()
  if (contentType !== "application/json") return sendJson(res, 415, { error: "expected an application/json body" })
  const fetchSite = req.headers["sec-fetch-site"]
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return sendJson(res, 403, { error: "cross-site requests are not allowed" })
  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch (error) {
    return sendJson(res, error instanceof UserError ? error.status : 400, { error: error instanceof UserError ? error.message : "invalid JSON body" })
  }
  const cmd = String(body?.cmd ?? "").toLowerCase()
  const args = body?.args
  if (cmd !== "whois" && !has(builders, cmd)) return sendJson(res, 404, { error: `${cmd.slice(0, 40) || "command"}: not available on this server. Nice try.` })
  if (!Array.isArray(args) || args.length > 16 || args.some((a) => typeof a !== "string" || a.length > 255 || /[\0\r\n]/.test(a))) {
    return sendJson(res, 400, { error: "invalid arguments" })
  }
  if (args.some((a) => SHELL_TRICK.test(a))) {
    return sendJson(res, 400, { error: "Nice try: there is no shell here. Arguments go straight to the tool, so ; | & $( ` > and ../ are just characters." })
  }
  if (!allow(clientOf(req))) return sendJson(res, 429, { error: "too many requests, try again in a minute" })
  if (running >= MAX_CONCURRENT) return sendJson(res, 503, { error: "server is busy, try again in a few seconds" })

  const abort = new AbortController()
  res.on("close", () => abort.abort())

  running += 1
  try {
    if (cmd === "whois") {
      // Validasi sebelum stream dibuka, supaya kesalahan pemakaian kembali sebagai error JSON biasa.
      const subjects = args.filter((a, i) => !a.startsWith("-") && args[i - 1] !== "-h")
      if (subjects.length !== 1) throw new UserError("usage: whois [-h server] <domain|ip>")
      const stream = openStream(res)
      try {
        stream.end(await runWhois(args, stream.write, abort.signal))
      } catch (error) {
        stream.write(`whois: ${error instanceof UserError ? error.message : "lookup failed"}\n`)
        stream.end(1)
      }
      return
    }

    const plan = await builders[cmd](args)
    const stream = openStream(res)
    if (plan.banner) stream.write(plan.banner)
    await runBinary(plan, stream, abort.signal)
  } catch (error) {
    if (res.headersSent) return res.end()
    if (error instanceof UserError) return sendJson(res, error.status, { error: error.message })
    sendJson(res, 500, { error: "internal error" })
  } finally {
    running -= 1
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  if (url.pathname === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, { ok: true, commands: ["whois", ...Object.keys(builders)].sort() })
  }
  if (url.pathname === "/api/run") {
    if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" })
    return handleRun(req, res).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: "internal error" })
      else res.end()
    })
  }
  sendJson(res, 404, { error: "not found. Nice try, though." })
})

server.requestTimeout = 60_000
server.listen(PORT, HOST, () => {
  console.log(`netapi listening on http://${HOST}:${PORT}`)
})
