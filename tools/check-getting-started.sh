#!/bin/sh
# Run the getting-started page's commands exactly as written, with an empty HOME.
# The clone is taken from this checkout instead of GitHub, so it tests the current commit.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd); T=$(mktemp -d); export HOME="$T/home"; mkdir -p "$HOME" "$T/work"
export PATH="$HOME/.local/bin:$PATH" DENO_DIR="${DENO_DIR:-$T/deno}"
block() { awk -v want="<!-- run: $1 -->" '$0==want{f=1;next} f&&/^```sh$/{g=1;next} g&&/^```$/{exit} g' "$ROOT/docs/getting-started.md"; }
cd "$T/work"
{ echo set -e; block install | sed "s#git clone https://github.com/javimosch/machin-js#git clone -q $ROOT#"; } > install.sh
{ echo set -e; block first; } > first.sh
grep -q build-release install.sh && grep -q "machin-js new" first.sh || { echo "FAILED: docs blocks not found"; exit 1; }
sh install.sh >install.log 2>&1 || { cat install.log; echo "FAILED: install steps"; exit 1; }
OUT=$(sh first.sh) || { echo "FAILED: first program steps"; exit 1; }
echo "$OUT" | grep -qx "hello world" || { echo "FAILED: expected hello world, got: $OUT"; exit 1; }
echo "getting started works as written"
