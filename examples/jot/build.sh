#!/bin/sh
# Build jot: JS modules -> .src -> machin -> native binary ./jot
set -e
cd "$(dirname "$0")"
rm -rf build && deno run -A ../../transpile/transpile.ts build src/main.js
machin encode $(cat build/native.txt) $(for f in $(cat build/order.txt); do echo "build/$f.src"; done) > build/jot.mfl
# --safe: an out-of-bounds read stops the program instead of returning a silent empty value.
machin build build/jot.mfl -o jot --safe
echo "built ./jot  (try: ./jot guide --human)"
