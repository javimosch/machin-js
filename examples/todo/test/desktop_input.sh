#!/bin/sh
# Desktop input test: real clicks + typing on a private Xvfb display, then check the database.
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d); D=:97
# screen == window size, so the (centered) window sits at 0,0 and click coordinates match
Xvfb $D -screen 0 480x420x24 >/dev/null 2>&1 & XV=$!
trap 'kill $XV 2>/dev/null; [ -n "$KEEP_TMP" ] || rm -rf "$T"' EXIT
sleep 1
( cd "$T" && DISPLAY=$D TODO_DB="$T/t.db" SEED=1 timeout 40 "$OLDPWD/todo-desktop" >/dev/null 2>&1 ) &
python3 test/desktop_input.py $D
wait %2 2>/dev/null || true
R=$(deno eval "import {DatabaseSync} from 'node:sqlite'; console.log(JSON.stringify(new DatabaseSync('$T/t.db').prepare('select title,done from todos order by id').all()))")
[ "$R" = '[{"title":"write the docs","done":1},{"title":"call mum","done":0},{"title":"hello","done":0}]' ] && echo "desktop input OK: $R" || { echo "desktop input FAILED: $R"; exit 1; }
