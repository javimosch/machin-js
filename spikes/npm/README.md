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
