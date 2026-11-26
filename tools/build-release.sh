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
echo "built $OUT"
