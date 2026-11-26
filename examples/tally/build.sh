#!/bin/sh
# Build tally: JS modules -> .src -> machin -> native binary ./tally
set -e
cd "$(dirname "$0")"
rm -rf build && deno run -A ../../transpile/transpile.ts build src/main.js
machin encode $(for f in $(cat build/order.txt); do echo "build/$f.src"; done) > build/tally.mfl
# --safe: an out-of-bounds read stops the program instead of returning a silent empty value.
machin build build/tally.mfl -o tally --safe
echo "built ./tally  (try: ./tally test/fixtures/good.csv)"
