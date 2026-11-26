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
post() { req "$1" -H "$AUTH" -H "Content-Type: ${3:-application/json}" --data-binary "$2" "$B/api/links"; }
post "json create" '{"url":"https://example.org/j","title":"from JSON \u00e9 \ud83d\ude00 \"q\"","tag":"json","extra":{"a":[1]}}'
post "json with charset, no tag" '{"url":"https://example.org/k","title":"no tag"}' "application/json; charset=utf-8"
post "json truncated" '{"url":"https://example.org/","title":"cut'
post "json trailing data" '{"url":"https://example.org/","title":"x"} x'
post "json not an object" '["https://example.org/","x"]'
post "json empty" ''
post "json wrong type for url" '{"url":5,"title":"x"}'
post "json null title" '{"url":"https://example.org/","title":null}'
post "json wrong type for optional tag" '{"url":"https://example.org/","title":"x","tag":7}'
post "json newline in title" '{"url":"https://example.org/","title":"two\nlines"}'
post "json half surrogate" '{"url":"https://example.org/","title":"\ud800"}'
post "json duplicate key: first wins" '{"url":"https://example.org/first","url":"https://example.org/second","title":"dup","tag":"json"}'
post "json invalid utf-8" "$(printf '{"url":"https://example.org/","title":"\377"}')"
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
