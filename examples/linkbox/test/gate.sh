#!/bin/sh
# linkbox gate: the same requests must give the identical transcript natively and under Deno,
# and match the committed one. Serves on $PORT (default 18091) and never on a busy port.
#   test/gate.sh            check        UPDATE=1 test/gate.sh   rewrite expected.txt (then read it!)
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd); T=$(mktemp -d); export PORT=${PORT:-18091}
trap 'if [ -n "$KEEP_TMP" ]; then echo "kept $T"; else rm -rf "$T"; fi' EXIT   # KEEP_TMP=1 keeps it for debugging
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
# outgoing notifications: what the receiver gets, and what linkbox logs, must match in both
NPORT=$((PORT + 1))
if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$NPORT/"; then echo "port $NPORT is in use"; exit 2; fi
# notified <name> <receiver: up|down> <server command...>
notified() { name=$1; receiver=$2; shift 2; mkdir -p "$T/n-$name"; rpid=
  ( cd "$T/n-$name"
    if [ "$receiver" = up ]; then
      deno run -A "$ROOT/test/receiver.js" "$NPORT" received.txt & rpid=$!
      for _ in $(seq 50); do curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$NPORT/ready" && break; sleep 0.2; done
    fi
    LINKBOX_TOKEN=test-token LINKBOX_DB="$T/n-$name/links.db" MFL_HTTP_TIMEOUT_MS=1000 LINKBOX_NOTIFY_SECRET=test-notify \
      LINKBOX_NOTIFY_URL="http://127.0.0.1:$NPORT/in" "$@" >server.log 2>&1 &
    pid=$!
    for _ in $(seq 50); do curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/api/tags" && break; sleep 0.2; done
    # the receiver answers 200, then 500, then closes without replying, then never replies
    for n in 1 2 3 4; do curl -s --max-time 8 -w ' %{http_code}\n' -H "Authorization: Bearer test-token" \
      --data-urlencode "url=https://example.org/$n" --data-urlencode "title=café $n" "http://127.0.0.1:$PORT/api/links"; done >replies.txt
    kill "$pid" $rpid 2>/dev/null; wait "$pid" $rpid 2>/dev/null || true )
  touch "$T/n-$name/received.txt"
  { cat "$T/n-$name/replies.txt" "$T/n-$name/received.txt"; grep '^linkbox: notify' "$T/n-$name/server.log" || true; } >"$T/n-$name.txt"; }
for receiver in up down; do
  notified "native-$receiver" $receiver "$ROOT/linkbox"
  notified "deno-$receiver" $receiver deno run -A "$ROOT/test/run.js"
  diff "$T/n-deno-$receiver.txt" "$T/n-native-$receiver.txt" || { echo "FAILED: linkbox: notify ($receiver) native == Deno"; exit 1; }
done
[ "$(grep -c ' 201$' "$T/n-native-up.txt")" = 4 ] && [ "$(grep -c ' 201$' "$T/n-native-down.txt")" = 4 ] ||
  { echo "FAILED: a link must be created whatever the receiver does"; cat "$T"/n-native-*.txt; exit 1; }
# the first notification's signature, checked by openssl so that neither runtime checks itself
sig=$(sed -n 's/^signature //p' "$T/n-native-up/received.txt" | head -1)
sent=$(sed -n 's/^body //p' "$T/n-native-up/received.txt" | head -1)
[ "$sig" = "sha256=$(printf '%s' "$sent" | openssl dgst -sha256 -hmac test-notify | sed 's/.* //')" ] && [ -n "$sent" ] ||
  { echo "FAILED: linkbox: notification signature"; exit 1; }
for line in 'notify answered 500' 'notify failed: empty' 'notify failed: timeout'; do
  grep -q "$line" "$T/n-native-up.txt" || { echo "FAILED: linkbox: expected '$line'"; cat "$T/n-native-up.txt"; exit 1; }; done
[ "$(grep -c 'notify failed: connect' "$T/n-native-down.txt")" = 4 ] || { echo "FAILED: linkbox: receiver down"; exit 1; }
echo "linkbox: notifications native == Deno"
if [ "${UPDATE:-}" = 1 ]; then cp "$T/native.txt" test/expected.txt; fi
diff test/expected.txt "$T/native.txt" || { echo "FAILED: linkbox: transcript as expected"; exit 1; }
echo "linkbox: transcript as expected"
echo "ALL GREEN"
