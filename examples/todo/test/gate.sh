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
glist() { for f in $(cat "$1/order.txt"); do echo "gold/$f.src"; done; }
deno run -A ../../transpile/transpile.ts "$T/demo" src/main.js
deno run -A ../../transpile/transpile.ts "$T/srv" src/server.js
machin encode $(glist "$T/demo") > "$T/g.mfl"; machin encode $(list "$T/demo") > "$T/o.mfl"
diff "$T/g.mfl" "$T/o.mfl" >/dev/null || { echo "demo gold mismatch"; exit 1; }
machin encode $(cat "$T/srv/native.txt") $(glist "$T/srv") > "$T/g.mfl"; machin encode $(cat "$T/srv/native.txt") $(list "$T/srv") > "$T/o.mfl"
diff "$T/g.mfl" "$T/o.mfl" >/dev/null || { echo "server gold mismatch"; exit 1; }
echo "canonical MFL identical to gold"
machin encode $(list "$T/demo") > "$T/demo.mfl"
machin run "$T/demo.mfl" | diff - gold/expected.txt && echo "demo: native output matches"
deno run -A test/oracle.ts | diff - gold/expected.txt && echo "demo: Deno oracle matches"
machin build "$T/o.mfl" -o "$T/srvbin" >/dev/null
check() { mkdir -p "$T/$1" && (cd "$T/$1"; shift; "$@" >/dev/null 2>&1 & echo $! > pid; sleep 2
  if MACHINJS_SMOKE=1 sh "$ROOT/test/smoke.sh"; then r=0; else r=1; fi; kill "$(cat pid)" 2>/dev/null; return $r); }
check native "$T/srvbin"
check deno deno run -A "$ROOT/test/serve.ts"
# Desktop shell: only if its prerequisites exist (raylib static lib + Xvfb), else say so.
RL=${RAYLIB_DIR:-$HOME/ai/tinybrain/vendor/raylib-5.0_linux_amd64}
if [ -f "$RL/lib/libraylib.a" ] && command -v Xvfb >/dev/null; then
  ./build-desktop.sh >/dev/null && test/desktop_input.sh
else echo "desktop: SKIPPED (needs raylib at \$RAYLIB_DIR and Xvfb)"; fi
echo "ALL GREEN"
