# Hilmy Adhyandra Hamzah - Portfolio

Personal portfolio of Hilmy Adhyandra Hamzah, focused on infrastructure, Linux systems, self-hosting,
networking, automation, and open-source technologies.

Live at <https://hilmyah.my.id>, self-hosted on a home server behind a Cloudflare Tunnel.

## Stack

- Preact (components are written against the React API and bundled through `preact/compat`), TypeScript, Vite, Tailwind CSS
- The page is prerendered into `index.html` at build time (`src/prerender.tsx`) and hydrated in the browser
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

## Deploy

`server/deploy.sh` builds each release into its own folder on the server and switches nginx to it in
one step, then purges changed files from the Cloudflare cache. Setup and usage are in
[server/DEPLOY.md](server/DEPLOY.md).
