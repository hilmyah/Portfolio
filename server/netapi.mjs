// Backend for the portfolio terminal: runs a fixed set of real network tools on the machine
// that hosts the site and streams their output back.
//
//   POST /api/run   {"cmd": "dig", "args": ["-x", "1.1.1.1", "+short"]}
//   GET  /api/health
//
// Commands: ping, dig, nslookup, host, traceroute (system binaries) and whois (built in, TCP 43).
// No dependencies; needs Node 18+. Listens on localhost only; nginx proxies /api/ to it.
//
// This is not a shell. Anonymous visitors trigger it, so:
//   - only the commands and flags listed below are accepted; nothing is passed through a shell
//   - every host that a tool would connect to is resolved here first, and private, loopback,
//     link-local, CGNAT and multicast addresses are refused, so the LAN cannot be probed
//   - DNS tools use a public resolver unless the visitor names another public one
//   - private addresses in traceroute output are masked
//   - each run has a deadline and an output cap; requests are rate limited
import { spawn } from "node:child_process"
import { lookup } from "node:dns/promises"
import { createServer } from "node:http"
import { connect, isIP } from "node:net"

const PORT = Number(process.env.NETAPI_PORT ?? 8787)
const HOST = process.env.NETAPI_HOST ?? "127.0.0.1"
const BIN_DIR = process.env.NETAPI_BIN_DIR ?? "" // tests point this at stub binaries
const DEFAULT_RESOLVER = process.env.NETAPI_RESOLVER ?? "1.1.1.1"
// Test-only hooks: a whois port other than 43 and a host -> address map that skips the address filter.
// Leave both unset in production.
const WHOIS_PORT = Number(process.env.NETAPI_WHOIS_PORT ?? 43)
const TEST_HOSTS = process.env.NETAPI_TEST_HOSTS ? JSON.parse(process.env.NETAPI_TEST_HOSTS) : {}

const PER_CLIENT_PER_MINUTE = 12
const GLOBAL_PER_MINUTE = 120
const MAX_CONCURRENT = 4
const MAX_OUTPUT_BYTES = 96 * 1024
const MAX_BODY_BYTES = 4096

class UserError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

// ---------------------------------------------------------------- address filtering

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

function isBlockedV6(ip) {
  const lower = ip.toLowerCase()
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isBlockedV4(mapped[1])
  if (lower === "::" || lower === "::1") return true
  const first = parseInt(lower.split(":")[0] || "0", 16)
  if ((first & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true // ff00::/8 multicast
  if (lower.startsWith("::ffff:") || lower.startsWith("64:ff9b:")) return true // other v4-embedded forms
  return false
}

function isBlockedAddress(ip) {
  const family = isIP(ip)
  if (family === 4) return isBlockedV4(ip)
  if (family === 6) return isBlockedV6(ip)
  return true
}

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9-]{2,63}$/
// A DNS question may also be a single label ("com") or the root (".").
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

/** Resolves a host the tool will connect to and returns a public { address, family }. */
async function publicTarget(raw, wantFamily = 0) {
  const host = cleanHost(raw)
  if (Object.prototype.hasOwnProperty.call(TEST_HOSTS, host)) return { host, address: TEST_HOSTS[host], family: 4 }
  let addresses
  if (isIP(host)) {
    addresses = [{ address: host, family: isIP(host) }]
  } else if (HOSTNAME_RE.test(host)) {
    try {
      addresses = await lookup(host, { all: true })
    } catch {
      throw new UserError(`cannot resolve ${host}`, 422)
    }
  } else {
    throw new UserError(`'${String(raw).slice(0, 80)}' is not a valid host name or IP address`)
  }
  let usable = addresses.filter((a) => !isBlockedAddress(a.address))
  if (usable.length === 0) throw new UserError(`${host} is in a private or reserved address range`, 403)
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
  if (isBlockedAddress(ip)) throw new UserError(`${ip} is in a private or reserved address range`, 403)
  return ip
}

function intOption(value, name, min, max) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw new UserError(`${name} must be between ${min} and ${max}`)
  return n
}

// ---------------------------------------------------------------- command builders
// Each builder turns visitor arguments into { bin, argv, deadline } or throws UserError.

const RECORD_TYPES = new Set(["A", "AAAA", "ANY", "CAA", "CNAME", "DNSKEY", "DS", "MX", "NS", "PTR", "SOA", "SRV", "TXT"])
const DIG_OPTIONS = new Set([
  "short", "noall", "all", "answer", "noanswer", "authority", "noauthority", "additional", "noadditional",
  "question", "noquestion", "comments", "nocomments", "stats", "nostats", "cmd", "nocmd", "tcp", "notcp",
  "dnssec", "nodnssec", "multiline", "nomultiline", "recurse", "norecurse", "ttlid", "nottlid", "trace", "notrace",
])

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
      banner: resolved.host === resolved.address ? "" : `# ${resolved.host} resolves to ${resolved.address}\n`,
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
      deadline: argv.includes("+trace") ? 20000 : 10000,
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
      // -n: no reverse lookups (faster, and the local resolver stays out of it). One probe per hop, 1 s wait.
      argv: ["-n", resolved.family === 6 ? "-6" : "-4", "-q", "1", "-w", "1", "-m", String(maxHops), resolved.address],
      deadline: (maxHops + 6) * 1000,
      banner: resolved.host === resolved.address ? "" : `# ${resolved.host} resolves to ${resolved.address}\n`,
      maskPrivate: true,
    }
  },
}

// ---------------------------------------------------------------- whois (TCP 43, no external binary)

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

/** Follows IANA -> registry -> registrar, checking every referral host before connecting. */
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
    // The IANA answer is only a pointer; show it only when it is all there is.
    if (!(target.host === "whois.iana.org" && following)) {
      write(`# ${target.host}\n\n${text.trim()}\n\n`)
    }
    next = following ? cleanHost(referral) : undefined
  }
  return 0
}

// ---------------------------------------------------------------- rate limiting

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

const PRIVATE_V4_IN_TEXT = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
function maskPrivateAddresses(text) {
  return text.replace(PRIVATE_V4_IN_TEXT, (ip) => (isIP(ip) === 4 && isBlockedV4(ip) ? "[private]" : ip))
}

/** Output is streamed as server-sent events so it passes through nginx and Cloudflare unbuffered. */
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

async function handleRun(req, res) {
  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch (error) {
    return sendJson(res, error instanceof UserError ? error.status : 400, { error: error instanceof UserError ? error.message : "invalid JSON body" })
  }
  const cmd = String(body?.cmd ?? "").toLowerCase()
  const args = body?.args
  const known = cmd === "whois" || Object.prototype.hasOwnProperty.call(builders, cmd)
  if (!known) return sendJson(res, 404, { error: `${cmd.slice(0, 40) || "command"}: not available on this server` })
  if (!Array.isArray(args) || args.length > 16 || args.some((a) => typeof a !== "string" || a.length > 255 || /[\0\r\n]/.test(a))) {
    return sendJson(res, 400, { error: "invalid arguments" })
  }
  if (!allow(clientOf(req))) return sendJson(res, 429, { error: "too many requests, try again in a minute" })
  if (running >= MAX_CONCURRENT) return sendJson(res, 503, { error: "server is busy, try again in a few seconds" })

  const abort = new AbortController()
  res.on("close", () => abort.abort())

  running += 1
  try {
    if (cmd === "whois") {
      // Validate before the stream opens so usage errors come back as plain JSON errors.
      const probe = args.filter((a, i) => !a.startsWith("-") && args[i - 1] !== "-h")
      if (probe.length !== 1) throw new UserError("usage: whois [-h server] <domain|ip>")
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
    await new Promise((resolve) => {
      const child = spawn(BIN_DIR ? `${BIN_DIR}/${plan.bin}` : plan.bin, plan.argv, { stdio: ["ignore", "pipe", "pipe"], env: { PATH: process.env.PATH ?? "/usr/bin:/bin", LC_ALL: "C" } })
      const timer = setTimeout(() => child.kill("SIGKILL"), plan.deadline)
      const emit = (chunk) => stream.write(plan.maskPrivate ? maskPrivateAddresses(String(chunk)) : String(chunk))
      abort.signal.addEventListener("abort", () => child.kill("SIGKILL"), { once: true })
      child.stdout.on("data", emit)
      child.stderr.on("data", emit)
      child.on("error", (error) => {
        clearTimeout(timer)
        stream.write(error.code === "ENOENT" ? `${plan.bin}: not installed on the server\n` : `${plan.bin}: could not be started\n`)
        stream.end(127)
        resolve()
      })
      child.on("close", (code, signal) => {
        clearTimeout(timer)
        if (signal === "SIGKILL" && !abort.signal.aborted) stream.write(`\n${plan.bin}: stopped after ${Math.round(plan.deadline / 1000)} s\n`)
        stream.end(code ?? 137)
        resolve()
      })
    })
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
  sendJson(res, 404, { error: "not found" })
})

server.requestTimeout = 60_000
server.listen(PORT, HOST, () => {
  console.log(`netapi listening on http://${HOST}:${PORT}`)
})
