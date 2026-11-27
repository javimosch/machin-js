#!/bin/sh
# Prove the compiled binary works on its own: no repo, no machin checkout, empty HOME.
#   tools/smoke-release.sh dist/machin-js     (needs machin, cc, curl; deno for the debug check)
set -e
BIN=$(cd "$(dirname "$1")" && pwd)/$(basename "$1"); T=$(mktemp -d); MACHIN_DIR=$(dirname "$(command -v machin)")
trap 'if [ -n "$KEEP_TMP" ]; then echo "kept $T"; else rm -rf "$T"; fi' EXIT   # KEEP_TMP=1 keeps it for debugging
DENO_DIR_BIN=$(dirname "$(command -v deno)")
clean() { env -i PATH="$MACHIN_DIR:/usr/bin:/bin" HOME="$T/home" "$BIN" "$@"; }
mkdir -p "$T/home"; cd "$T"
fail() { echo "FAILED: $1"; exit 1; }
clean new hello >/dev/null || fail "new"
cd hello
[ "$(clean check main.js)" = ok ] || fail "check"
[ "$(clean run main.js)" = "hello world" ] || fail "run"
clean build main.js >/dev/null || fail "build"
[ "$(./hello)" = "hello world" ] || fail "built program"
D=$(env -i PATH="$DENO_DIR_BIN:/usr/bin:/bin" HOME="$T/home" "$BIN" debug main.js) || fail "debug"
[ "$D" = "hello world" ] || fail "debug output: $D"
# a web program must build with the bundled machweb
cat > web.js <<'J'
import { serve, ok_text } from "machin/web";

/**
 * Serve one line of text.
 * @returns {void}
 */
export function main() {
  //why: proves the bundled machweb is found without a machin checkout.
  serve(18093, (r) => ok_text(r.path));
}
J
clean build web.js -o webapp >/dev/null || fail "web build"
if curl -s -o /dev/null --max-time 1 http://127.0.0.1:18093/; then fail "port 18093 is busy"; fi
./webapp >/dev/null 2>&1 & P=$!
R=""; for _ in 1 2 3 4 5 6 7 8 9 10; do R=$(curl -s --max-time 1 http://127.0.0.1:18093/hi || true); [ -n "$R" ] && break; sleep 0.2; done
kill $P 2>/dev/null || true
[ "$R" = "/hi" ] || fail "web program answered: $R"
printf '/** m */\nexport function main() {\n  //why: t.\n  console.log(7 / 2);\n}\n' > bad.js
if clean check bad.js 2>err.txt; then fail "bad program accepted"; fi
grep -q "bad.js:4: JS-NUM002" err.txt || fail "diagnostic missing: $(cat err.txt)"
echo "release smoke OK"
