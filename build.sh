#!/bin/sh
# Build the todo server: JS modules -> .src (dependency order) -> machin -> native binary ./todo
set -e
cd "$(dirname "$0")"
FW=${MACHIN_FRAMEWORK:-$HOME/ai/machin/framework}   # machweb.src lives in the machin repo
rm -rf build && deno run -A transpile/transpile.ts build src/server.js
SRCS=$(for f in $(cat build/order.txt); do echo "build/$f.src"; done)
machin encode "$FW/machweb.src" $SRCS > build/todo.mfl
machin build build/todo.mfl -o todo
echo "built ./todo  (run it, then open http://localhost:8080)"
