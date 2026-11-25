#!/bin/sh
# HTTP smoke test against whatever is serving on :8080 (run from a scratch dir so todos.db is fresh).
set -e
# Writes to the server on :${PORT:-8080} (adds/toggles/deletes todos) — only run against a throwaway instance.
[ "$MACHINJS_SMOKE" = 1 ] || { echo "refusing: set MACHINJS_SMOKE=1 to confirm port ${PORT:-8080} is a throwaway server"; exit 2; }
B=http://127.0.0.1:${PORT:-8080}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
[ "$(code -X POST -d 'title=buy+milk' $B/add)" = 302 ] || { echo "add: want 302"; exit 1; }
[ "$(code -X POST --data-urlencode 'title=write <b>docs</b>' $B/add)" = 302 ] || { echo "add2: want 302"; exit 1; }
code -X POST $B/toggle/1 >/dev/null
J=$(curl -s $B/api/todos | python3 -c 'import sys,json;print(json.dumps(json.load(sys.stdin)))')
[ "$J" = '[{"id": 1, "title": "buy milk", "done": 1}, {"id": 2, "title": "write <b>docs</b>", "done": 0}]' ] || { echo "api: $J"; exit 1; }
H=$(curl -s $B/)
echo "$H" | grep -q '<li class="done">' || { echo "html: no done item"; exit 1; }
echo "$H" | grep -q '&lt;b&gt;docs' || { echo "html: title not escaped"; exit 1; }
code -X POST $B/delete/2 >/dev/null
[ "$(curl -s $B/api/todos | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')" = 1 ] || { echo "delete failed"; exit 1; }
[ "$(code $B/nope)" = 404 ] || { echo "want 404"; exit 1; }
echo "smoke OK"
