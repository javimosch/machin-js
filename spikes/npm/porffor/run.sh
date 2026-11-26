#!/bin/sh
# marked, compiled by Porffor to C, called from a machin program; compared with Deno.
#   PORF=/path/to/porf sh run.sh <git-repo-with-markdown>...
# PORF is the binary from the npm package porffor (measured with alpha 25).
# It runs unsandboxed here: read what you install first. Needs deno, gcc, machin, python3.
set -eu
: "${PORF:?set PORF to the porf binary}"
[ $# -gt 0 ] || { echo "name at least one git repo that has .md files" >&2; exit 80; }
repos=$(for r in "$@"; do (cd "$r" && pwd); done)
cd "$(dirname "$0")"; here=$PWD; out=$here/../out/porffor; mkdir -p "$out"

# esbuild cannot read "npm:" specifiers, so it gets the bare package name
sed 's#"npm:marked@[^"]*"#"marked"#' ../adapters/marked.js > "$out/adapter.js"
cp entry.js "$out/entry.js"
(cd .. && deno run -A npm:esbuild@0.24.2 out/porffor/entry.js --bundle --format=esm --platform=neutral \
  --conditions=browser --main-fields=module,main --target=es2022 --charset=utf8 --outfile="$out/lib.js")
(cd "$out" && "$PORF" c lib.js -o lib.c)
gcc -c -O3 -ffp-contract=off -fno-exceptions -ffunction-sections -fdata-sections -I "$out" porfbridge.c -o "$out/porfbridge.o" 2>"$out/gcc.log"
rm -f "$out/libporfmarked.a"; ar rcs "$out/libporfmarked.a" "$out/porfbridge.o"
for p in drive soak; do
  machin encode "$p.src" > "$out/$p.mfl"
  machin build "$out/$p.mfl" -o "$out/$p.bin" --cflags "-I$here" --ldflags "-L$out"
done

# shellcheck disable=SC2086
python3 corpus.py "$out" $repos
for n in docs chunks random; do
  (cd .. && deno run --allow-read porffor/ref.js "$out/$n.jsonl") > "$out/$n.deno"
  "$out/drive.bin" "$out/$n.jsonl" > "$out/$n.native"
  if cmp -s "$out/$n.deno" "$out/$n.native"; then echo "$n: identical ($(wc -l < "$out/$n.deno") answers)"; else echo "$n: DIFFERENT"; exit 1; fi
done
"$out/soak.bin" "$out/chunks.jsonl" 40
