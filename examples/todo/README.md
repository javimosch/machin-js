# todo — machin-js example

A todo app (web + desktop) written as readable JS, compiled to native machin. It is also the
transpiler's main regression fixture (`gold/`).

## Run it

    ./build.sh && ./todo        # then open http://localhost:8080  (PORT=9000 ./todo to change)

Needs `deno`, `machin`, and a C compiler (`cc`).

## Desktop (spike)

    ./build-desktop.sh && ./todo-desktop     # a raylib window; shares todos.db with the web app

Click a todo to toggle it, `x` to delete, type + Enter to add. Needs a display and a static raylib
(`RAYLIB_DIR`, default `~/ai/tinybrain/vendor/raylib-5.0_linux_amd64`). JS can't express FFI, so the
raylib `extern` block lives once in `bindings/desktop.src` behind a scalar-only API
(`import { ui_button } from "machin/desktop"`, typed in `types/desktop.d.ts`). `src/desktop.js` is the
shell; it reuses `src/store.js` unchanged. Verified by `test/desktop_input.sh`: real X clicks and typing
on a private Xvfb display, then the database is checked.

## Read it

Plain ES modules: every dependency is an `import`, every public function an `export`.
Builtins come from `"machin"` (typed in `types/machin.d.ts`, generated from `machin guide`),
the web layer from `"machin/web"`. Start at `src/routes.js` (`handle`), then `src/store.js` (SQLite) and `src/render.js` (HTML).
Every function is tiny, has a JSDoc block (the types) and a `//why:` line (the intent).

## Verify it

    test/gate.sh                       # JS->machin == gold; demo native==Deno; HTTP smoke on Deno AND native; desktop input

The gate serves on its own port (`PORT`, default 18080), never on 8080, and refuses to run if that
port is busy: the HTTP smoke test adds/toggles/deletes todos, so it must only hit a throwaway server.

Diagnostics fail the run (exit 1) with `file:line: CODE message`.

## What you can write

See [the language page](../../docs/language.md) and [the diagnostics](../../docs/diagnostics.md).
Transpiler tests run from the repo root: `deno task test`.
