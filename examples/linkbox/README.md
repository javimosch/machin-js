# linkbox — machin-js example

A small bookmarks API, written as readable JS and compiled to a native binary.

    ./build.sh
    LINKBOX_TOKEN=secret ./linkbox          # http://localhost:8090  (PORT, LINKBOX_DB to change)

| Request | Does | Token |
|---|---|---|
| `GET /api/links?tag=x` | list links, all if no tag | no |
| `GET /api/tags` | link counts per tag | no |
| `POST /api/links` (form fields `url`, `title`, `tag`) | create: `201` | yes |
| `DELETE /api/links/<id>` | delete: `200`, or `404` | yes |

    curl -H "Authorization: Bearer secret" --data-urlencode url=https://machin.dev \
      --data-urlencode title=machin --data-urlencode tag=lang http://localhost:8090/api/links

Input is form-encoded, not JSON: machin's JSON parser never reports bad input, so machin-js doesn't
allow it on outside data. Control characters are rejected, because machin's JSON output would send
most of them unescaped. The token comparison is a plain string comparison, not constant-time: treat
this as an example, not a hardened service.

## Read it

`src/server.js` → `src/routes.js` (routing and the token check) → `src/input.js` (form fields and
validation) → `src/store.js` (SQL) → `src/reply.js` (responses).

## Verify it

    test/gate.sh     # an identical request/response transcript under Deno and natively
