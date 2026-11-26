# Changelog

Newest first.

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
