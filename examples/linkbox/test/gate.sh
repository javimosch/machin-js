#!/bin/sh
# linkbox gate: the same requests must give the identical transcript natively and under Deno,
# and match the committed one. Serves on $PORT (default 18091) and never on a busy port.
#   test/gate.sh            check        UPDATE=1 test/gate.sh   rewrite expected.txt (then read it!)
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd); T=$(mktemp -d); export PORT=${PORT:-18091}
if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/"; then
  echo "port $PORT is in use — set PORT to a free one; the test writes to the server"; exit 2; fi
./build.sh >/dev/null
rc=0; LINKBOX_TOKEN= timeout 5 ./linkbox >/dev/null 2>&1 || rc=$?
[ "$rc" = 2 ] || { echo "FAILED: without a token linkbox must exit 2, got $rc"; exit 1; }
echo "linkbox: refuses to start without a token"
# transcript <name> <server command...>: fresh directory and database per runtime
transcript() { name=$1; shift; mkdir -p "$T/$name"
  ( cd "$T/$name"
    LINKBOX_TOKEN=test-token LINKBOX_HOOK_SECRET=test-hook LINKBOX_DB="$T/$name/links.db" "$@" >server.log 2>&1 &
    pid=$!
    for _ in $(seq 50); do curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/api/tags" && break; sleep 0.2; done
    MACHINJS_SMOKE=1 sh "$ROOT/test/api.sh" > "$T/$name.txt"
    kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null || true ); }
transcript native "$ROOT/linkbox"
transcript deno deno run -A "$ROOT/test/run.js"
diff "$T/deno.txt" "$T/native.txt" || { echo "FAILED: linkbox: native == Deno"; exit 1; }
echo "linkbox: native == Deno"
# with no secret set there is no hook, even for a signature made with the empty key
( cd "$T/native" && LINKBOX_TOKEN=test-token LINKBOX_DB="$T/nosecret.db" "$ROOT/linkbox" >/dev/null 2>&1 &
  pid=$!
  for _ in $(seq 50); do curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/api/tags" && break; sleep 0.2; done
  body='{"url":"https://example.org/","title":"x"}'
  sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "" | sed 's/.* //')
  curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "Content-Type: application/json" -H "X-Signature: sha256=$sig" --data-binary "$body" "http://127.0.0.1:$PORT/api/hooks/link" >"$T/code"
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null || true )
[ "$(cat "$T/code")" = 404 ] || { echo "FAILED: without a hook secret the hook must answer 404, got $(cat "$T/code")"; exit 1; }
echo "linkbox: no hook without a secret"
if [ "${UPDATE:-}" = 1 ]; then cp "$T/native.txt" test/expected.txt; fi
diff test/expected.txt "$T/native.txt" || { echo "FAILED: linkbox: transcript as expected"; exit 1; }
echo "linkbox: transcript as expected"
echo "ALL GREEN"
