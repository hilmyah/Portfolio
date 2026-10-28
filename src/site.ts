// Domain dan akun sosial media. Terpisah dari data.ts karena juga dibaca saat build
// (vite.plugins.ts membuat security.txt dari sini), jadi file ini tidak boleh meng-import gambar.
// Komponen tetap mengambilnya lewat data.ts.

export type Social = {
  email?: string
  github?: string
  linkedin?: string
  instagram?: string
  facebook?: string
}

// Domain yang juga dipakai di contoh perintah jaringan terminal (dig, whois, ping).
export const SITE_DOMAIN = "hilmyah.my.id"
export const SITE_URL = `https://${SITE_DOMAIN}/`

export const SOCIALS: Social = {
  email: "andrahilmy558@gmail.com",
  github: "https://github.com/hilmyah",
  linkedin: "https://www.linkedin.com/in/hilmyah/",
  instagram: "https://www.instagram.com/hlmydr/",
  facebook: "https://www.facebook.com/andra.794636",
}
