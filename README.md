<p align="center">
  <img src="assets/logo.svg" width="128" alt="machin-js logo: a gear with curly braces">
</p>

<h1 align="center">machin-js</h1>

<p align="center">
  <b>Write native <a href="https://github.com/javimosch/machin">machin</a> apps in plain JavaScript —<br>readable enough to maintain when the agent is off.</b>
</p>

<p align="center">
  <img alt="status: alpha" src="https://img.shields.io/badge/status-alpha-orange">
  <img alt="license: MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="runtime: Deno" src="https://img.shields.io/badge/toolchain-Deno-black">
  <img alt="targets: machin" src="https://img.shields.io/badge/compiles%20to-machin%20→%20native-1f1470">
</p>

<p align="center">
  <a href="docs/index.md"><b>Docs</b></a> ·
  <a href="docs/VISION.md">Vision</a> ·
  <a href="docs/NORTH-STAR.md">North star</a> ·
  <a href="examples/todo">Example: todo app</a>
</p>

---

**machin-js** is a transpiler from a strict, JSDoc-typed subset of JavaScript (ES modules) to
[machin](https://github.com/javimosch/machin)'s MFL. machin then compiles that to a single native binary.
It is one-directional and sits *on top of* machin: it shells out to `machin`, and changes nothing in it.

machin is agent-first. machin-js is the **human on-ramp**: JavaScript you already know, with a
readability standard the compiler enforces, so the person who owns the code can still read, debug
and change it when no agent is around.

## What it looks like

```js
/**
 * Flip a todo between done and not done.
 * @param {int} db
 * @param {int} id
 * @returns {int} sqlite result code, 0 on success.
 */
export function toggleTodo(db, id) {
  //why: 1 - done flips 0<->1 in SQL, so no read-modify-write race.
  return sqlite_exec(db, "UPDATE todos SET done = 1 - done WHERE id = ?", [String(id)]);
}
```

becomes:

```go
func toggleTodo(db, id) (r) {
    return sqlite_exec(db, "UPDATE todos SET done = 1 - done WHERE id = ?", []string{str(id)})
}
```

The JSDoc is the type system and the documentation at once, so they cannot drift apart.

## The rules (compiler errors, not style advice)

| Code | Rule |
|---|---|
| `JS-DOC001` | every function has a JSDoc block |
| `JS-WHY001` | every function has a `//why:` comment saying *why*, not *what* |
| `JS-SIZE001` | functions are at most 20 lines |
| `JS-UNDEF001` | a name must be declared, or imported from `"machin"`, `"machin/web"`, `"machin/desktop"` or a local module |
| `JS-IMPORT001/002` | imports must resolve and name something that is actually exported |
| `JS-DUP001` / `JS-CYCLE001` | no two modules define the same function (machin has one namespace); no import cycles |
| `JS-FNVAL001` | a function name can't be passed as a value — wrap it in an arrow |
| `JS-UNSUP001` | anything outside the supported subset is rejected, never silently emitted |

Diagnostics print `file:line: CODE message` and exit non-zero, so an agent writing in this mode
can't produce code a human can't read.

## What's in the box

- **Transpiler** (`transpile/`) — Deno + [acorn](https://github.com/acornjs/acorn); resolves ES modules, orders them by dependency, emits machin `.src`.
- **Typed builtins** (`types/machin.d.ts`) — generated from `machin guide`, so they never drift from the compiler.
- **Run it as plain JS** (`shim/`) — Deno twins of the builtins, so the same modules run under a normal debugger and can be diffed against the native build.
- **Bridges** — `machin/web` (machweb HTTP server) and `machin/desktop` (a raylib UI behind a scalar-only API, since JS can't express FFI).
- **[`examples/todo`](examples/todo)** — a todo app with a **web** shell (SSR + JSON API) and a **desktop** shell (raylib window) over one shared core, and a gate that checks both.

## Quick start

Needs [`deno`](https://deno.com), [`machin`](https://github.com/javimosch/machin) (developed against 0.142.1) and a C compiler.

```sh
git clone https://github.com/javimosch/machin-js && cd machin-js

deno test -A test/diag_test.ts            # transpiler unit tests

cd examples/todo
./build.sh && ./todo                      # web app on http://localhost:8080
./build-desktop.sh && ./todo-desktop      # desktop window (needs raylib + a display)
test/gate.sh                              # everything: gold files, Deno-vs-native, HTTP smoke, desktop input
```

## How it is verified

- The transpiler's output is checked against hand-reviewed **gold** `.src` files (canonical form compared).
- The demo's output must be identical under **Deno** and as a **native** binary.
- One **HTTP smoke test** runs against both the Deno-served and the native server.
- The desktop shell is driven with **real X clicks and keystrokes** on a private Xvfb display, then the database is checked.

## Honest limits

This is an **alpha**. It has one worked example, and the language is a deliberately small subset:

- **Supported:** functions, closures via arrows, `const`/`let`, `if`/`while`/`for`, string/int arithmetic, arrays of strings, `@typedef` structs, ES-module imports/exports.
- **Not yet:** classes, `async`, template literals, `??`, `switch`, method calls like `.push`, object literals, `continue` in `for`, block-bodied arrows, typed arrays beyond `string`.
- **Never (by design):** prototypes, `this`, `eval`, dynamic keys, `==` coercion, npm.
- **Numbers and strings:** `int`/`float` come from JSDoc; machin strings are bytes, not UTF-16 — see the [open questions](docs/NORTH-STAR.md#open-questions).
- **No source maps yet:** a native panic reports machin lines, not `file.js:line`.

Where this is going, in measurable steps: [docs/NORTH-STAR.md](docs/NORTH-STAR.md).

## Layout

```
transpile/     the transpiler
types/         machin.d.ts (generated), machweb.d.ts, desktop.d.ts
bindings/      machin code a JS import needs (desktop.src: raylib FFI)
shim/          Deno twins of the builtins
tools/         gen-dts.ts — regenerate types/machin.d.ts after upgrading machin
test/          transpiler diagnostics tests + checks of the docs' examples
examples/todo/ the example app (start reading here)
docs/          human documentation (start at index.md), vision, north star
```

## License

[MIT](LICENSE) © Javier Leandro Arancibia
