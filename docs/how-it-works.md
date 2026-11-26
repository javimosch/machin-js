# How it works

```text
your .js modules
   │  transpile/transpile.ts   (Deno + acorn): checks the rules, orders modules
   │  transpile/typecheck.ts   (TypeScript checker): checks your JSDoc types
   │  transpile/types.ts       tells the code generator each expression's type
   ▼
.src files  (+ order.txt, native.txt)
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

