# linkbox — machin-js example

A small bookmarks API, written as readable JS and compiled to a native binary.

    ./build.sh
    LINKBOX_TOKEN=secret ./linkbox          # http://localhost:8090  (PORT, LINKBOX_DB to change)

| Request | Does | Token |
|---|---|---|
| `GET /api/links?tag=x` | list links, all if no tag | no |
| `GET /api/tags` | link counts per tag | no |
| `POST /api/links` (JSON or form: `url`, `title`, optional `tag`) | create: `201` | yes |
| `DELETE /api/links/<id>` | delete: `200`, or `404` | yes |
| `POST /api/hooks/link` (JSON) | create from another service, if `LINKBOX_HOOK_SECRET` is set | signature |

    curl -H "Authorization: Bearer secret" --data-urlencode url=https://machin.dev \
      --data-urlencode title=machin --data-urlencode tag=lang http://localhost:8090/api/links

The body can be JSON (`Content-Type: application/json`) or form fields. JSON is read with
`machin/json`, field by field, so bad JSON and wrong types get a `400` instead of turning into empty
values. Control characters are rejected, because a URL, title and tag are each one line.
### The signed webhook

The sender puts `sha256=` and the HMAC-SHA-256 of the exact body, in hex, in `X-Signature`:

    BODY='{"url":"https://machin.dev","title":"machin"}'
    SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$LINKBOX_HOOK_SECRET" | sed 's/.* //')
    curl -H "Content-Type: application/json" -H "X-Signature: sha256=$SIG" \
      --data-binary "$BODY" http://localhost:8090/api/hooks/link

The token and signature are compared with `digest_equal` from `machin/crypto`. A signed request
carries no time or id, so **someone who captures one can send it again**. This is an example, not a
hardened service.

## Read it

`src/server.js` → `src/routes.js` (routing and the token check) → `src/hook.js` (the signed webhook) → `src/input.js` (form fields and
validation) → `src/store.js` (SQL) → `src/reply.js` (responses).

## Verify it

    test/gate.sh     # an identical request/response transcript under Deno and natively
