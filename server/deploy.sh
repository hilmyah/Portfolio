#!/usr/bin/env bash
# Deploy portfolio tanpa jeda. Dijalankan sebagai hilmy, bukan root:
#
#   bash ~/projects/Portfolio/server/deploy.sh            tarik commit terbaru, build, aktifkan
#   bash ~/projects/Portfolio/server/deploy.sh rollback   kembali ke rilis sebelumnya
#   bash ~/projects/Portfolio/server/deploy.sh purge      hapus cache Cloudflare semua file bernama tetap
#
# Kenapa tidak build langsung ke folder yang disajikan nginx: vite build mengosongkan dist/ dulu,
# jadi selama build situs menjawab 404, dan file JS lama yang masih dipakai tab pengunjung (chunk
# terminal) ikut hilang. Di sini dist/ hanya tempat build. Hasilnya disalin ke releases/<waktu>-<commit>,
# aset hash rilis sebelumnya ikut disalin selama KEEP_ASSET_DAYS hari (untuk tab lama dan HTML lama
# yang masih di cache Cloudflare), lalu symlink current yang dipakai nginx dipindah dalam satu langkah.
# Kalau ada perubahan di server/ yang butuh root (nginx, netapi), perintahnya dicetak di akhir.
set -euo pipefail
umask 022

REPO=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
SITE=$(dirname -- "$REPO")/portfolio-releases # nginx: root <SITE>/current;
ENV_FILE=${PORTFOLIO_DEPLOY_ENV:-$HOME/.config/portfolio-deploy.env} # CF_ZONE_ID dan CF_API_TOKEN
SITE_URL=https://hilmyah.my.id
KEEP_RELEASES=5
KEEP_ASSET_DAYS=14

log() { printf '==> %s\n' "$*"; }
warn() { printf 'peringatan: %s\n' "$*" >&2; }
die() {
  printf 'gagal: %s\n' "$*" >&2
  exit 1
}

current_release() {
  if [[ -L "$SITE/current" ]]; then readlink -f -- "$SITE/current"; fi
}

releases() {
  find "$SITE/releases" -mindepth 1 -maxdepth 1 -type d | sort
}

# Salin aset hash yang belum berumur KEEP_ASSET_DAYS hari dari rilis $1 ke rilis $2 (yang sudah ada
# dibiarkan, karena nama yang sama berarti isinya sama). cp -p menjaga waktu file, jadi umurnya
# dihitung dari build pertama yang membuatnya.
keep_assets() {
  local f
  [[ -d "$1/assets" ]] || return 0
  while IFS= read -r -d '' f; do
    [[ -e "$2/assets/${f##*/}" ]] || cp -p -- "$f" "$2/assets/"
  done < <(find "$1/assets" -maxdepth 1 -type f -mtime "-$KEEP_ASSET_DAYS" -print0)
}

# Pindahkan symlink current ke rilis $1. mv -T memakai rename(), jadi nginx selalu melihat salah satu
# rilis secara utuh, tidak pernah folder setengah jadi.
activate() {
  ln -sfn -- "releases/${1##*/}" "$SITE/current.next"
  mv -Tf -- "$SITE/current.next" "$SITE/current"
}

# File bernama tetap (di luar assets/) di rilis $2 yang baru atau berubah dibanding rilis $1, ditambah
# yang sudah tidak ada lagi. Kosong untuk $1 berarti semua file di $2.
changed_files() {
  local p
  while IFS= read -r -d '' p; do
    [[ -n "$1" ]] && cmp -s -- "$1/$p" "$2/$p" || printf '%s\n' "$p"
  done < <(cd -- "$2" && find . -type f ! -path './assets/*' ! -name '*.br' -printf '%P\0')
  [[ -n "$1" ]] || return 0
  while IFS= read -r -d '' p; do
    [[ -e "$2/$p" ]] || printf '%s\n' "$p"
  done < <(cd -- "$1" && find . -type f ! -path './assets/*' ! -name '*.br' -printf '%P\0')
}

# Hapus cache Cloudflare untuk file yang berbeda di antara rilis $1 dan $2.
purge() {
  local files=() paths=() f
  mapfile -t files < <(changed_files "$1" "$2")
  if ((${#files[@]} == 0)); then
    log "tidak ada file bernama tetap yang berubah, cache Cloudflare dibiarkan"
    return 0
  fi
  for f in "${files[@]}"; do
    paths+=("$f")
    [[ "$f" != index.html ]] || paths+=("")
  done
  if [[ ! -r "$ENV_FILE" ]]; then
    warn "$ENV_FILE belum ada, jadi cache Cloudflare tidak dihapus: ${#paths[@]} URL (termasuk HTML) bisa tampil versi lama sampai cache-nya habis."
    return 0
  fi
  [[ "$(stat -c %a -- "$ENV_FILE")" == 600 ]] || warn "$ENV_FILE berisi API token, jalankan: chmod 600 $ENV_FILE"
  log "hapus cache Cloudflare: ${#paths[@]} URL"
  (
    set -a
    # shellcheck source=/dev/null
    . "$ENV_FILE"
    set +a
    node "$REPO/server/purge-cloudflare.mjs" "$SITE_URL" "${paths[@]}"
  ) || warn "purge gagal (rilis baru tetap aktif); ulangi dengan: bash $REPO/server/deploy.sh purge"
}

# Hapus rilis lama, sisakan KEEP_RELEASES terbaru dan rilis yang sedang aktif.
prune() {
  local current all=() d n
  current=$(current_release)
  mapfile -t all < <(releases)
  n=$((${#all[@]} - KEEP_RELEASES))
  ((n > 0)) || return 0
  for d in "${all[@]:0:n}"; do
    [[ "$d" == "$current" ]] || rm -rf -- "$d"
  done
}

# Perintah root yang dibutuhkan perubahan di server/ sejak commit $1. Kosong: deploy pertama.
root_steps() {
  local changed
  if [[ -z "$1" ]]; then
    cat <<EOF

Deploy pertama dengan folder rilis. Sekali saja, sebagai root (su -):
  apt install libnginx-mod-http-brotli-static
  cp $REPO/server/nginx/portfolio.conf /etc/nginx/sites-available/portfolio.conf
  cp $REPO/server/nginx/security-headers.conf /etc/nginx/snippets/portfolio-security-headers.conf
  nginx -t && systemctl reload nginx
EOF
    return 0
  fi
  if ! changed=$(git -C "$REPO" diff --name-only "$1" HEAD -- server/ 2>/dev/null); then
    warn "commit $1 tidak ditemukan, cek sendiri apakah server/ berubah"
    return 0
  fi
  [[ -n "$changed" ]] || return 0
  local steps=()
  if grep -q '^server/nginx/' <<<"$changed"; then
    steps+=("cp $REPO/server/nginx/portfolio.conf /etc/nginx/sites-available/portfolio.conf"
      "cp $REPO/server/nginx/security-headers.conf /etc/nginx/snippets/portfolio-security-headers.conf"
      "nginx -t && systemctl reload nginx")
  fi
  if grep -q '^server/hilmy-netapi.service$' <<<"$changed"; then
    steps+=("cp $REPO/server/hilmy-netapi.service /etc/systemd/system/" "systemctl daemon-reload" "systemctl restart hilmy-netapi")
  elif grep -q '^server/netapi.mjs$' <<<"$changed"; then
    steps+=("systemctl restart hilmy-netapi")
  fi
  ((${#steps[@]})) || return 0
  printf '\nFile di server/ berubah. Jalankan sebagai root (su -):\n'
  printf '  %s\n' "${steps[@]}"
}

deploy() {
  local current previous_commit commit id new lock_hash stamp
  current=$(current_release)
  previous_commit=${current:+${current##*-}}
  cd -- "$REPO"
  commit=$(git rev-parse --short=12 HEAD)

  # node_modules hanya dipasang ulang kalau package-lock.json berubah sejak npm ci terakhir.
  stamp="$REPO/node_modules/.deploy-lock-sha256"
  lock_hash=$(sha256sum package-lock.json | cut -d' ' -f1)
  if [[ ! -f "$stamp" || "$(<"$stamp")" != "$lock_hash" ]]; then
    log "npm ci"
    npm ci --no-audit --no-fund
    printf '%s\n' "$lock_hash" >"$stamp"
  fi

  log "build $commit"
  npm run build

  id="$(date +%Y%m%d-%H%M%S)-$commit"
  new="$SITE/releases/$id"
  [[ ! -e "$new" ]] || die "$new sudah ada, ulangi sedetik lagi"
  cp -a -- "$REPO/dist" "$new"
  [[ -z "$current" ]] || keep_assets "$current" "$new"
  activate "$new"
  log "aktif: $id"

  purge "$current" "$new"
  prune
  root_steps "$previous_commit"
}

rollback() {
  local current all=() i target
  current=$(current_release)
  [[ -n "$current" ]] || die "belum ada rilis yang aktif"
  mapfile -t all < <(releases)
  for ((i = ${#all[@]} - 1; i > 0; i--)); do
    [[ "${all[i]}" != "$current" ]] || break
  done
  ((i > 0)) || die "tidak ada rilis yang lebih lama dari ${current##*/}"
  target=${all[i - 1]}
  # Tab yang sudah memuat versi yang dibatalkan tetap bisa memuat chunk-nya.
  keep_assets "$current" "$target"
  activate "$target"
  log "aktif: ${target##*/} (rollback dari ${current##*/})"
  purge "$current" "$target"
}

main() {
  [[ $EUID -ne 0 ]] || die "jalankan sebagai hilmy, bukan root"
  case "${1:-}" in
    "")
      # Tarik dulu, lalu jalankan versi skrip ini yang baru saja ditarik.
      git -C "$REPO" pull --ff-only
      exec bash "$REPO/server/deploy.sh" --pulled
      ;;
    --pulled | rollback | purge) ;;
    *) die "usage: deploy.sh [rollback|purge]" ;;
  esac

  mkdir -p -- "$SITE/releases"
  exec 9>"$SITE/.deploy.lock"
  flock -n 9 || die "deploy lain sedang berjalan"
  case "$1" in
    --pulled) deploy ;;
    rollback) rollback ;;
    purge)
      local current
      current=$(current_release)
      [[ -n "$current" ]] || die "belum ada rilis yang aktif"
      purge "" "$current"
      ;;
  esac
}

# Satu baris: bash sudah membaca exit sebelum main berjalan, jadi skrip yang berubah di disk (git pull)
# tidak ikut terbaca di tengah jalan.
main "$@"; exit $?
