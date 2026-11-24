# machin-js

Write machin apps in plain JavaScript (JSDoc-typed), compile to native via machin.
One-directional: JS -> `.src` -> `machin encode/build`. Not part of machin core.

Conventions (enforced by the transpiler, M1): tiny functions, a JSDoc block on every
function (types come from it), and a `//why:` line explaining intent.

Status: **M2** — a working todo web app (add / toggle / delete, SSR HTML + JSON API),
written as readable JS, compiled to a native binary.

## Run it

    ./build.sh && ./todo        # then open http://localhost:8080

Needs `deno`, `machin`, and a C compiler (`cc`). `machweb.src` is read from the machin repo
(`MACHIN_FRAMEWORK`, default `~/ai/machin/framework`).

## Read it

Start at `src/routes.js` (`handle`), then `src/store.js` (SQLite) and `src/render.js` (HTML).
Every function is tiny, has a JSDoc block (the types) and a `//why:` line (the intent).

## Verify it

    test/gate.sh                       # JS->machin == gold; demo native==Deno; HTTP smoke on Deno AND native
    deno test -A test/diag_test.ts     # JS-DOC001 / JS-WHY001 / JS-SIZE001 / JS-UNSUP001 / JS-FNVAL001

Diagnostics fail the run (exit 1) with `file:line: CODE message`.

## Subset notes (what you can't write yet)

No classes, async, template literals, `??`, `switch`, method calls (`a.push`), object literals,
`continue` in `for`, or block-bodied arrows. Named functions aren't values in machin: pass
`(req) => handle(req)`, not `handle` (JS-FNVAL001).
