# machin-js

Write machin apps in plain JavaScript (JSDoc-typed ES modules), compile to native via machin.
One-directional: JS -> `.src` -> `machin encode/build`. Not part of machin core; it shells out to `machin`.

Built for a human who wants a codebase they can read and maintain when the agent is off:
tiny functions, a JSDoc block on every function (the types come from it), and a `//why:` line
for intent. The transpiler enforces this, so agent-written code stays readable.

## Layout

    transpile/    the transpiler (Deno + acorn)         -> emits machin .src, checks the rules
    types/        machin.d.ts (generated from `machin guide`), machweb.d.ts, desktop.d.ts
    bindings/     machin code a JS import needs (desktop.src: raylib FFI behind a scalar API)
    shim/         Deno twins of the builtins, so JS runs as plain JS (the oracle)
    tools/        gen-dts.ts  (regenerate types/machin.d.ts)
    test/         unit tests for the transpiler's diagnostics
    examples/todo a todo app: web + desktop shells over one shared core  (start reading here)

## Use

    deno test -A test/diag_test.ts          # transpiler unit tests
    examples/todo/test/gate.sh              # full check: gold, oracle, HTTP smoke, desktop input
    deno run -A tools/gen-dts.ts            # after upgrading machin

Needs `deno`, `machin`, and a C compiler. Machin modules: `"machin"` (builtins), `"machin/web"`
(machweb), `"machin/desktop"` (raylib UI). See `examples/todo/README.md` for the app.

## Rules the transpiler enforces

`JS-DOC001` no JSDoc · `JS-WHY001` no `//why:` · `JS-SIZE001` function over 20 lines ·
`JS-UNSUP001` unsupported syntax · `JS-FNVAL001` function used as a value (use an arrow) ·
`JS-UNDEF001` name not declared or imported · `JS-IMPORT001/002` bad import ·
`JS-DUP001` same function name in two modules · `JS-CYCLE001` import cycle.
Diagnostics print `file:line: CODE message` and exit 1.

## Subset notes

No classes, async, template literals, `??`, `switch`, method calls (`a.push`), object literals,
`continue` in `for`, block-bodied arrows, top-level `const`, or ternaries except `const x = c ? a : b`.
Named functions aren't values in machin: pass `(req) => handle(req)`, not `handle`.
