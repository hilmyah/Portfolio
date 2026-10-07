# Terminal network API

`netapi.mjs` lets the portfolio terminal run real network tools on the machine that hosts the site
and stream their output back, so they behave like they do in a normal terminal.

| Command | Runs | Flags accepted |
|---|---|---|
| `ping` | system `ping` (ICMP) | `-c count` (1 to 10), `-4`, `-6` |
| `dig` | system `dig` | `@server`, `-x ip`, `-t type`, `-4`, `-6`, common `+options` such as `+short`, `+trace`, `+noall +answer` |
| `nslookup` | system `nslookup` | `-type=TYPE`, optional server |
| `host` | system `host` | `-t TYPE`, `-a`, `-v`, `-4`, `-6`, optional server |
| `traceroute` | system `traceroute` | `-m hops` (1 to 30), `-4`, `-6` |
| `whois` | built in (TCP 43, follows IANA, registry and registrar referrals) | `-h server` |

Pipes (`| grep`, `head`, `tail`, `sort`, `uniq`, `wc`) are handled by the terminal in the browser, not here.

The API is optional. Without it, `dig`, `whois` and `ping` fall back to browser-based lookups with fewer
options, and `nslookup`, `host` and `traceroute` report that the backend is not reachable.

## What it is not

It is not a shell. Only the commands and flags above are accepted, and nothing passes through `sh`.

- Every host a tool would connect to is resolved by the API first. Private, loopback, link-local, CGNAT and
  multicast addresses are refused, so visitors cannot probe the LAN behind the server.
- DNS tools query `1.1.1.1` unless the visitor names another public resolver.
- Private addresses in `traceroute` output are replaced with `[private]`.
- Each run has a deadline and a 96 KB output cap.
- 12 requests per minute per client, 120 per minute overall, 4 concurrent runs.

## Install (Debian, systemd, nginx)

```bash
apt install bind9-dnsutils bind9-host traceroute iputils-ping
cp /home/hilmy/projects/Portfolio/server/hilmy-netapi.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hilmy-netapi
curl -s http://127.0.0.1:8787/api/health
curl -sN -X POST -H 'content-type: application/json' -d '{"cmd":"ping","args":["-c","2","1.1.1.1"]}' http://127.0.0.1:8787/api/run
```

The second `curl` should print `data: "..."` lines containing `64 bytes from 1.1.1.1`.

Add this inside the site's `server { ... }` block in nginx, above `location /`:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;
    proxy_read_timeout 60s;
}
```

```bash
nginx -t && systemctl reload nginx
```

After pulling changes to `netapi.mjs`, run `systemctl restart hilmy-netapi`.

## Troubleshooting

- `ping: not installed on the server` (or `dig`, `traceroute`): install the package listed above.
- `ping` prints nothing useful or exits with a permission error: check that user `hilmy` may send ICMP with
  `su - hilmy -c "ping -c 1 1.1.1.1"` and `sysctl net.ipv4.ping_group_range`.
- The service does not start: `journalctl -u hilmy-netapi -n 20 --no-pager`.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `NETAPI_PORT` | `8787` | Listen port |
| `NETAPI_HOST` | `127.0.0.1` | Listen address |
| `NETAPI_RESOLVER` | `1.1.1.1` | Resolver used by DNS tools when none is given |

`NETAPI_BIN_DIR`, `NETAPI_WHOIS_PORT` and `NETAPI_TEST_HOSTS` exist for tests only. Leave them unset.
