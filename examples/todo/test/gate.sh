#!/bin/sh
# Gate: (1) src/ modules -> .src, canonical MFL == gold; (2) demo: native == Deno oracle;
# (3) todo server: same HTTP smoke test passes under Deno AND as a native binary.
set -e
cd "$(dirname "$0")/.."
# The smoke test POSTs to $PORT (default 18080, NOT the app's 8080), so never run it against something we did not start.
export PORT=${PORT:-18080}
if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/"; then
  echo "port $PORT is in use — set PORT to a free one; the gate would write to it"; exit 2; fi
ROOT=$(pwd); T=$(mktemp -d); FW=${MACHIN_FRAMEWORK:-$HOME/ai/machin/framework}
# list() prints the .src files of an entry's build, in dependency order, under dir $1
list() { for f in $(cat "$1/order.txt"); do echo "$1/$f.src"; done; }
deno run -A ../../transpile/transpile.ts "$T/demo" src/main.js
deno run -A ../../transpile/transpile.ts "$T/srv" src/server.js
# Gold is compared module by module (--no-check formats one file alone), so a mismatch names it;
# the builds below type-check the whole generated program.
for entry in demo srv; do
  for m in $(cat "$T/$entry/order.txt"); do
    # positions in generated checks ("store.js:12:8") move with any edit, so they are blanked
    machin encode --no-check "gold/$m.src" > "$T/g0.mfl"; machin encode --no-check "$T/$entry/$m.src" > "$T/o0.mfl"
    for x in g o; do sed 's/\.js:[0-9][0-9]*:[0-9][0-9]*/.js:N:M/g' "$T/${x}0.mfl" > "$T/$x.mfl"; done
    diff "$T/g.mfl" "$T/o.mfl" >/dev/null || { echo "gold mismatch: $m.src"; exit 1; }
  done
done
echo "canonical MFL identical to gold"
machin encode $(list "$T/demo") > "$T/demo.mfl"
machin run "$T/demo.mfl" --safe | diff - gold/expected.txt || { echo "FAILED: demo: native output matches"; exit 1; }
echo "demo: native output matches"
deno run -A test/oracle.ts | diff - gold/expected.txt || { echo "FAILED: demo: Deno oracle matches"; exit 1; }
echo "demo: Deno oracle matches"
machin encode $(cat "$T/srv/native.txt") $(list "$T/srv") > "$T/srv.mfl"
machin build "$T/srv.mfl" -o "$T/srvbin" --safe >/dev/null
check() { mkdir -p "$T/$1" && (cd "$T/$1"; shift; "$@" >/dev/null 2>&1 & echo $! > pid; sleep 2
  if MACHINJS_SMOKE=1 sh "$ROOT/test/smoke.sh"; then r=0; else r=1; fi; kill "$(cat pid)" 2>/dev/null; return $r); }
check native "$T/srvbin"
check deno deno run -A "$ROOT/test/serve.ts"
# Desktop shell: only if its prerequisites exist (raylib static lib + Xvfb), else say so.
RL=${RAYLIB_DIR:-$HOME/ai/tinybrain/vendor/raylib-5.0_linux_amd64}
if [ -f "$RL/lib/libraylib.a" ] && command -v Xvfb >/dev/null; then
  ./build-desktop.sh >/dev/null
  test/desktop_input.sh
else echo "desktop: SKIPPED (needs raylib at \$RAYLIB_DIR and Xvfb)"; fi
echo "ALL GREEN"
