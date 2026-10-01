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

export type TerminalCommand = {
  command: string
  description: string
}

export type Social = {
  email?: string
  github?: string
  linkedin?: string
  instagram?: string
}

export const PROFILE: Profile = {
  name: "Hilmy Adhyandra Hamzah",
  role: "Infrastructure & Systems",
  tagline: "Linux • Self-hosting • Networking • Automation",
  photo: {
    src: "/placeholder/me.jpeg",
    width: 420,
    height: 540,
    alt: "Hilmy Adhyandra Hamzah",
  },
}

export const SONGS: Song[] = []

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
    name: "Bedrock Server",
    description: "Project description.",
    tags: ["linux", "self-hosting"],
    tech: ["Linux", "Bash"],
    role: "Infrastructure",
    status: "Active",
    repo: "https://github.com/hilmyah/bedrock-server",
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
}

export const TERMINAL_COMMANDS: TerminalCommand[] = [
  { command: "help", description: "Show available commands" },
  { command: "about", description: "About Hilmy" },
  { command: "projects", description: "List projects" },
  { command: "project", description: "Show project details" },
  { command: "tags", description: "List project tags" },
  { command: "skills", description: "Show tools and technologies" },
  { command: "social", description: "Show social links" },
  { command: "contact", description: "Show contact information" },
  { command: "clear", description: "Clear terminal" },
  { command: "neofetch", description: "Show portfolio information" },
]
