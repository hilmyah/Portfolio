# Hilmy Adhyandra Hamzah - Portfolio

Personal portfolio of Hilmy Adhyandra Hamzah, focused on infrastructure, Linux systems, self-hosting,
networking, automation, and open-source technologies.

Live at <https://hilmyah.my.id>, self-hosted on a home server behind a Cloudflare Tunnel.

## Stack

- React, TypeScript, Vite, Tailwind CSS
- Lucide icons; Inter, JetBrains Mono and Patrick Hand via Fontsource
- `server/netapi.mjs`: optional Node backend that runs the terminal's network tools (see [server/README.md](server/README.md))

## Development

```bash
npm install
npm run dev
```

During development, `/api` is proxied to the live site (see `vite.config.ts`), so the terminal's network
commands use the real backend.

Checks before committing:

```bash
npm run lint
npm run build
```

## Content

Everything shown on the page comes from `src/data.ts`: profile, about text, tools, projects, songs,
social links and terminal commands. Static files live in `public/`.

## Terminal

The terminal section understands:

- `help` lists everything; `help <command>` shows usage and examples
- portfolio commands: `about`, `projects`, `project <name>`, `open <name>`, `tools`, `contact`, `fetch`, `theme`
- a read-only virtual filesystem: `ls`, `cd`, `cat`, `pwd`, `tree`
- network tools: `ping`, `dig`, `nslookup`, `host`, `traceroute`, `whois`, `curl`
- pipes into `grep`, `head`, `tail`, `sort`, `uniq`, `wc`

## Deployment

On the server, as user `hilmy`:

```bash
cd /home/hilmy/projects/Portfolio
git pull --ff-only
npm ci
npm run build
```

nginx serves `dist/`. Its site configuration, including the `/api/` proxy and security headers, is in
`server/nginx/`. After changes to `server/netapi.mjs`, restart it with `systemctl restart hilmy-netapi`.
