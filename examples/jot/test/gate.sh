#!/bin/sh
# jot gate: (1) the same commands give identical stdout, stderr and exit codes natively and under
# Deno, matching the committed transcript; (2) the native program conforms to the two specs.
#   test/gate.sh            check        UPDATE=1 test/gate.sh   rewrite expected.txt (then read it!)
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd); T=$(mktemp -d)
./build.sh >/dev/null
run() { printf '== jot %s\n' "$*" >>"$OUT"
  if JOT_DB="$DB" $PROGRAM "$@" >"$T/so" 2>"$T/se" </dev/null; then rc=0; else rc=$?; fi
  cat "$T/so" >>"$OUT"; sed 's/^/stderr: /' "$T/se" >>"$OUT"; echo "exit $rc" >>"$OUT"; }
suite() { OUT=$1; DB=$2; PROGRAM=$3; : >"$OUT"
  run add "write the report" --tag work; run add "buy milk"; run add -- "-v is broken"
  run list; run list --text; run done 1; run done 1; run done 42; run list; run list --all --text
  run show 2; run rm 2; run rm 2; run list --tag work --all
  run; run nope; run list --bogus; run add; run show x1; run add x --tag
  run version; run help-json; run guide; run guide --human; }
printf '#!/bin/sh\nexec deno run -A "%s/test/run.js" "$@"\n' "$ROOT" >"$T/jot-deno"; chmod +x "$T/jot-deno"
suite "$T/native.txt" "$T/n.db" "$ROOT/jot"
suite "$T/deno.txt" "$T/d.db" "$T/jot-deno"
diff "$T/deno.txt" "$T/native.txt" || { echo "FAILED: jot: native == Deno"; exit 1; }
echo "jot: native == Deno"
if [ "${UPDATE:-}" = 1 ]; then cp "$T/native.txt" test/expected.txt; fi
diff test/expected.txt "$T/native.txt" || { echo "FAILED: jot: transcript as expected"; exit 1; }
echo "jot: transcript as expected"
deno run -A test/conform.ts "$ROOT/jot" || { echo "FAILED: jot: spec conformance"; exit 1; }
echo "ALL GREEN"
