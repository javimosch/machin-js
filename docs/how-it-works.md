# How it works

```text
your .js modules
   │  transpile/transpile.ts   (Deno + acorn): checks the rules, orders modules
   │  transpile/typecheck.ts   (TypeScript checker): checks your JSDoc types
   │  transpile/types.ts       tells the code generator each expression's type
   ▼
.src files  (+ order.txt, native.txt, and machin_js_guard.src: the checks that
   │                       make a crash name your .js line)
   │  machin encode            canonical MFL
   ▼
.mfl
   │  machin build             types, C, cc
   ▼
native binary
```

The same `.js` also runs under Deno: `deno.json` maps `"machin"` and `"machin/web"` to the
stand-ins in `shim/`. The stand-ins cover only what the todo app uses, so a new builtin needs one
added. `"machin/desktop"` has none.

## Testing

| Check | What it shows |
|---|---|
| `deno test -A test/` | diagnostics fire, and the docs' marked examples behave as stated |
| `test/types_test.ts` | the typings are valid, the todo app type-checks, and type mistakes stop a build |
| crash cases (in `test/parity_test.ts`) | each kind of crash names the right JavaScript line, with and without `--safe` |
| `test/cli_test.ts` | the `machin-js` command: new, check, run, debug, exit codes, and the editor setup |
| `tools/smoke-release.sh` | the compiled binary works with no checkout of machin-js or machin and an empty home |
| `.github/workflows/latest-machin.yml` | weekly: the tests and app gates against the newest machin release |
| `test/json_test.ts` | `json_valid` and `machin/json` agree on hand-picked and random documents, many of them broken |
| `test/syntax_test.ts` | 190 JavaScript constructs each behave the same or are refused with a pinned code; also generates the [reference](specification.md) |
| parity cases (`test/parity_test.ts`) | each tricky program behaves natively as under Deno, or is rejected with the expected code |
| random programs (`test/fuzz_test.ts`, `tools/fuzz.ts`) | generated well-typed programs behave the same under Deno and natively; 30 fixed seeds run in the tests, and `deno run -A tools/fuzz.ts 600 1234` searches further |
| `test/shim_test.ts` | the Deno stand-ins for string and list builtins give the same results as the real ones |
| `examples/tally/test/gate.sh` | the CLI app's output, errors and exit codes are identical under Deno and natively |
| `examples/linkbox/test/gate.sh` | a full transcript of API requests and responses is identical under Deno and natively |
| gold comparison | transpiler output has not changed unexpectedly |
| demo, Deno and native | both produce the same output |
| HTTP smoke test, Deno and native | the same requests give the expected results on both |
| desktop input test | real X clicks and typing on a private display change the database |

Run everything except the unit tests with `examples/todo/test/gate.sh`. It serves on port 18080
(`PORT` to change) and refuses to start if the port is busy, because the smoke test **writes** to
whatever server it talks to. The desktop step is skipped when raylib or Xvfb is missing.

The gold files for the web modules are reviewed snapshots of transpiler output. They catch
regressions, but they don't independently prove the transpiler correct. The Deno-versus-native
checks are the independent ones.

> Until 2026-11-26, some gate scripts wrote comparisons as `diff … && echo ok`. Under `set -e` a
> failing `diff` there does **not** stop the script, so they could print `ALL GREEN` over a
> mismatch. They now fail explicitly, and each app's gate was checked against a planted mismatch.
> Re-running the fixed todo and tally gates on the previously published code found no hidden failure.

Native builds use machin's `--safe`, which adds overflow and stack-depth checks. machin reports that
its stack check makes recursion-heavy code about twice as slow in its own benchmark; machin-js
hasn't measured it.

