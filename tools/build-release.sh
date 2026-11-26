#!/bin/sh
# Compile the machin-js command into one self-contained binary: dist/machin-js
#   tools/build-release.sh [deno-target]
set -e
cd "$(dirname "$0")/.."
# the toolchain's own code is type-checked here, because --no-check is needed below: deno compile
# would otherwise check the files in types/ (typings for users' apps) as part of the toolchain
deno check cli/machin-js.ts transpile/*.ts
mkdir -p dist
OUT=dist/machin-js${1:+-$1}
deno compile -A --no-check ${1:+--target "$1"} \
  --include types --include bindings --include shim \
  -o "$OUT" cli/machin-js.ts
# the binary redistributes other projects, so their licences travel with it
{ echo "machin-js is MIT licensed (see LICENSE). The binary also contains the following."
  for f in LICENSE licenses/*.txt; do printf '\n\n===== %s =====\n\n' "$f"; cat "$f"; done
  echo; echo "The Deno runtime embedded in the binary includes further components, such as V8;"
  echo "see https://github.com/denoland/deno for their licences."; } > dist/THIRD_PARTY_LICENSES.txt
echo "built $OUT"
