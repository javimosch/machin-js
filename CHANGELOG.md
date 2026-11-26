# Changelog

Newest first.

## 0.8.1 (2026-11-26)

An **alpha** prerelease for Linux x86-64 (glibc); needs machin 0.144.0 or newer. **Upgrade from
0.8.0:** it fixes a silent difference. Programs that tested numbers or strings directly in
conditions already failed to build on 0.8.0, with a machin error; they now get `JS-COND001`.
Tested with machin 0.144.0 (pinned), and with 0.144.2 on one Linux machine before release.

### Soundness fixes

- **An object key named `__proto__` behaved differently** (JavaScript sets the prototype; native code
  made a field). Now `JS-NAME001`. **v0.8.0 has this difference.**

### Fixed

An audit of 185 constructs found others that crashed the transpiler or surfaced as confusing machin
errors; each now has a `JS-` code: syntax errors (`JS-SYNTAX001`), unreadable imports, `1n`
literals, non-boolean conditions (`JS-COND001`), names machin can't spell (`$a`, `é`, `_`), fields
named like machin keywords, optional parameters, and `String()` without exactly one value. A function
defined inside another is no longer reported as the outer one missing a `return`.

### Added

- [Reference of audited constructs](docs/specification.md) and a draft
  [compatibility policy](docs/compatibility.md).

## 0.8.0 (2026-11-26)

First release: an **alpha** prerelease. The binary is built and tested for Linux x86-64 (glibc) only.
It needs machin 0.144.0 or newer and a C compiler; `machin-js debug` also needs Deno.

- **The `machin-js` command:** `new`, `check`, `build`, `run`, `debug`; one self-contained binary.
  No machin source checkout needed.
- Crashes from a list index or a division by zero name your `file.js:line:column`, the expression,
  and whether it was reading or writing; debugging guide.
- Language: `for…of`, template and object literals, `push` while a list is unshared, arrays of
  numbers and structs, integer division with `Math.trunc(a / b)`, functions as values.
- Type checking of JSDoc (TypeScript's checker on plain `.js`).
- Many programs that behaved differently natively are now rejected with a `JS-` code instead
  (see the diagnostics page).
- Example apps: todo (web and desktop), tally (command line), linkbox (API).
- `Map` for key-value lookups (`m.get(k) ?? fallback`), and `machin/text` padding.
- `machin/json`: read outside JSON field by field, with type checks.
- Requires machin 0.144.0 or newer.
