#!/usr/bin/env bash
set -Eeuo pipefail

app_dir="${1:?Application directory is required}"
release_id="${2:?Release identifier is required}"
archive_path="${3:?Release archive path is required}"
app_port="${4:?Application port is required}"

if [[ ! "$app_dir" =~ ^/(srv|opt|var/www)/[A-Za-z0-9._/-]+$ ]] || [[ "$app_dir" == "/" ]]; then
  echo "Refusing unsafe application directory: $app_dir" >&2
  exit 1
fi
if [[ ! "$release_id" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid release identifier" >&2
  exit 1
fi
if [[ "$archive_path" != "/tmp/outboundos-${release_id}.tar.gz" ]]; then
  echo "Unexpected archive path" >&2
  exit 1
fi
if [[ ! "$app_port" =~ ^[0-9]+$ ]]; then
  echo "Invalid application port" >&2
  exit 1
fi

releases_dir="$app_dir/releases"
release_dir="$releases_dir/$release_id"
current_link="$app_dir/current"
previous_release="$(readlink -f "$current_link" 2>/dev/null || true)"

activate_release() {
  local target="$1"
  local temporary_link="$app_dir/.current-${release_id}"
  ln -sfn "$target" "$temporary_link"
  mv -Tf "$temporary_link" "$current_link"
}

install -d -m 755 "$releases_dir" "$release_dir"
tar -xzf "$archive_path" -C "$release_dir"
rm -f -- "$archive_path"

if [[ ! -f "$release_dir/server.js" ]] || [[ ! -f "$release_dir/package.json" ]]; then
  echo "Release artifact is incomplete" >&2
  exit 1
fi

activate_release "$release_dir"
sudo /usr/bin/systemctl restart outboundos.service

healthy=false
for _ in {1..30}; do
  if curl --fail --silent --show-error "http://127.0.0.1:${app_port}/api/health" >/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done

if [[ "$healthy" != "true" ]]; then
  echo "New release failed its health check" >&2
  if [[ -n "$previous_release" ]] && [[ -d "$previous_release" ]]; then
    echo "Rolling back to $previous_release" >&2
    activate_release "$previous_release"
    sudo /usr/bin/systemctl restart outboundos.service
  fi
  exit 1
fi

mapfile -t old_releases < <(find "$releases_dir" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | awk 'NR > 5 { print $2 }')
for old_release in "${old_releases[@]}"; do
  if [[ "$old_release" != "$previous_release" ]] && [[ "$old_release" != "$release_dir" ]]; then
    rm -rf -- "$old_release"
  fi
done

echo "Activated release $release_id"
