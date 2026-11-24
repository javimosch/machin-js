# machin-js

Write machin apps in plain JavaScript (JSDoc-typed), compile to native via machin.
One-directional: JS -> `.src` -> `machin encode/build`. Not part of machin core.

Conventions (enforced by the transpiler, M1): tiny functions, a JSDoc block on every
function (types come from it), and a `//why:` line explaining intent.

Status: **M0** — todo app in `src/`, hand-written expected machin in `gold/`
(the transpiler's target), Deno oracle in `test/`.

    deno run -A test/oracle.ts | diff - gold/expected.txt   # JS under Deno == native output
