#!/usr/bin/env bash
set -euo pipefail
source_sha=ae5650febf4320793844c12c4adaa937f417f8da
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git init -q "$tmp/upstream"
git -C "$tmp/upstream" remote add origin https://github.com/cursor/plugins.git
git -C "$tmp/upstream" sparse-checkout init --cone
git -C "$tmp/upstream" sparse-checkout set pstack
git -C "$tmp/upstream" -c protocol.version=2 fetch -q --depth 1 --filter=blob:none origin "$source_sha"
git -C "$tmp/upstream" checkout -q --detach FETCH_HEAD
rm -rf "$root/pstack"
cp -R "$tmp/upstream/pstack" "$root/pstack"
node "$root/scripts/check-pstack.mjs"
