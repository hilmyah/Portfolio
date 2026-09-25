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
  thumbnail: string
  description: string
  tech: string[]
  repo?: string
  demo?: string
}

export type Social = {
  email?: string
  github?: string
  linkedin?: string
  instagram?: string
}

export const PROFILE: Profile = {
  name: "Hilmy Adhyandra Hamzah",
  role: "Software Engineer",
  tagline: "Caffeine-fueled Coder",
  photo: {
    src: "/placeholder/me.jpeg",
    width: 420,
    height: 540,
    alt: "me",
  },
}

export const SONGS: Song[] = [
  {
    id: 1,
    title: "Why Are Sundays So Depressing?",
    artist: "Artist Name",
    src: "/audio/song1.mp3",
    albumArt: "/img/album1.svg",
    length: "3:45",
    lyric: "you're hidin in the background but you want to be found",
  },
  {
    id: 2,
    title: "Song ",
    artist: "testapajanamaartistlaguidk",
    src: "/audio/song1.mp3",
    albumArt: "/img/album1.svg",
    length: "3:45",
    lyric: "you're hidin in the background but you want to be found",
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
  { name: "Visual Studio Code", icon: "/icons/vscode.svg" },
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
    id: "proj-1",
    folder: "JavaScript",
    name: "Random Picker",
    thumbnail: "/img/proj1.svg",
    description: "Random Picker web app. Built with native JavaScript and Tailwind CSS. Add multiple names, shuffle, and pick winners with a playful animation.",
    tech: ["JavaScript", "Tailwind"],
    repo: "https://github.com/RaihanSnh/random-picker",
    demo: "https://raihansnh.github.io/random-picker/",
  },
  {
    id: "proj-2",
    folder: "TypeScript",
    name: "ToDo-List",
    thumbnail: "/img/proj2.svg",
    description: "Task manager with categories and filters. Clean TypeScript structure with components and state management.",
    tech: ["TypeScript", "Tailwind"],
    repo: "https://github.com/RaihanSnh/ToDo-List",
  },
  {
    id: "proj-3",
    folder: "JavaScript",
    name: "Invisible TicTacToe",
    thumbnail: "/img/proj3.svg",
    description: "A twist on TicTacToe, the board fades as you play. Fun logic and DOM updates with classic JS.",
    tech: ["JavaScript"],
    repo: "https://github.com/RaihanSnh/Invisible-TicTacToe",
    demo: "https://raihansnh.github.io/Invisible-TicTacToe/",
  },
  {
    id: "proj-4",
    folder: "PHP",
    name: "ujianify",
    thumbnail: "/img/proj4.svg",
    description: "Simple exam/quiz functionality. Server-side rendering and basic CRUD powered by PHP.",
    tech: ["PHP"],
    repo: "https://github.com/RaihanSnh/ujianify",
  },
]

export const SOCIALS: Social = {
  email: "andrahilmy558@gmail.com",
  github: "https://github.com/hilmyah",
  linkedin: "https://www.linkedin.com/in/hilmyah/",
  instagram: "https://www.instagram.com/hlmydr/",
}


