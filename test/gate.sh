#!/bin/sh
# M1 gate: transpile src/*.js, then (1) canonical .mfl == gold's, (2) native output == expected.txt.
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d)
deno run -A transpile/transpile.ts "$T/out" src/model.js src/store.js src/render.js src/main.js
O="$T/out/model.src $T/out/store.src $T/out/render.src $T/out/main.src"
G="gold/model.src gold/store.src gold/render.src gold/main.src"
machin encode $G > "$T/gold.mfl"
machin encode $O > "$T/out.mfl"
diff "$T/gold.mfl" "$T/out.mfl" && echo "canonical MFL identical to gold"
machin run "$T/out.mfl" | diff - gold/expected.txt && echo "native output matches"
