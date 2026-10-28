// Semua isi portfolio ada di file ini: profil, lagu, tools, project, sosial media dan daftar
// perintah terminal. Komponen dan terminal hanya membaca dari sini.
//
// Gambar ada di src/assets/ dan di-import di bawah; saat build namanya diberi hash, jadi browser
// boleh menyimpannya setahun. Ganti gambar cukup dengan menimpa filenya. Ikon tools ada di
// src/assets/tools/ dan di TOOLS cukup ditulis nama filenya.
//
// Domain dan sosial media ada di src/site.ts (juga dibaca saat build). Data terstruktur untuk mesin
// pencari dibuat otomatis dari file ini saat build (src/prerender.tsx). Ringkasan untuk AI di
// public/llms.txt masih ditulis manual: samakan kalau profil atau project berubah.
import albumArt from "@/assets/img/album1.svg"
import proj1 from "@/assets/img/proj1.svg"
import proj2 from "@/assets/img/proj2.svg"
import proj3 from "@/assets/img/proj3.svg"
import proj4 from "@/assets/img/proj4.svg"
import photo from "@/assets/me.webp"

export { SITE_DOMAIN, SITE_URL, SOCIALS } from "@/site"
export type { Social } from "@/site"

export type Profile = {
  name: string
  /** Nama pengguna yang dipakai di banyak akun (GitHub, LinkedIn). */
  handle: string
  role: string
  tagline: string
  photo: { src: string; width: number; height: number; alt: string }
}

export type Song = {
  id: number
  title: string
  artist: string
  src: string
  albumArt: string
  /** Kosong: music player menampilkan kutipan bawaan. */
  lyric?: string
}

/** icon: nama file di src/assets/tools/ tanpa .svg. */
export type Tool = { name: string; icon: string }

export type Project = {
  id: string
  folder: string
  name: string
  description: string
  tags: string[]
  tech: string[]
  thumbnail?: string
  role?: string
  status?: string
  repo?: string
  demo?: string
}

export type CommandGroup = "portfolio" | "files" | "network" | "shell"

export type TerminalCommand = {
  command: string
  description: string
  group: CommandGroup
  usage?: string
  examples?: string[]
}

export const PROFILE: Profile = {
  name: "Hilmy Adhyandra Hamzah",
  handle: "hilmyah",
  role: "Infrastructure & Systems",
  tagline: "Linux • Self-hosting • Networking • Automation",
  photo: {
    src: photo,
    width: 420,
    height: 540,
    alt: "Hilmy Adhyandra Hamzah",
  },
}

export const ABOUT = {
  bio: "I build and manage self-hosted infrastructure that is stable, efficient, and practical. I focus on open-source solutions and system management that simplify daily life. Less overhead, more control.",
  motto: "embrace open-source, operate cost-effectively, maintain efficiently.",
}

export const SONGS: Song[] = [
  {
    id: 1,
    title: "Growtopia Theme",
    artist: "Cory Mollenhour",
    src: "/audio/theme.mp3",
    albumArt,
    lyric: "",
  },
]

export const TOOLS: Tool[] = [
  { name: "Linux", icon: "linux" },
  { name: "Bash", icon: "bash" },
  { name: "Debian", icon: "debian" },
  { name: "Ubuntu", icon: "ubuntu" },
  { name: "Kali Linux", icon: "kalilinux" },
  { name: "Fedora", icon: "fedora" },
  { name: "Windows", icon: "windows" },
  { name: "VS Code", icon: "vscode" },
  { name: "Git", icon: "git" },
  { name: "Github", icon: "github" },
  { name: "Docker", icon: "docker" },
  { name: "MySQL", icon: "mysql" },
  { name: "MariaDB", icon: "mariadb" },
  { name: "MongoDB", icon: "mongo" },
  { name: "Apache", icon: "apache" },
  { name: "Nginx", icon: "nginx" },
  { name: "KDE", icon: "kde" },
  { name: "VirtualBox", icon: "virtualbox" },
  { name: "VMware", icon: "vmware" },
  { name: "Mikrotik", icon: "mikrotik" },
  { name: "Cloudflare", icon: "cloudflare" },
]

export const PROJECTS: Project[] = [
  {
    id: "1",
    folder: "Infrastructure",
    thumbnail: proj1,
    name: "Bedrock Server",
    description:
      "Minecraft Bedrock server setup for Debian and Ubuntu, exposed through a Playit.gg tunnel so it needs no static IP or port forwarding. Ships a one-command installer, a management CLI for start, stop, backup and restore, automatic binary updates, and a systemd service.",
    tags: ["linux", "self-hosting", "automation"],
    tech: ["Debian", "Bash", "systemd", "Playit.gg"],
    role: "Infrastructure",
    status: "Active",
    repo: "https://github.com/hilmyah/bedrock-server",
  },
  {
    id: "2",
    folder: "Infrastructure",
    thumbnail: proj2,
    name: "Jarchive Infrastructure",
    description:
      "Docker Compose setup that runs the Jarchive platform on a single host: a React and Vite frontend served by Nginx, a Node.js and Express backend, and MongoDB.",
    tags: ["docker", "infrastructure"],
    tech: ["Docker", "Docker Compose", "Nginx", "MongoDB"],
    repo: "https://github.com/siJarchive/jarchive-infrastructure",
  },
  {
    id: "3",
    folder: "Security",
    thumbnail: proj3,
    name: "Sijacrypt",
    description:
      "File encryption tool (MFCIPHER) that compresses and encrypts any file type with Ternary Huffman Coding and a ternary stream cipher, using an output alphabet of three characters. Implemented in C, Go, Python and Rust with interoperable output, plus a CustomTkinter GUI.",
    tags: ["security", "cryptography"],
    tech: ["Python", "C", "Go", "Rust"],
    repo: "https://github.com/hilmyah/sijacrypt",
  },
  {
    id: "4",
    folder: "IoT",
    thumbnail: proj4,
    name: "Growmate",
    description:
      "Smart irrigation system on a WEMOS D1 Mini (ESP8266) that waters plants based on soil moisture readings, with an LCD display, a web dashboard, Blynk integration and OTA firmware updates.",
    tags: ["iot", "automation"],
    tech: ["ESP8266", "C++", "Arduino", "Blynk"],
    repo: "https://github.com/hilmyah/Growmate",
  },
  {
    id: "5",
    folder: "IoT",
    thumbnail: proj1,
    name: "Growbot",
    description:
      "WhatsApp and Telegram gateway for Growmate, built with Node.js and Express. Lets users monitor soil moisture and control watering through chat commands.",
    tags: ["iot", "automation"],
    tech: ["Node.js", "Express", "Telegram Bot API", "Fonnte"],
    repo: "https://github.com/hilmyah/Growbot",
  },
]

export const PROJECT_TAGS = [...new Set(PROJECTS.flatMap((project) => project.tags))].sort()

// Prompt terminal (visitor@hilmyah:~$), juga dipakai pesan 404 di halaman utama.
export const PROMPT_USER = "visitor"
export const PROMPT_HOST = "hilmyah"

export const TERMINAL_COMMANDS: TerminalCommand[] = [
  { command: "about", group: "portfolio", description: "About Hilmy" },
  { command: "fetch", group: "portfolio", description: "Show portfolio information" },
  { command: "projects", group: "portfolio", description: "List projects", usage: "projects [tag]", examples: ["projects", "projects iot"] },
  { command: "project", group: "portfolio", description: "Show project details", usage: "project <id|name>", examples: ["project sijacrypt"] },
  { command: "open", group: "portfolio", description: "Open a project repository", usage: "open <id|name>", examples: ["open bedrock-server"] },
  { command: "tools", group: "portfolio", description: "Show tools and technologies" },
  { command: "contact", group: "portfolio", description: "Show contact information" },

  { command: "ls", group: "files", description: "List files", usage: "ls [-l] [dir]", examples: ["ls -l", "ls projects"] },
  { command: "cd", group: "files", description: "Change directory", usage: "cd [dir]", examples: ["cd projects", "cd .."] },
  { command: "cat", group: "files", description: "Print a file", usage: "cat <file>...", examples: ["cat about.md", "cat projects/sijacrypt.md"] },
  { command: "pwd", group: "files", description: "Print current directory" },
  { command: "tree", group: "files", description: "Show the file tree", usage: "tree [dir]" },

  { command: "ping", group: "network", description: "Ping a host (ICMP, sent from the server)", usage: "ping [-c count] [-4|-6] <host>", examples: ["ping -c 3 github.com"] },
  { command: "dig", group: "network", description: "Query DNS records", usage: "dig [@server] [-x ip] [-t type] <name> [type] [+options]", examples: ["dig hilmyah.my.id MX", "dig -x 1.1.1.1 @8.8.8.8 +short"] },
  { command: "nslookup", group: "network", description: "Query DNS records", usage: "nslookup [-type=TYPE] <name|ip> [server]", examples: ["nslookup -type=MX hilmyah.my.id"] },
  { command: "host", group: "network", description: "Query DNS records", usage: "host [-t TYPE] <name|ip> [server]", examples: ["host -t NS hilmyah.my.id"] },
  { command: "whois", group: "network", description: "Look up domain or IP registration", usage: "whois [-h server] <domain|ip>", examples: ['whois hilmyah.my.id | grep -i "name server"'] },
  { command: "traceroute", group: "network", description: "Trace the route to a host", usage: "traceroute [-m hops] [-4|-6] <host>", examples: ["traceroute -m 15 1.1.1.1"] },
  { command: "myip", group: "network", description: "Show your public IP, country and the Cloudflare location serving you" },

  { command: "help", group: "shell", description: "List commands, or explain one", usage: "help [command]", examples: ["help dig"] },
  { command: "theme", group: "shell", description: "Switch light or dark theme", usage: "theme [dark|light]" },
  { command: "clear", group: "shell", description: "Clear the screen" },
]
