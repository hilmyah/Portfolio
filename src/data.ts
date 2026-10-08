export type Profile = {
  name: string
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
  length?: string
  lyric?: string
}

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

export type Social = {
  email?: string
  github?: string
  linkedin?: string
  instagram?: string
  facebook?: string
}

export const PROFILE: Profile = {
  name: "Hilmy Adhyandra Hamzah",
  role: "Infrastructure & Systems",
  tagline: "Linux • Self-hosting • Networking • Automation",
  photo: {
    src: "/placeholder/me.webp",
    width: 420,
    height: 540,
    alt: "Hilmy Adhyandra Hamzah",
  },
}

export const ABOUT = {
  bio: "I build and manage self-hosted infrastructure that is stable, efficient, and practical. I focus on open-source solutions and system management that simplify daily life. Less overhead, more control.",
  motto: "embrace open-source, operate cost-effectively, maintain efficiently.",
}

// Placeholder metadata: replace title, artist, albumArt and lyric with the real values.
export const SONGS: Song[] = [
  {
    id: 1,
    title: "Theme",
    artist: "Unknown Artist",
    src: "/audio/theme.mpeg",
    albumArt: "/img/album1.svg",
    lyric: "",
  },
  {
    id: 2,
    title: "Update",
    artist: "Unknown Artist",
    src: "/audio/update.mpeg",
    albumArt: "/img/album1.svg",
    lyric: "",
  },
]

export const TOOLS: Tool[] = [
  { name: "Linux", icon: "/icons/linux.svg" },
  { name: "Bash", icon: "/icons/bash.svg" },
  { name: "Debian", icon: "/icons/debian.svg" },
  { name: "Ubuntu", icon: "/icons/ubuntu.svg" },
  { name: "Kali Linux", icon: "/icons/kalilinux.svg" },
  { name: "Fedora", icon: "/icons/fedora.svg" },
  { name: "Windows", icon: "/icons/windows.svg" },
  { name: "VS Code", icon: "/icons/vscode.svg" },
  { name: "Git", icon: "/icons/git.svg" },
  { name: "Github", icon: "/icons/github.svg" },
  { name: "Docker", icon: "/icons/docker.svg" },
  { name: "MySQL", icon: "/icons/mysql.svg" },
  { name: "MariaDB", icon: "/icons/mariadb.svg" },
  { name: "MongoDB", icon: "/icons/mongo.svg" },
  { name: "Apache", icon: "/icons/apache.svg" },
  { name: "Nginx", icon: "/icons/nginx.svg" },
  { name: "KDE", icon: "/icons/kde.svg" },
  { name: "VirtualBox", icon: "/icons/virtualbox.svg" },
  { name: "VMware", icon: "/icons/vmware.svg" },
  { name: "Mikrotik", icon: "/icons/mikrotik.svg" },
  { name: "Plesk", icon: "/icons/plesk.svg" },
]

export const PROJECTS: Project[] = [
  {
    id: "1",
    folder: "Infrastructure",
    thumbnail: "/img/proj1.svg",
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
    thumbnail: "/img/proj2.svg",
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
    thumbnail: "/img/proj3.svg",
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
    thumbnail: "/img/proj4.svg",
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
    thumbnail: "/img/proj1.svg",
    name: "Growbot",
    description:
      "WhatsApp and Telegram gateway for Growmate, built with Node.js and Express. Lets users monitor soil moisture and control watering through chat commands.",
    tags: ["iot", "automation"],
    tech: ["Node.js", "Express", "Telegram Bot API", "Fonnte"],
    repo: "https://github.com/hilmyah/Growbot",
  },
]

export const PROJECT_TAGS = Array.from(
  new Set(PROJECTS.flatMap((project) => project.tags))
).sort()

export const SOCIALS: Social = {
  email: "andrahilmy558@gmail.com",
  github: "https://github.com/hilmyah",
  linkedin: "https://www.linkedin.com/in/hilmyah/",
  instagram: "https://www.instagram.com/hlmydr/",
  facebook: "https://www.facebook.com/andra.794636",
}

// Host used in the terminal's example network commands (dig, whois, ping).
export const SITE_DOMAIN = "hilmyah.my.id"

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
  { command: "curl", group: "network", description: "Fetch a URL over HTTP(S)", usage: "curl [-I] [-i] [-L] [-v] [-s] [-H 'Name: value'] [-A agent] <url>", examples: ["curl -I https://hilmyah.my.id", "curl -sL https://example.com | head -5"] },

  { command: "help", group: "shell", description: "List commands, or explain one", usage: "help [command]", examples: ["help dig"] },
  { command: "theme", group: "shell", description: "Switch light or dark theme", usage: "theme [dark|light]" },
  { command: "clear", group: "shell", description: "Clear the screen" },
]
