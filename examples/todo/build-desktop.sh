#!/bin/sh
# Build the desktop todo: JS modules -> .src -> machin (+raylib, static) -> native binary ./todo-desktop
set -e
cd "$(dirname "$0")"
RL=${RAYLIB_DIR:-$HOME/ai/tinybrain/vendor/raylib-5.0_linux_amd64}   # prebuilt static raylib 5.0
[ -f "$RL/lib/libraylib.a" ] || { echo "no raylib at $RL (set RAYLIB_DIR)"; exit 1; }
rm -rf build-desktop && deno run -A ../../transpile/transpile.ts build-desktop src/desktop.js
SRCS=$(for f in $(cat build-desktop/order.txt); do echo "build-desktop/$f.src"; done)
machin encode $(cat build-desktop/native.txt) $SRCS > build-desktop/todo.mfl
# Point cc at the vendored raylib and link its static archive, so the binary needs no libraylib.so.
# --safe: an out-of-bounds read stops the program instead of returning a silent empty value.
machin build build-desktop/todo.mfl -o todo-desktop --safe \
  --cflags "-I$RL/include" --ldflags "-L$RL/lib" --static-link raylib
echo "built ./todo-desktop  (run it from a terminal; needs a display)"
