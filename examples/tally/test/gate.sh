#!/bin/sh
# tally gate: every fixture and usage error must give identical stdout, stderr and exit code
# natively and under Deno, and match the committed expected output.
#   test/gate.sh            check        UPDATE=1 test/gate.sh   rewrite expected.txt (then read it!)
set -e
cd "$(dirname "$0")/.."
./build.sh >/dev/null
T=$(mktemp -d)
# run "<label>" cmd...: append stdout, stderr and exit code to $OUT
run() { printf '== %s\n' "$1" >>"$OUT"; shift
  if "$@" >"$T/so" 2>"$T/se"; then rc=0; else rc=$?; fi
  cat "$T/so" >>"$OUT"; sed 's/^/stderr: /' "$T/se" >>"$OUT"; echo "exit $rc" >>"$OUT"; }
suite() { # suite <outfile> <program...>
  OUT=$1; shift; : >"$OUT"
  for f in good commas bad empty utf8-crlf missing; do run "$f" "$@" "test/fixtures/$f.csv"; done
  run "no arguments" "$@"
  run "two arguments" "$@" a b
}
suite "$T/native.txt" ./tally
suite "$T/deno.txt" deno run -A test/run.js
diff "$T/deno.txt" "$T/native.txt" || { echo "FAILED: tally: native == Deno"; exit 1; }
echo "tally: native == Deno"
if [ "${UPDATE:-}" = 1 ]; then cp "$T/native.txt" test/expected.txt; fi
diff test/expected.txt "$T/native.txt" || { echo "FAILED: tally: output as expected"; exit 1; }
echo "tally: output as expected"
echo "ALL GREEN"
