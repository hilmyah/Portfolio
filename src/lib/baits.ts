// bait: jawaban "nice try" untuk cara-cara umum orang mengutak-atik terminal sebuah website:
// sudo, rm -rf, reverse shell, scanner, karakter injeksi, payload XSS/SQL dan IP privat. Perintah
// file (ls, cd, cat, pwd, tree) dijawab sama, karena terminal ini tidak punya filesystem.
// Tidak ada yang dideteksi, dicatat atau dikirim ke mana pun; hanya teks output yang berubah.
// Untuk mematikannya, hapus file ini dan baris bertanda "bait:" di terminal.ts.
import type { TerminalLine, Tone } from "@/lib/terminal"

const line = (text: string, tone?: Tone): TerminalLine => ({ text, tone })

export const niceTry = (): TerminalLine[] => [line("Nice try.", "accent")]

const PRIVILEGE = new Set(["sudo", "su", "doas", "passwd", "visudo"])
const DESTRUCTIVE = new Set(["rm", "rmdir", "dd", "mkfs", "shred", "chmod", "chown", "kill", "killall", "pkill", "shutdown", "reboot", "halt", "poweroff"])
const SHELLS = new Set(["bash", "sh", "zsh", "fish", "dash", "ksh", "python", "python3", "perl", "ruby", "php", "node", "exec", "eval", "source"])
const OFFENSIVE = new Set([
  "nmap", "masscan", "sqlmap", "hydra", "nikto", "gobuster", "dirb", "ffuf", "wpscan", "msfconsole", "metasploit",
  "john", "hashcat", "nc", "ncat", "netcat", "telnet", "ssh", "scp", "ftp",
])
const FILES = new Set(["ls", "cd", "cat", "pwd", "tree"])

/** Perintah yang tidak ada di terminal ini tapi biasanya dicoba pertama kali. */
export function baitForCommand(name: string, args: string[]): TerminalLine[] | null {
  const cmd = name.toLowerCase()
  if (PRIVILEGE.has(cmd)) {
    return [
      line(cmd === "su" ? "Password: ********" : "[sudo] password for visitor: ********"),
      line("visitor is not in the sudoers file. This incident will be reported.", "error"),
      ...niceTry(),
    ]
  }
  if (DESTRUCTIVE.has(cmd)) return [line(`${[name, ...args].join(" ")}: Read-only file system`, "error"), ...niceTry()]
  if (SHELLS.has(cmd) || OFFENSIVE.has(cmd) || FILES.has(cmd)) return niceTry()
  return null
}

const PAYLOADS: RegExp[] = [
  /:\(\)\s*\{/,
  /<\s*\/?\s*(script|img|svg|iframe)\b|javascript:|\bon(error|load)\s*=|\balert\s*\(/i,
  /['"]\s*(or|and)\s+['"]?\d+['"]?\s*=\s*['"]?\d+|\bunion\s+(all\s+)?select\b|\bdrop\s+table\b|;\s*--/i,
  /\$\{jndi:|\{\{\s*\d+\s*\*\s*\d+\s*\}\}|\$\{\s*\d+\s*\*\s*\d+\s*\}/i,
]

/** Payload satu baris penuh: XSS, SQL injection, template injection, fork bomb. */
export function baitForPayload(input: string): TerminalLine[] | null {
  return PAYLOADS.some((pattern) => pattern.test(input)) ? niceTry() : null
}

const PRIVATE_V4 = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/

/** Perintah jaringan yang diarahkan ke jaringan server sendiri (gaya SSRF). Server juga menolaknya. */
export function baitForNetworkTarget(args: string[]): TerminalLine[] | null {
  const hit = args.some((a) => {
    const host = a.replace(/^@/, "").replace(/^\[|\]$/g, "").toLowerCase()
    return host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^(fe80|fc|fd)[0-9a-f]*:/.test(host) || PRIVATE_V4.test(host)
  })
  return hit ? niceTry() : null
}
