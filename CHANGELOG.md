# Changelog

Newest first. Nothing has been released yet.

## Unreleased

- **The `machin-js` command:** `new`, `check`, `build`, `run`, `debug`; one self-contained binary.
  No machin source checkout needed.
- Crashes from a list index or a division by zero name your `file.js:line`; debugging guide.
- Language: `for…of`, template and object literals, `push` while a list is unshared, arrays of
  numbers and structs, integer division with `Math.trunc(a / b)`, functions as values.
- Type checking of JSDoc (TypeScript's checker on plain `.js`).
- Many programs that behaved differently natively are now rejected with a `JS-` code instead
  (see the diagnostics page).
- Example apps: todo (web and desktop), tally (command line), linkbox (API).
- `machin/json`: read outside JSON field by field, with type checks.
- Requires machin 0.144.0 or newer.
