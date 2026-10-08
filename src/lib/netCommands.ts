// Network commands for the terminal.
//
// When the site's backend is deployed (server/netapi.mjs behind /api/), ping, dig, whois, nslookup,
// host, traceroute and curl run on the server, with their usual flags, and the output
// is streamed here line by line.
//
// Without a backend (static hosting, dev server without a proxy) three of them still work from the
// visitor's browser, with fewer options:
//   dig    -> DNS over HTTPS (dns.google, falling back to cloudflare-dns.com)
//   whois  -> RDAP over HTTPS (rdap.org redirects to the authoritative registry)
//   ping   -> timed HTTPS HEAD requests (browsers cannot send ICMP)
import type { CommandContext, TerminalLine, TerminalResult, Tone } from "@/lib/terminal"

export const REMOTE_COMMANDS = ["ping", "dig", "whois", "nslookup", "host", "traceroute", "curl"] as const
export type RemoteCommand = (typeof REMOTE_COMMANDS)[number]

const line = (text: string, tone?: Tone, href?: string): TerminalLine => ({ text, tone, href })
const blank = (): TerminalLine => ({ text: "" })
const pad = (value: string, width: number) => (value.length >= width ? value : value + " ".repeat(width - value.length))

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9-]{2,63}$/
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const IPV6_RE = /^[0-9a-f:]+$/

/** Accepts "example.com", "https://example.com/path" or "example.com." and returns the bare host. */
function cleanHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
}

const isIp = (host: string) => IPV4_RE.test(host) || (host.includes(":") && IPV6_RE.test(host))
const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError"
const interrupted = (): TerminalResult => ({ lines: [line("^C", "muted")] })

/** fetch() that gives up after timeoutMs and also stops when the terminal aborts the command. */
async function timedFetch(url: string, init: RequestInit, signal: AbortSignal, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal.addEventListener("abort", onAbort)
  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError")
    if (timedOut) throw new Error("timeout")
    throw error
  } finally {
    window.clearTimeout(timer)
    signal.removeEventListener("abort", onAbort)
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"))
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

// ---------------------------------------------------------------- server-side execution

type ServerOutcome =
  | { kind: "done"; result: TerminalResult }
  | { kind: "unavailable"; note?: string; reason?: string }

// After a miss the backend is not asked again for a while, so static hosting does not pay a request per command.
const BACKEND_RETRY_MS = 60_000
let backendMissingSince = 0

/** Comment lines of dig/whois output are dimmed, like a syntax-highlighting terminal would. */
const outputLine = (text: string): TerminalLine => line(text, /^\s*(;|#|%|>>>)/.test(text) ? "muted" : undefined)

async function runOnServer(cmd: RemoteCommand, args: string[], ctx: CommandContext): Promise<ServerOutcome> {
  if (Date.now() - backendMissingSince < BACKEND_RETRY_MS) return { kind: "unavailable" }

  let response: Response
  try {
    response = await timedFetch(
      "/api/run",
      {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream, application/json" },
        body: JSON.stringify({ cmd, args }),
        cache: "no-store",
      },
      ctx.signal,
      15000
    )
  } catch (error) {
    if (isAbort(error)) return { kind: "done", result: interrupted() }
    return { kind: "unavailable" }
  }

  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    let reason = `HTTP ${response.status}`
    try {
      const data = (await response.json()) as { error?: string }
      if (data.error) reason = data.error
    } catch {
      // keep the status text
    }
    // 400, 403 and 422 are verdicts on the arguments and are final. The rest means "not right now".
    if (response.status === 400 || response.status === 403 || response.status === 422) {
      return { kind: "done", result: { lines: [line(reason, "error")] } }
    }
    return { kind: "unavailable", reason, note: `Server backend unavailable (${reason}).` }
  }

  if (!response.ok || !contentType.includes("text/event-stream") || !response.body) {
    backendMissingSince = Date.now()
    return { kind: "unavailable" }
  }

  // Server-sent events: "data: <json string>" chunks of output, then "event: done".
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let events = ""
  let partial = ""
  const flushLines = (final: boolean) => {
    const parts = partial.split("\n")
    partial = final ? "" : (parts.pop() ?? "")
    const ready = final && parts[parts.length - 1] === "" ? parts.slice(0, -1) : parts
    if (ready.length) ctx.print(ready.map((text) => outputLine(text.replace(/\r$/, ""))))
  }
  const onAbort = () => void reader.cancel().catch(() => undefined)
  ctx.signal.addEventListener("abort", onAbort, { once: true })
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      events += decoder.decode(value, { stream: true })
      let boundary: number
      while ((boundary = events.indexOf("\n\n")) >= 0) {
        const event = events.slice(0, boundary)
        events = events.slice(boundary + 2)
        const data = event.split("\n").find((l) => l.startsWith("data: "))
        if (!data || event.startsWith("event: done")) continue
        try {
          partial += String(JSON.parse(data.slice(6)))
        } catch {
          continue
        }
        flushLines(false)
      }
    }
  } catch {
    // connection dropped; whatever arrived is already on screen
  } finally {
    ctx.signal.removeEventListener("abort", onAbort)
  }
  flushLines(true)
  return { kind: "done", result: ctx.signal.aborted ? interrupted() : { lines: [] } }
}

// ---------------------------------------------------------------- browser fallback: dig

const RECORD_TYPES: Record<string, number> = {
  A: 1, NS: 2, CNAME: 5, SOA: 6, PTR: 12, MX: 15, TXT: 16, AAAA: 28, SRV: 33, CAA: 257,
}
const TYPE_NAMES: Record<number, string> = Object.fromEntries(Object.entries(RECORD_TYPES).map(([k, v]) => [v, k]))
const RCODES: Record<number, string> = { 0: "NOERROR", 1: "FORMERR", 2: "SERVFAIL", 3: "NXDOMAIN", 4: "NOTIMP", 5: "REFUSED" }

type DnsRecord = { name: string; type: number; TTL?: number; data: string }
type DnsResponse = { Status: number; Answer?: DnsRecord[]; Authority?: DnsRecord[] }

const DOH_RESOLVERS = [
  { label: "dns.google", url: (name: string, type: string) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}` },
  { label: "cloudflare-dns.com", url: (name: string, type: string) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}` },
]

function recordLines(records: DnsRecord[]): TerminalLine[] {
  const nameWidth = Math.max(...records.map((r) => r.name.length)) + 2
  return records.map((r) =>
    line(`${pad(r.name, nameWidth)}${pad(String(r.TTL ?? ""), 7)}IN  ${pad(TYPE_NAMES[r.type] ?? `TYPE${r.type}`, 6)}${r.data}`)
  )
}

async function digInBrowser(args: string[], ctx: CommandContext): Promise<TerminalResult> {
  let type: string | undefined
  let name = ""
  let short = false
  let ignored = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "-x") {
      const ip = cleanHost(args[++i] ?? "")
      if (!IPV4_RE.test(ip)) return { lines: [line("dig: -x needs an IPv4 address when the server backend is not available", "error")] }
      name = `${ip.split(".").reverse().join(".")}.in-addr.arpa`
      type = "PTR"
    } else if (a === "-t") type = (args[++i] ?? "").toUpperCase()
    else if (a.toLowerCase() === "+short") short = true
    else if (a.startsWith("@") || a.startsWith("+") || a.startsWith("-")) ignored = true
    else if (!type && Object.prototype.hasOwnProperty.call(RECORD_TYPES, a.toUpperCase())) type = a.toUpperCase()
    else if (!name) name = cleanHost(a)
    else return { lines: [line("usage: dig [@server] [-x ip] <domain> [type] [+short]", "error")] }
  }
  type = type ?? "A"
  if (!name) {
    return {
      lines: [
        line("usage: dig [@server] [-x ip] <domain> [type] [+short]", "error"),
        line(`Types: ${Object.keys(RECORD_TYPES).join(", ")}`, "muted"),
      ],
    }
  }
  if (!HOSTNAME_RE.test(name)) return { lines: [line(`dig: '${name}' is not a valid domain name`, "error")] }
  if (!Object.prototype.hasOwnProperty.call(RECORD_TYPES, type)) return { lines: [line(`dig: record type '${type}' is not supported`, "error")] }
  if (ignored) ctx.print([line("Server backend not reachable: using DNS over HTTPS from your browser, so @server and most options are ignored.", "muted")])

  let lastError = ""
  for (const resolver of DOH_RESOLVERS) {
    const started = performance.now()
    try {
      const response = await timedFetch(resolver.url(name, type), { headers: { accept: "application/dns-json" } }, ctx.signal, 8000)
      if (!response.ok) {
        lastError = `${resolver.label} answered HTTP ${response.status}`
        continue
      }
      const data = (await response.json()) as DnsResponse
      if (short) return { lines: (data.Answer ?? []).map((r) => line(r.data)) }

      const elapsed = Math.round(performance.now() - started)
      const status = RCODES[data.Status] ?? `RCODE${data.Status}`
      const out: TerminalLine[] = [line(`;; QUESTION: ${name}. IN ${type}`, "muted")]
      out.push(line(`;; status: ${status}`, data.Status === 0 ? "success" : "error"))
      if (data.Answer?.length) {
        out.push(blank(), ...recordLines(data.Answer))
      } else if (data.Status === 0) {
        out.push(blank(), line(`No ${type} record for ${name}.`))
      }
      if (!data.Answer?.length && data.Authority?.length) {
        out.push(blank(), line(";; AUTHORITY:", "muted"), ...recordLines(data.Authority))
      }
      out.push(blank(), line(`;; resolver: ${resolver.label} (DNS over HTTPS), ${elapsed} ms`, "muted"))
      return { lines: out }
    } catch (error) {
      if (isAbort(error)) return interrupted()
      lastError = `${resolver.label} could not be reached`
    }
  }
  return { lines: [line(`dig: lookup failed (${lastError})`, "error")] }
}

// ---------------------------------------------------------------- browser fallback: whois

type RdapEvent = { eventAction?: string; eventDate?: string }
type RdapEntity = { roles?: string[]; handle?: string; vcardArray?: [string, unknown[][]]; entities?: RdapEntity[] }
type RdapObject = {
  ldhName?: string
  unicodeName?: string
  handle?: string
  name?: string
  type?: string
  country?: string
  startAddress?: string
  endAddress?: string
  status?: string[]
  events?: RdapEvent[]
  entities?: RdapEntity[]
  nameservers?: { ldhName?: string }[]
  secureDNS?: { delegationSigned?: boolean }
  cidr0_cidrs?: { v4prefix?: string; v6prefix?: string; length?: number }[]
}

function vcardValue(entity: RdapEntity | undefined, field: string): string | undefined {
  const properties = entity?.vcardArray?.[1]
  if (!Array.isArray(properties)) return undefined
  const match = properties.find((p) => Array.isArray(p) && p[0] === field)
  const value = match?.[3]
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function findEntity(entities: RdapEntity[] | undefined, role: string): RdapEntity | undefined {
  for (const entity of entities ?? []) {
    if (entity.roles?.includes(role)) return entity
    const nested = findEntity(entity.entities, role)
    if (nested) return nested
  }
  return undefined
}

function eventDate(events: RdapEvent[] | undefined, action: string): string | undefined {
  const date = events?.find((e) => e.eventAction === action)?.eventDate
  if (!date) return undefined
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? date : `${parsed.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

function field(label: string, value: string | undefined, tone?: Tone): TerminalLine[] {
  return value ? [line(`${pad(label, 14)}${value}`, tone)] : []
}

function describeDomain(data: RdapObject): TerminalLine[] {
  const registrar = findEntity(data.entities, "registrar")
  const nameservers = (data.nameservers ?? []).map((n) => n.ldhName?.toLowerCase()).filter((n): n is string => Boolean(n))
  return [
    ...field("domain", (data.unicodeName ?? data.ldhName)?.toLowerCase(), "accent"),
    ...field("status", data.status?.join(", ")),
    ...field("registrar", vcardValue(registrar, "fn")),
    ...field("registered", eventDate(data.events, "registration")),
    ...field("expires", eventDate(data.events, "expiration")),
    ...field("updated", eventDate(data.events, "last changed")),
    ...nameservers.map((ns) => line(`${pad("name server", 14)}${ns}`)),
    ...field("dnssec", data.secureDNS ? (data.secureDNS.delegationSigned ? "signed" : "unsigned") : undefined),
  ]
}

function describeNetwork(data: RdapObject): TerminalLine[] {
  const cidrs = (data.cidr0_cidrs ?? [])
    .map((c) => `${c.v4prefix ?? c.v6prefix ?? ""}/${c.length ?? ""}`)
    .filter((c) => c.length > 1)
  const range = data.startAddress && data.endAddress ? `${data.startAddress} - ${data.endAddress}` : data.handle
  const abuse = findEntity(data.entities, "abuse")
  return [
    ...field("network", data.name, "accent"),
    ...field("range", range),
    ...field("cidr", cidrs.join(", ") || undefined),
    ...field("type", data.type),
    ...field("country", data.country),
    ...field("organization", vcardValue(findEntity(data.entities, "registrant"), "fn")),
    ...field("abuse", vcardValue(abuse, "email") ?? vcardValue(abuse, "fn")),
    ...field("registered", eventDate(data.events, "registration")),
    ...field("updated", eventDate(data.events, "last changed")),
  ]
}

async function whoisInBrowser(args: string[], ctx: CommandContext): Promise<TerminalResult> {
  const positional: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-h") i++
    else if (!args[i].startsWith("-")) positional.push(args[i])
  }
  const target = positional[0] ? cleanHost(positional[0]) : ""
  if (!target || positional.length > 1) return { lines: [line("usage: whois [-h server] <domain|ip>", "error")] }

  const ip = isIp(target)
  if (!ip && !HOSTNAME_RE.test(target)) return { lines: [line(`whois: '${positional[0]}' is not a valid domain or IP address`, "error")] }

  // A registry only knows the registered name, so "www.example.com" is retried as "example.com".
  const candidates = [target]
  if (!ip) {
    const labels = target.split(".")
    for (let i = 1; labels.length - i >= 2 && candidates.length < 4; i++) candidates.push(labels.slice(i).join("."))
  }

  let lastUrl = ""
  for (const candidate of candidates) {
    lastUrl = `https://rdap.org/${ip ? "ip" : "domain"}/${encodeURIComponent(candidate)}`
    try {
      const response = await timedFetch(lastUrl, { headers: { accept: "application/rdap+json, application/json" } }, ctx.signal, 12000)
      if (response.status === 404) continue
      if (!response.ok) {
        return { lines: [line(`whois: registry answered HTTP ${response.status}`, "error"), line(lastUrl, "muted", lastUrl)] }
      }
      const data = (await response.json()) as RdapObject
      const details = ip ? describeNetwork(data) : describeDomain(data)
      if (details.length === 0) return { lines: [line("whois: the registry returned no usable data", "error"), line(lastUrl, "muted", lastUrl)] }
      let source = "rdap.org"
      try {
        source = new URL(response.url).hostname
      } catch {
        // keep the default label
      }
      return { lines: [...details, blank(), line(`source: ${source} (RDAP summary, fetched by your browser)`, "muted")] }
    } catch (error) {
      if (isAbort(error)) return interrupted()
      return {
        lines: [
          line("whois: lookup failed (the registry could not be reached from this browser)", "error"),
          line(lastUrl, "muted", lastUrl),
        ],
      }
    }
  }
  return {
    lines: [
      line(`whois: no record found for ${target}`, "error"),
      line("The name may be unregistered, or its registry may not publish RDAP data.", "muted"),
    ],
  }
}

// ---------------------------------------------------------------- browser fallback: ping

const PING_TIMEOUT_MS = 5000
const PING_INTERVAL_MS = 700

async function pingInBrowser(args: string[], ctx: CommandContext): Promise<TerminalResult> {
  let count = 4
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-c") count = Number(args[++i])
    else if (/^-c\d+$/.test(args[i])) count = Number(args[i].slice(2))
    else if (!args[i].startsWith("-")) rest.push(args[i])
  }
  const host = rest[0] ? cleanHost(rest[0]) : ""

  if (!host || rest.length > 1 || !Number.isInteger(count) || count < 1 || count > 10) {
    return {
      lines: [
        line("usage: ping [-c count] <host>", "error"),
        line("count: 1 to 10 (default 4)", "muted"),
      ],
    }
  }
  if (!HOSTNAME_RE.test(host) && !isIp(host)) return { lines: [line(`ping: '${rest[0]}' is not a valid host`, "error")] }

  const url = `https://${host.includes(":") ? `[${host}]` : host}/`
  const times: number[] = []
  let sent = 0

  const summary = (): TerminalLine[] => {
    const lost = sent - times.length
    const out: TerminalLine[] = [
      blank(),
      line(`--- ${host} ping statistics ---`, "muted"),
      line(`${sent} ${sent === 1 ? "request" : "requests"} sent, ${times.length} answered, ${sent ? Math.round((lost / sent) * 100) : 0}% loss`),
    ]
    if (times.length) {
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      out.push(line(`min/avg/max = ${Math.min(...times)}/${avg}/${Math.max(...times)} ms`))
    } else if (sent) {
      out.push(line("No answer over HTTPS. This method only sees hosts that serve HTTPS on port 443; a bare IP address almost never does.", "muted"))
    }
    return out
  }

  ctx.print([
    line(`PING ${host} over HTTPS (port 443)`, "accent"),
    line("Server backend not reachable, so this is measured from your browser with HTTPS HEAD requests, not ICMP.", "muted"),
  ])

  try {
    for (let seq = 1; seq <= count; seq++) {
      if (seq > 1) await sleep(PING_INTERVAL_MS, ctx.signal)
      sent += 1
      const started = performance.now()
      try {
        await timedFetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" }, ctx.signal, PING_TIMEOUT_MS)
        const elapsed = Math.max(1, Math.round(performance.now() - started))
        times.push(elapsed)
        ctx.print([line(`response from ${host}: seq=${seq} time=${elapsed} ms`)])
      } catch (error) {
        if (isAbort(error)) throw error
        const elapsed = Math.round(performance.now() - started)
        ctx.print([line(`seq=${seq} ${elapsed >= PING_TIMEOUT_MS - 50 ? "timed out" : "no response"}`, "error")])
      }
    }
  } catch (error) {
    if (!isAbort(error)) throw error
    return { lines: [line("^C", "muted"), ...summary()] }
  }
  return { lines: summary() }
}

// ---------------------------------------------------------------- entry point

const BROWSER_FALLBACKS: Partial<Record<RemoteCommand, (args: string[], ctx: CommandContext) => Promise<TerminalResult>>> = {
  dig: digInBrowser,
  whois: whoisInBrowser,
  ping: pingInBrowser,
}

/** Returns the terminal handler for one network command: server first, browser fallback second. */
export function networkCommand(cmd: RemoteCommand) {
  return async (args: string[], ctx: CommandContext): Promise<TerminalResult> => {
    const outcome = await runOnServer(cmd, args, ctx)
    if (outcome.kind === "done") return outcome.result

    const fallback = BROWSER_FALLBACKS[cmd]
    if (!fallback) {
      return {
        lines: [
          line(`${cmd}: needs the site's server backend, which is not reachable right now${outcome.reason ? ` (${outcome.reason})` : ""}.`, "error"),
        ],
      }
    }
    if (outcome.note) ctx.print([line(outcome.note, "muted")])
    return fallback(args, ctx)
  }
}
