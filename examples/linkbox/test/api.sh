#!/bin/sh
# Print a transcript of requests and responses from the linkbox on :$PORT.
# It CREATES and DELETES links, so only run it against a throwaway server (MACHINJS_SMOKE=1).
[ "$MACHINJS_SMOKE" = 1 ] || { echo "refusing: set MACHINJS_SMOKE=1 to confirm port $PORT is a throwaway server"; exit 2; }
B=http://127.0.0.1:$PORT
AUTH="Authorization: Bearer test-token"
# req <label> <curl args...>: status, content type (without parameters) and body
req() { printf '== %s\n' "$1"; shift
  curl -s --max-time 5 -o body -w '%{http_code} %{content_type}\n' "$@" | sed 's/;.*//'; cat body; echo; }
add() { req "$1" -H "$AUTH" --data-urlencode "url=$2" --data-urlencode "title=$3" --data-urlencode "tag=$4" "$B/api/links"; }
req "empty list" "$B/api/links"
req "empty tags" "$B/api/tags"
req "no token" -d 'url=http://a&title=a' "$B/api/links"
req "wrong token" -H "Authorization: Bearer nope" -d 'url=http://a&title=a' "$B/api/links"
req "bare bearer" -H "Authorization: Bearer " -d 'url=http://a&title=a' "$B/api/links"
add "create" "https://machin.dev/a?x=1&y=2" 'Quotes " and <tags> & co' lang
add "create unicode" "http://example.org/é" "café ☃ 100%" food
add "create third" "https://example.org/3" "three" lang
add "bad scheme" "javascript:alert(1)" "x" lang
add "no title" "https://example.org/" "" lang
add "newline in title" "https://example.org/" "two
lines" lang
add "control byte in tag" "https://example.org/" "x" "$(printf 'a\001b')"
add "delete byte in url" "$(printf 'https://example.org/\177')" "x" lang
add "literal percent codes are fine" "https://example.org/%0A%1F" "%00 is just text" pct
add "too long tag" "https://example.org/" "x" "$(printf 'x%.0s' $(seq 51))"
req "list all" "$B/api/links"
req "list by tag" "$B/api/links?tag=lang"
req "tag with injection attempt" "$B/api/links?tag=x%27%20OR%20%271%27%3D%271"
req "tags" "$B/api/tags"
req "delete" -X DELETE -H "$AUTH" "$B/api/links/1"
req "delete again" -X DELETE -H "$AUTH" "$B/api/links/1"
req "delete junk id" -X DELETE -H "$AUTH" "$B/api/links/abc"
req "delete without token" -X DELETE "$B/api/links/2"
req "unknown get" "$B/nope"
req "unknown post" -H "$AUTH" -d x=1 "$B/api/nope"
req "after delete" "$B/api/links"
rm -f body
