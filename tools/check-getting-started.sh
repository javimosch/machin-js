#!/bin/sh
# Run the getting-started page's commands exactly as written, on a PATH with neither machin nor
# deno, so the page itself has to provide what it uses. Downloads the real published releases.
#   tools/check-getting-started.sh            the download route (what a new user follows)
#   tools/check-getting-started.sh source     the build-from-source route (needs deno)
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd); T=$(mktemp -d); ROUTE=${1:-download}
DENO_BIN=$(command -v deno || true); REAL_DENO_DIR=${DENO_DIR:-$HOME/.cache/deno}
export HOME="$T/home"; mkdir -p "$HOME" "$T/work"
export PATH="$HOME/.local/bin:/usr/bin:/bin"
if command -v machin >/dev/null || command -v deno >/dev/null; then
  echo "FAILED: machin or deno is in /usr/bin or /bin, so this check would prove nothing"; exit 1; fi
block() { awk -v want="<!-- run: $1 -->" '$0==want{f=1;next} f&&/^```sh$/{g=1;next} g&&/^```$/{exit} g' "$ROOT/docs/getting-started.md"; }
cd "$T/work"
{ echo set -e; block install-machin; } > machin.sh
if [ "$ROUTE" = source ]; then
  mkdir -p "$T/denobin" && ln -s "$DENO_BIN" "$T/denobin/deno"; export PATH="$PATH:$T/denobin" DENO_DIR="$REAL_DENO_DIR"
  { echo set -e; block source | sed "s#git clone https://github.com/javimosch/machin-js#git clone -q $ROOT#"; } > install.sh
else
  { echo set -e; block install; } > install.sh
fi
{ echo set -e; block first; } > first.sh
for f in machin.sh install.sh first.sh; do [ "$(wc -l < $f)" -gt 2 ] || { echo "FAILED: docs block for $f not found"; exit 1; }; done
sh machin.sh >machin.log 2>&1 || { cat machin.log; echo "FAILED: installing machin"; exit 1; }
sh install.sh >install.log 2>&1 || { cat install.log; echo "FAILED: installing machin-js"; exit 1; }
OUT=$(sh first.sh) || { echo "FAILED: first program steps"; exit 1; }
echo "$OUT" | grep -qx "hello world" || { echo "FAILED: expected hello world, got: $OUT"; exit 1; }
echo "getting started works as written ($ROUTE)"
