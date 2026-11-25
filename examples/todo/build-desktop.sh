#!/bin/sh
# Build the desktop todo: JS modules -> .src -> machin (+raylib, static) -> native binary ./todo-desktop
set -e
cd "$(dirname "$0")"
RL=${RAYLIB_DIR:-$HOME/ai/tinybrain/vendor/raylib-5.0_linux_amd64}   # prebuilt static raylib 5.0
[ -f "$RL/lib/libraylib.a" ] || { echo "no raylib at $RL (set RAYLIB_DIR)"; exit 1; }
rm -rf build-desktop && deno run -A ../../transpile/transpile.ts build-desktop src/desktop.js
SRCS=$(for f in $(cat build-desktop/order.txt); do echo "build-desktop/$f.src"; done)
# point the raylib extern block at the vendored headers and static lib (same recipe as machin's games)
machin encode $(cat build-desktop/native.txt) $SRCS \
  | sed "s#header \"raylib.h\"#cflags \"-I$RL/include -L$RL/lib\" header \"raylib.h\"#; s#link \"raylib\"#link \":libraylib.a\"#" \
  > build-desktop/todo.mfl
# --safe: an out-of-bounds read stops the program instead of returning a silent empty value
machin build build-desktop/todo.mfl -o todo-desktop --safe
echo "built ./todo-desktop  (run it from a terminal; needs a display)"
