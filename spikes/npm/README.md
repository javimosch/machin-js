# Spike: using popular npm libraries from a machin-js app

**Status: exploration on branch `spike/npm`, not part of machin-js.** The feature freeze is in force,
and "no npm" is still a non-goal in the vision. Measured 2026-11-26 with machin 0.144.3 on Linux x86-64.

## Short answer
- **A. Compiling a library's source through machin-js: no.** Published code is outside the subset.
- **B. Running it unchanged in QuickJS inside the native binary: yes, for data-in, data-out
  libraries** — but machin-js's guarantee does not extend to it.

## A. Compile the library (`deno run -A measure.ts`)
| Source file | Lines | Language problems |
|---|---|---|
| escape-string-regexp | 12 | 1 (`export default`) |
| lodash-es `chunk.js` alone | 51 | 13, before its imports |
| ms | 163 | 35 |
| slugify | 70 | 2, but they reject the wrapper holding the whole library, so its body isn't checked |
| marked | 2569 | 135 |

These counts are lower bounds. The libraries rely on dynamic types, `var`, top-level values,
closures and objects as dictionaries. Accepting them would mean a general JavaScript compiler.

## B. Embed QuickJS (`./setup.sh && deno run -A run.ts`)
Each `adapters/<lib>.js` is a small module with plain functions. esbuild bundles it with the library;
the bundle is compiled into the binary as a string; native code calls it with JSON and gets JSON back.
Deno runs the same adapter with the real `npm:` package. Neither the library nor machin was changed.

| Library | Calls identical | Bundle | Binary | Load |
|---|---|---|---|---|
| ms 2.1.3 | 4/4 | 5 kB | 1.21 MB | 1 ms |
| slugify 1.6.6 | 2/2 | 10 kB | 1.21 MB | 1 ms |
| marked 15.0.6 | 2/2 | 74 kB | 1.30 MB | 6 ms |
| zod 3.24.1 | 3/3 | 128 kB | 1.37 MB | 7 ms |
| yaml 2.7.0 | 3/3 | 218 kB | 1.48 MB | 12 ms |
| date-fns 4.1.0 | 3/3, also in 3 other time zones | 57 kB | 1.27 MB | 3 ms |
| lodash-es 4.17.21 | 3/3 | 71 kB | 1.29 MB | 3 ms |
| nanoid 5.0.9 | **0/1** (no `crypto` in the engine) | 1 kB | 1.20 MB | |

These are a few inputs each: evidence that they run, **not** that they always agree.
nanoid also needs the bundler's `browser` condition; without it the bundle fails on `node:crypto`.

### Where it differs (the `platform` cases: 4/12 identical)
- **Silently wrong, no error:** `toLocaleDateString("fr-FR", …)` gives `01/05/2026` instead of
  `janvier`; Turkish `toLocaleUpperCase` gives `ISTANBUL` instead of `İSTANBUL`;
  `typeof setTimeout` is `undefined`, so a library that checks for it takes another path.
- **Fails loudly (`ReferenceError`):** `Intl`, `TextEncoder`, `URL`, `crypto`, `structuredClone`.
- **Same, but useless:** an `async` function returns `{}` on **both** sides, because a Promise is
  turned into JSON. Comparing outputs can't catch this. The bridge doesn't run pending jobs.

### Cost (`deno run -A bench.ts`, after `run.ts`)
| Call | Native | Deno | Ratio | Peak memory |
|---|---|---|---|---|
| `ms("2 days")` × 200 000 | 4.3 µs | 0.5 µs | ~9× slower | 3 MB |
| marked, 40-item list × 3 000 | 5.2 ms | 0.33 ms | 16× slower | 4 MB |
| zod object check × 50 000 | 19 µs | 1.9 µs | 10× slower | 4 MB |

Deno has a JIT and QuickJS doesn't. Memory stayed flat over these runs.

### Boundary checks (one-off adapter, not kept)
- A NUL byte, emoji, a lone surrogate, U+2028, large and negative-zero numbers, `NaN` and stack
  overflow gave the same results.
- Runaway memory hit the 256 MB limit, returned `InternalError`, and the next call worked.
- The bridge gives the library no file or network functions.

## If this became a feature: what it would take
1. **A separate, clearly unguaranteed zone.** machin-js can't check library code, so
   "identical or a diagnostic" can't cover it. Docs and the compatibility policy must say so.
2. **A typed boundary:** a hand-written adapter with JSDoc types, scalar and struct arguments, and
   results read field by field like other outside data (`machin/json`), never `parse`d on trust.
3. **Refuse or run async** in the bridge; return error messages (the spike keeps only the name).
4. **A real bridge:** it has one global engine and isn't safe with goroutines or a threaded server.
   Interrupting an endless loop isn't handled.
5. **Build and release:** vendor and pin quickjs-ng, run esbuild, lock npm versions, ship the
   libraries' licenses, and treat every dependency as supply-chain surface.

**Idea, not tested:** also run the Deno side in QuickJS (compiled to WebAssembly). Both sides would
then share one engine, which should remove the engine differences above, though not time-zone or
host differences.

## Ahead-of-time compilers (2026-11-26)

### Porffor alpha 25 (run, from the `porffor` npm package, in a bwrap sandbox)
JS/TS → its own IR → C → native. Same adapters, bundled with esbuild; Deno as the reference.
The harness scripts lived in a session scratch directory and are **not committed**.

- **Library cases: 29/33 identical** (QuickJS: 24/33). ms, slugify, marked, zod, yaml, date-fns and
  nanoid all matched. lodash-es crashed (`TypeError`, 0/3). French month name silently came out
  `January`. The matching `async` case is still the useless `{}` on both sides.
- Five programs needed the ada URL library, downloaded from its GitHub releases during compilation.
  It didn't compile with g++ 11.4; `CC`/`CXX` set to Zig 0.16 worked. Compile 10–55 s, binaries 2–15 MB.
- Rough speed, per call: ms 1.3 µs, marked 1.2 ms, zod 4.6 µs; peak 6–10 MB. About 3–6× Deno here.
  Not like-for-like with the QuickJS table, whose calls also parsed arguments at the bridge.
- Language probes: 15/16 identical; non-ASCII `toUpperCase` silently wrong (`Hé` for `HÉ`).
  `eval`/`new Function` passed only because their text was constant: text built at run time throws
  "Dynamic code evaluation is not supported".
- Values are `struct jsval { double val; uint64 type; }`; `+` tests both types at run time. It also
  infers some types (a parameter always given numbers became a C `double`).
- **TypeScript annotations are trusted, not checked.** With `n: number` given the string `"5"`,
  `n + 1` printed `16657` and exited 0. Two similar cases also printed garbage. `--safe` didn't help.

### Static Hermes (read only, NOT run)
Building it was blocked by the session's permission check. From `static_h` docs and source:
- `shermes` has a C output kind (`lib/BCGen/SH`); `+` is emitted as a call such as
  `_sh_ljs_add_rjs`; native output links the Hermes VM library (`hermesvm`, or `hermesvmlean`).
- Typed mode (Flow; TypeScript is converted, partially supported) is documented as unstable. It
  restricts semantics so types hold (bounds-checked arrays, exact objects) and inserts **checked
  casts that throw** where unknown values flow into typed ones. Fully unannotated functions are
  not type-checked.
- Has a C FFI (`$SHBuiltin.extern_c`; `examples/ffi`).
