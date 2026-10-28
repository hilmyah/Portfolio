# Deploying

nginx serves the site from `/home/hilmy/projects/portfolio-releases/current`, a symlink to one
release folder. `server/deploy.sh` builds a new release next to the live one and then moves the
symlink in a single step, so visitors never see a half-built site. The repository's `dist/` is only
the build folder.

## Deploy

As `hilmy` (not root):

```bash
bash ~/projects/Portfolio/server/deploy.sh            # pull, build, switch to the new release
bash ~/projects/Portfolio/server/deploy.sh rollback   # switch back to the previous release
bash ~/projects/Portfolio/server/deploy.sh purge      # purge every fixed-name file from Cloudflare
```

A deploy:

1. runs `git pull --ff-only`, then `npm ci` only when `package-lock.json` changed;
2. runs `npm run build` and copies `dist/` to `releases/<time>-<commit>`;
3. copies hashed assets of the previous release that are less than 14 days old into the new one, so
   open tabs and HTML still cached by Cloudflare can load them;
4. switches `current` to the new release;
5. purges the files outside `assets/` that changed (HTML included) from the Cloudflare cache;
6. keeps the 5 newest releases and the active one;
7. prints the root commands to run when files under `server/` changed (nginx config, netapi).

A rollback does not touch `/etc/nginx`; copy the older config back yourself if it changed.

## One-time setup

1. As `hilmy`, create the first release. The site keeps running from `dist/` until step 2.

   ```bash
   cd ~/projects/Portfolio && git pull && bash server/deploy.sh
   ```

2. As root, install the brotli module first (the new config uses `brotli_static`), then the config:

   ```bash
   apt install libnginx-mod-http-brotli-static
   cp /home/hilmy/projects/Portfolio/server/nginx/portfolio.conf /etc/nginx/sites-available/portfolio.conf
   cp /home/hilmy/projects/Portfolio/server/nginx/security-headers.conf /etc/nginx/snippets/portfolio-security-headers.conf
   nginx -t && systemctl reload nginx
   ```

3. Cloudflare API token for purging, in the dashboard: My Profile > API Tokens > Create Token >
   Custom token. Permission `Zone / Cache Purge / Purge`, zone resources `Include / Specific zone /
   hilmyah.my.id`. The zone ID is on the domain's Overview page, in the API section. Then, as `hilmy`
   (the token is typed hidden, so it does not end up in the shell history):

   ```bash
   mkdir -p ~/.config
   read -rp 'Zone ID: ' zone && read -rsp 'API token: ' token && echo
   (umask 077 && printf 'CF_ZONE_ID=%s\nCF_API_TOKEN=%s\n' "$zone" "$token" > ~/.config/portfolio-deploy.env)
   unset zone token
   bash ~/projects/Portfolio/server/deploy.sh purge
   ```

   Without this file a deploy still works, but changed files stay cached at Cloudflare until they
   expire (HTML up to an hour, files from `public/` up to a day).

4. Cloudflare dashboard, for the domain:
   - Caching > Tiered Cache: enable it and choose Smart Tiered Caching.
   - Caching > Cache Rules > Create rule, named `Portfolio HTML`, with the custom expression
     `(http.host eq "hilmyah.my.id" and http.request.uri.path in {"/" "/index.html"})`.
     Cache eligibility: Eligible for cache. Edge TTL: Use cache-control header if present, bypass
     cache if not. Browser TTL: Respect origin. Keep the host condition: other subdomains share this
     zone and must not have their pages cached.

   The edge lifetime itself comes from the `Cloudflare-CDN-Cache-Control` header in
   `server/nginx/portfolio.conf`; browsers still get `Cache-Control: no-cache`.

## Checks

```bash
curl -s -o /dev/null -D - https://hilmyah.my.id/ | grep -i -E '^(cf-cache-status|age):'
js=$(curl -s https://hilmyah.my.id/ | grep -o '/assets/index-[^"]*\.js')
curl -s -o /dev/null -D - -H 'Accept-Encoding: br, gzip' "https://hilmyah.my.id$js" | grep -i '^content-encoding:'
curl -s https://hilmyah.my.id/.well-known/security.txt
```

Run the first line twice: the second run shows `cf-cache-status: HIT`. If it stays `DYNAMIC` or
`BYPASS`, change the rule's Edge TTL to "Ignore cache-control header and use this TTL" with 2 hours
(the Free plan minimum); deploys purge the HTML anyway. The `content-encoding` line shows `br`.
