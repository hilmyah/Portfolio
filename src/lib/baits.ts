// bait: jawaban "nice try" untuk cara-cara umum orang mengutak-atik terminal sebuah website:
// sudo, rm -rf, reverse shell, scanner, karakter injeksi, payload XSS/SQL, IP privat dan file
// rahasia. Tidak ada yang dideteksi, dicatat atau dikirim ke mana pun; hanya teks output yang berubah.
// Untuk mematikannya, hapus file ini dan baris bertanda "bait:" di terminal.ts.
import { SOCIALS } from "@/data"
import type { TerminalLine, Tone } from "@/lib/terminal"

const line = (text: string, tone?: Tone, href?: string): TerminalLine => ({ text, tone, href })

let attempts = 0

/** Baris pertama setiap bait; makin sering dicoba, makin personal. */
function niceTry(): TerminalLine {
  attempts += 1
  if (attempts === 1) return line("Nice try.", "accent")
  if (attempts === 2) return line("Nice try, again.", "accent")
  if (attempts < 5) return line(`Still a portfolio. (attempt ${attempts})`, "accent")
  if (attempts === 5) return line("Attempt 5. Respect for the persistence. If you like breaking things, type 'contact' and let's talk.", "accent")
  const later = ["Nice try.", "Still nothing to break.", "Persistent, aren't we?"]
  return line(`${later[attempts % later.length]} (attempt ${attempts})`, "accent")
}

const PRIVILEGE = new Set(["sudo", "su", "doas", "passwd", "visudo"])
const DESTRUCTIVE = new Set(["rm", "rmdir", "dd", "mkfs", "shred", "chmod", "chown", "kill", "killall", "pkill", "shutdown", "reboot", "halt", "poweroff"])
const SHELLS = new Set(["bash", "sh", "zsh", "fish", "dash", "ksh", "python", "python3", "perl", "ruby", "php", "node", "exec", "eval", "source"])
const OFFENSIVE = new Set([
  "nmap", "masscan", "sqlmap", "hydra", "nikto", "gobuster", "dirb", "ffuf", "wpscan", "msfconsole", "metasploit",
  "john", "hashcat", "nc", "ncat", "netcat", "telnet", "ssh", "scp", "ftp",
])

/** Perintah yang tidak ada di terminal ini tapi biasanya dicoba pertama kali. */
export function baitForCommand(name: string, args: string[]): TerminalLine[] | null {
  const cmd = name.toLowerCase()
  const shown = [name, ...args].join(" ")
  if (PRIVILEGE.has(cmd)) {
    return [
      line(cmd === "su" ? "Password: ********" : "[sudo] password for visitor: ********"),
      line("visitor is not in the sudoers file. This incident will be reported (to /dev/null).", "error"),
      niceTry(),
    ]
  }
  if (DESTRUCTIVE.has(cmd)) {
    return [
      line(`${shown}: Read-only file system`, "error"),
      niceTry(),
      line("This filesystem is a few kilobytes of JavaScript in your own browser. Nothing to break here.", "muted"),
    ]
  }
  if (SHELLS.has(cmd)) {
    return [
      niceTry(),
      line(`There is no ${cmd} behind this prompt. Every command here is a small function running in your browser.`, "muted"),
    ]
  }
  if (OFFENSIVE.has(cmd)) {
    return [
      niceTry(),
      line(`${cmd}: not installed, and it never will be. The only open port on this terminal is 'help'.`, "muted"),
    ]
  }
  return null
}

const PAYLOADS: { pattern: RegExp; note: string }[] = [
  { pattern: /:\(\)\s*\{/, note: "Fork bomb defused. This terminal cannot fork, it can barely ping." },
  { pattern: /<\s*\/?\s*(script|img|svg|iframe)\b|javascript:|\bon(error|load)\s*=|\balert\s*\(/i, note: "Everything here is printed as plain text. No HTML, no scripts." },
  { pattern: /['"]\s*(or|and)\s+['"]?\d+['"]?\s*=\s*['"]?\d+|\bunion\s+(all\s+)?select\b|\bdrop\s+table\b|;\s*--/i, note: "There is no database behind this terminal. Not even a small one." },
  { pattern: /\$\{jndi:|\{\{\s*\d+\s*\*\s*\d+\s*\}\}|\$\{\s*\d+\s*\*\s*\d+\s*\}/i, note: "No Java, no template engine. Just text." },
]

/** Payload satu baris penuh: XSS, SQL injection, template injection, fork bomb. */
export function baitForPayload(input: string): TerminalLine[] | null {
  const hit = PAYLOADS.find(({ pattern }) => pattern.test(input))
  return hit ? [niceTry(), line(hit.note, "muted")] : null
}

/** Operator shell yang tidak didukung parser (; && || $( ` > <). */
export function baitForOperator(operator: string): TerminalLine[] {
  return [
    niceTry(),
    line(`There is no shell to inject into: '${operator}' is just a character here.`, "muted"),
    line("Pipes into grep, head, tail, sort, uniq and wc do work, e.g. whois hilmyah.my.id | grep -i server", "muted"),
  ]
}

const SECRET_PATH = /^\/(etc\/(shadow|sudoers|ssh)|root|proc|sys|var\/log|boot)(\/|$)|(^|\/)(\.env(\..*)?|\.git|\.ssh|\.aws|\.bash_history|id_rsa|id_ed25519|wp-config\.php|config\.php|\.htpasswd)(\/|$)/i

/** cat/cd/ls ke file yang selalu dicari penyerang. Hanya dipanggil kalau path-nya memang tidak ada. */
export function baitForPath(cmd: string, input: string, resolved: string): TerminalLine[] | null {
  if (resolved === "/etc/passwd") {
    return [
      line("root:x:0:0:nice try:/root:/usr/sbin/nologin"),
      line("visitor:x:1000:1000:that is you:/home/visitor:/bin/portfolio"),
      niceTry(),
      line("This file is as real as the rest of this filesystem: it is generated in your browser.", "muted"),
    ]
  }
  if (SECRET_PATH.test(resolved)) {
    return [
      line(`${cmd}: ${input}: Permission denied`, "error"),
      niceTry(),
      SOCIALS.github
        ? line(`A static portfolio has no secrets to find. The source is public anyway: ${SOCIALS.github}`, "muted", SOCIALS.github)
        : line("A static portfolio has no secrets to find.", "muted"),
    ]
  }
  return null
}

const PRIVATE_V4 = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/

/** Perintah jaringan yang diarahkan ke jaringan server sendiri (gaya SSRF). Server juga menolaknya. */
export function baitForNetworkTarget(cmd: string, args: string[]): TerminalLine[] | null {
  const target = args.find((a) => {
    const host = a.replace(/^@/, "").replace(/^\[|\]$/g, "").toLowerCase()
    return host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^(fe80|fc|fd)[0-9a-f]*:/.test(host) || PRIVATE_V4.test(host)
  })
  if (!target) return null
  return [
    niceTry(),
    line(`${cmd}: ${target.replace(/^@/, "")} is on a private network. The network behind this server is off limits.`, "muted"),
  ]
}
