#!/bin/sh
# Build linkbox: JS modules -> .src -> machin -> native binary ./linkbox
set -e
cd "$(dirname "$0")"
rm -rf build && deno run -A ../../transpile/transpile.ts build src/server.js
machin encode $(cat build/native.txt) $(for f in $(cat build/order.txt); do echo "build/$f.src"; done) > build/linkbox.mfl
# --safe: an out-of-bounds read stops the program instead of returning a silent empty value.
machin build build/linkbox.mfl -o linkbox --safe
echo "built ./linkbox  (LINKBOX_TOKEN=secret ./linkbox)"
