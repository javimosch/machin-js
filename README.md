<p align="center">
  <img src="assets/logo.svg" width="128" alt="machin-js logo: a gear with curly braces">
</p>

<h1 align="center">machin-js</h1>

<p align="center">
  <b>Write native <a href="https://github.com/javimosch/machin">machin</a> apps in plain JavaScript —<br>readable enough to maintain when the agent is off.</b>
</p>

<p align="center">
  <img alt="status: alpha" src="https://img.shields.io/badge/status-alpha-orange">
  <a href="https://github.com/javimosch/machin-js/releases"><img alt="release: v0.8.0" src="https://img.shields.io/badge/release-v0.8.0-1f1470"></a>
  <img alt="license: MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="runtime: Deno" src="https://img.shields.io/badge/toolchain-Deno-black">
  <img alt="targets: machin" src="https://img.shields.io/badge/compiles%20to-machin%20→%20native-1f1470">
</p>

<p align="center">
  <a href="https://javimosch.github.io/machin-js/"><b>Docs site</b></a> ·
  <a href="docs/VISION.md">Vision</a> ·
  <a href="docs/NORTH-STAR.md">North star</a> ·
  <a href="docs/ROADMAP.md">Roadmap</a> ·
  <a href="docs/debugging.md">Debugging</a> ·
  <a href="docs/specification.md">Reference</a> ·
  <a href="docs/compatibility.md">Compatibility (draft)</a> ·
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

The JSDoc is both the documentation and the types the build checks.

## The rules (compiler errors, not style advice)

| Code | Rule |
|---|---|
| `JS-DOC001` | every function has a JSDoc block |
| `JS-WHY001` | every function has a `//why:` comment saying *why*, not *what* |
| `JS-SIZE001` | functions are at most 20 lines |
| `JS-UNDEF001` | a name must be declared, or imported from `"machin"`, `"machin/web"`, `"machin/desktop"` or a local module |
| `JS-IMPORT001/002` | imports must resolve and name something that is actually exported |
| `JS-DUP001` / `JS-CYCLE001` | no two modules define the same function (machin has one namespace); no import cycles |
| `JS-FNVAL001` | a machin builtin can't be passed as a value — wrap it in an arrow (your own functions can) |
| `JS-RET001` / `JS-SCOPE001` | every path of a valued function returns; no shadowed names |
| `JS-NUM001/002` / `JS-STR001` | no decimals, plain `/` or non-ASCII literals yet (they would behave differently) |
| `JS-ADD001` `CMP001` `VAL001` `STR002` `ARR001` `ANY001` `LOG001` | type-based rules: reject what would behave differently natively |
| `JS-MAP001` | a `Map` is read with `m.get(k) ?? fallback` and never looped over |
| `JS-COND001` | conditions are `true` or `false` (no truthiness) |
| `JS-ORDER001` | element updates whose index would be evaluated twice, or out of order |
| `JS-TYPE001` | your JSDoc types are checked (by the TypeScript checker, on plain `.js`) |
| `JS-UNSUP001` | anything outside the supported allow-list is rejected |

Diagnostics print `file:line: CODE message` and exit non-zero, so an agent writing in this mode
can't produce code a human can't read.

## What's in the box

- **Transpiler** (`transpile/`) — Deno + [acorn](https://github.com/acornjs/acorn); resolves ES modules, orders them by dependency, emits machin `.src`.
- **Typed builtins** (`types/machin.d.ts`) — generated from `machin guide`, so they never drift from the compiler.
- **Run it as plain JS** (`shim/`) — Deno twins of the builtins, so the same modules run under a normal debugger and can be diffed against the native build.
- **Bridges** — `machin/web` (machweb HTTP server), `machin/json` (typed reading of outside JSON), `machin/text` (padding) and `machin/desktop` (a raylib UI behind a scalar-only API, since JS can't express FFI).
- **[`examples/linkbox`](examples/linkbox)** — a bookmarks API: token auth, validation, SQLite, JSON responses.
- **[`examples/tally`](examples/tally)** — a command-line expense summarizer: arguments, files, errors on stderr and exit codes.
- **[`examples/todo`](examples/todo)** — a todo app with a **web** shell (SSR + JSON API) and a **desktop** shell (raylib window) over one shared core, and a gate that checks both.

## Quick start

Linux x86-64, with [`machin`](https://github.com/javimosch/machin) 0.144.0 or newer and a C compiler.
Download the [latest release](https://github.com/javimosch/machin-js/releases) (an alpha prerelease), or
follow [Getting started](https://javimosch.github.io/machin-js/getting-started/), which also installs
machin and checks both downloads.

```sh
machin-js new ~/hello && cd ~/hello
machin-js run main.js                      # prints: hello world
machin-js debug main.js --inspect-brk      # as plain JavaScript with a debugger (needs deno)
```

Working on machin-js itself:

```sh
deno test -A test/                         # transpiler, parity, typings, docs and command tests
examples/todo/test/gate.sh                 # also: examples/tally and examples/linkbox
```

## How it is verified

- The transpiler's output is checked against hand-reviewed **gold** `.src` files (canonical form compared).
- The demo's output must be identical under **Deno** and as a **native** binary.
- One **HTTP smoke test** runs against both the Deno-served and the native server.
- The desktop shell is driven with **real X clicks and keystrokes** on a private Xvfb display, then the database is checked.

## Honest limits

This is an **alpha**. It has three worked examples, and the language is a deliberately small subset:

- **Supported:** `Map` lookups, functions (also as values), `const`/`let`, `if`/`while`/`for`/`for…of`, integer and string operations, template literals, `Math.trunc` division, arrays (with `push` while unshared), object literals as `@typedef` structs, ES modules.
- **Not yet:** decimals, classes, `async`, `??`, `switch`, `.map`/`.filter`, looping over a `Map`, `continue`, block-bodied arrows.
- **Never (by design):** prototypes, `this`, `eval`, dynamic keys, `==` coercion, npm.
- **Numbers and strings:** numbers are integers (no decimals yet), and strings are counted in bytes (`len`, `substr`).
- **JSON input:** read field by field with `machin/json` (top-level fields only); `parse` is for database rows and JSON your code builds.
- **Known differences:** some behavior can still differ from plain JavaScript; they are [listed](docs/language.md#known-differences).
- **Debugging:** out-of-range list access and division by zero stop with your `file.js:line:column` and the expression; endless recursion still crashes with no message. See [Debugging](docs/debugging.md).

Where this is going, in measurable steps: [docs/NORTH-STAR.md](docs/NORTH-STAR.md).

## Layout

```
transpile/     the transpiler
types/         machin.d.ts (generated), machweb.d.ts, desktop.d.ts
bindings/      machin code a JS import needs (desktop.src: raylib FFI)
shim/          Deno twins of the builtins
tools/         gen-dts.ts — regenerate types/machin.d.ts after upgrading machin
cli/           the machin-js command
test/          diagnostics, parity, typings, docs examples, command and random-program tests
examples/todo/ the example app (start reading here)
docs/          human documentation (start at index.md), vision, north star
```

## Docs site

CI (`.github/workflows/test.yml`) runs the tests and the todo gate against a pinned machin; the desktop check is skipped there.

Built with [Lume](https://lume.land) (pinned to 3.2.0, which runs on Deno 2.2.8) and deployed by `.github/workflows/pages.yml`.

```sh
cd docs && deno task build && cd .. && deno run --allow-read docs/_check_links.ts
```

## License

[MIT](LICENSE) © Javier Leandro Arancibia
