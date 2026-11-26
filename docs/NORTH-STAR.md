# machin-js — north star

> **A JS-fluent human can build, ship and maintain a real multi-shell app (web + desktop +
> terminal) in machin-js with the agent switched off.**

See [VISION.md](VISION.md) for the why. This file is the measurable target and the gap roadmap.
Status reflects what is **verified in this repo today**, nothing aspirational.
The order of work toward 1.0, with exit tests, is in [ROADMAP.md](ROADMAP.md).

## How we know we are getting there

| Signal | Measure | Today |
|---|---|---|
| Readability is enforced | every function has JSDoc + `//why:`, ≤ 20 lines — compiler errors, not lint | ✅ enforced (`JS-DOC001`, `JS-WHY001`, `JS-SIZE001`) |
| Same meaning, two runtimes | example output identical under Deno and as a native binary | ✅ todo demo + HTTP smoke on both |
| Nothing implicit | undeclared names, bad imports, name clashes, import cycles are errors | ✅ (`JS-UNDEF001`, `JS-IMPORT00x`, `JS-DUP001`, `JS-CYCLE001`) |
| Shared core, thin shells | ≥ 3 shells over one core | 🟡 web + desktop done; terminal next |
| Debuggable in JS terms | a native crash reports `file.js:line:column` | 🟡 list and division crashes do; a stack overflow doesn't name a line. Tested with a simulated user, not yet a human |
| Real-program coverage | ≥ 2 distinct apps compile and pass their gates | ✅ three (todo, tally, linkbox) |

## Tiers

**Tier 0 — the pilot (done).** A todo app as readable JS: transpiler (Deno + acorn) checked against
hand-reviewed gold, ES modules with dependency ordering, generated `machin.d.ts`, web shell (SSR +
JSON API) verified by one HTTP smoke test on both runtimes, desktop shell (raylib, via a binding)
verified with real X input on a private display.

**Tier 1 — a language you can write a second app in.**
- Typed arrays and objects: element types beyond `string`, object literals → structs.
- `for…of`, template literals, common array/string methods (`push`, `map`, `filter`, `includes`…).
- Block-bodied arrows; ternary beyond `const x = c ? a : b`; `switch`.
- A second, more demanding example app to find the next gaps.

**Tier 2 — debuggable like JavaScript.**
- Source maps: panics, `--safe` bounds failures, falsifier repros and `certify` counterexamples
  reported at `file.js:line`.
- Runtime parity checks widened: property-style differential tests against Node semantics for ints,
  strings (bytes vs UTF-16), `%` and division.

**Tier 3 — more shells.**
- Terminal (TUI) shell over the same core.
- Client UI via machin's wasm/reactive path (JSX or a similar declarative layer).
- Mobile via PWA/webview — only if a shell above proves the layering.

**Tier 4 — concurrency and distribution.**
- `async`/`await` lowered to machin's `go`/`chan` (race-freedom comes with it).
- `deno compile` the toolchain into a single binary; CI; tagged releases.

## Upstream dependencies (machin)

**Open:** none.

**Fixed in machin, not yet adopted** (machin 0.144.1; machin-js still accepts 0.144.0):
[#718](https://github.com/javimosch/machin/issues/718) (nested list literals; machin-js still refuses nested array literals) and
[#719](https://github.com/javimosch/machin/issues/719) (silent stack overflow; newer machin now reports it).

**Cleared** in machin 0.144.0, now the minimum version: [#715](https://github.com/javimosch/machin/issues/715) (`json()` could emit invalid
JSON) and [#716](https://github.com/javimosch/machin/issues/716) (nothing could tell that JSON was invalid; `json_valid` now can).

**Cleared** in machin 0.143.0:

| Issue | Was | machin-js now |
|---|---|---|
| [machin#710](https://github.com/javimosch/machin/issues/710) | named functions weren't values | passes your functions directly |
| [machin#711](https://github.com/javimosch/machin/issues/711) | one file couldn't be formatted alone | compares gold files per module with `encode --no-check` |
| [machin#712](https://github.com/javimosch/machin/issues/712) | signatures were text; machweb was missing | generates `machin.d.ts` and `machweb.d.ts` from structured data |
| [machin#713](https://github.com/javimosch/machin/issues/713) | no flags for a vendored library | links raylib statically with build flags |

## Open questions

- **Decimals:** worth our own `int`/`float` analysis? Decide when an app needs them.
