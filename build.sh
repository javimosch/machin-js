#!/bin/sh
# Build the todo server: JS -> .src -> machin -> native binary ./todo
set -e
cd "$(dirname "$0")"
FW=${MACHIN_FRAMEWORK:-$HOME/ai/machin/framework}   # machweb.src lives in the machin repo
deno run -A transpile/transpile.ts build src/model.js src/store.js src/render.js src/routes.js src/server.js
machin encode "$FW/machweb.src" build/model.src build/store.src build/render.src build/routes.src build/server.src > build/todo.mfl
machin build build/todo.mfl -o todo
echo "built ./todo  (run it, then open http://localhost:8080)"
