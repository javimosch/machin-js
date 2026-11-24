#!/bin/sh
# Gate: (1) src/*.js -> .src, canonical MFL == gold; (2) demo: native == Deno oracle;
# (3) todo server: same HTTP smoke test passes under Deno AND as a native binary.
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd); T=$(mktemp -d); FW=${MACHIN_FRAMEWORK:-$HOME/ai/machin/framework}
JS="src/model.js src/store.js src/render.js src/routes.js src/main.js src/server.js"
deno run -A transpile/transpile.ts "$T/out" $JS
# machweb is included so the whole program typechecks; main comes from server.src.
G=""; O2=""; for f in model store render routes server; do G="$G gold/$f.src"; O2="$O2 $T/out/$f.src"; done
machin encode "$FW/machweb.src" $G > "$T/g.mfl"; machin encode "$FW/machweb.src" $O2 > "$T/o.mfl"
diff "$T/g.mfl" "$T/o.mfl" > /dev/null || { echo "server gold mismatch"; exit 1; }
machin encode gold/model.src gold/store.src gold/render.src gold/main.src > "$T/g.mfl"
machin encode $T/out/model.src $T/out/store.src $T/out/render.src $T/out/main.src > "$T/o.mfl"
diff "$T/g.mfl" "$T/o.mfl" > /dev/null || { echo "demo gold mismatch"; exit 1; }
echo "canonical MFL identical to gold"
O=$T/out
machin encode $O/model.src $O/store.src $O/render.src $O/main.src > "$T/demo.mfl"
machin run "$T/demo.mfl" | diff - gold/expected.txt && echo "demo: native output matches"
deno run -A test/oracle.ts | diff - gold/expected.txt && echo "demo: Deno oracle matches"
machin encode "$FW/machweb.src" $O/model.src $O/store.src $O/render.src $O/routes.src $O/server.src > "$T/srv.mfl"
machin build "$T/srv.mfl" -o "$T/srv" >/dev/null
check() { mkdir -p "$T/$1" && (cd "$T/$1"; shift; "$@" >/dev/null 2>&1 & echo $! > pid; sleep 2
  if sh "$ROOT/test/smoke.sh"; then r=0; else r=1; fi; kill "$(cat pid)" 2>/dev/null; return $r); }
check native "$T/srv"
check deno deno run -A "$ROOT/test/serve.ts"
echo "ALL GREEN"
