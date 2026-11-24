# machin-js

Write machin apps in plain JavaScript (JSDoc-typed), compile to native via machin.
One-directional: JS -> `.src` -> `machin encode/build`. Not part of machin core.

Conventions (enforced by the transpiler, M1): tiny functions, a JSDoc block on every
function (types come from it), and a `//why:` line explaining intent.

Status: **M1** — Deno+acorn transpiler (`transpile/`), gated against hand-written `gold/`.
(the transpiler's target), Deno oracle in `test/`.

    deno run -A test/oracle.ts | diff - gold/expected.txt   # JS under Deno == native output

    test/gate.sh                       # src/*.js -> .src: canonical MFL == gold, native output == expected
    deno test -A test/diag_test.ts     # JS-DOC001 / JS-WHY001 / JS-SIZE001 / JS-UNSUP001

Diagnostics fail the run (exit 1) with `file:line: CODE message`.
