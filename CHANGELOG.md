# Changelog

Newest first.

## Unreleased

**Needs machin 0.146.1 or newer** (was 0.144.3). machin 0.146 fixes security flaws in its HTTP client
and WebSocket server, and its changelog lists behavior changes.

### New

- **`machin/http`:** outgoing requests with `http_fetch`, `http_post_json` and `http_call`. Calls
  block. Read [its limits](docs/modules.md) before using it. linkbox uses it to send signed
  notifications.
- **`machin/crypto`:** `sha256_hex`, `hmac_sha256_hex`, `random_hex` and `digest_equal`.
- **linkbox** takes signed webhooks, and compares its token with `digest_equal`.
- **Top-level constants** holding fixed text, a whole number or a boolean, also across modules.
- **`.join(separator)`** on lists of text, and **`.includes(x)`** on text and on lists of numbers,
  text or booleans.
- A `@typedef` may span several lines.
- **jot** uses the three above.

### Soundness fixes

**It behaves differently from its JavaScript:** under Deno it fails to start, because the stand-in
has no such export. Some of these imports didn't build natively either (`http_get`, for one).

| Program | Now | Rewrite |
|---|---|---|
| imports a function from `"machin"` or `"machin/web"` that has no Deno stand-in | `JS-IMPORT003` | use only [supported functions](docs/modules.md). **A program that needs the function, and was only ever built natively, has no rewrite:** stay on 0.9.1 for it |

**These behave differently from their JavaScript:**

| Under Deno vs native | Now |
|---|---|
| `read_file` of a file with a zero byte: the whole file vs only the part before it | both give the part before it |
| `read_file` of invalid UTF-8: bytes silently replaced vs kept | the Deno stand-in stops with an error |
| `eprintln` with `%` codes in a first argument followed by others: read as format codes vs printed | both print them |
| `env("")` or a name containing `=`: an error vs `""` | both give `""` |
| `eprintln` of a list or object: ran vs didn't build, though `check` accepted it | `JS-VAL001`; print its parts |

`args()[0]` differs too (`"program"` vs the program's path). It is now listed under
[known differences](docs/language.md#known-differences).

## 0.9.1 (2026-11-26)

An **alpha** prerelease for Linux x86-64 (glibc); needs machin 0.144.3 or newer. **Upgrade from any
earlier version:** it fixes six silent differences. It may refuse a program that built before.

### Soundness fixes: **v0.9.0 and earlier have all of these**

Each behaves differently from its JavaScript and is now rejected. All involve data that reaches
`json()` or `parse`, or a `Map` given to a builtin.

| Under Deno vs native | Now | Rewrite |
|---|---|---|
| `json()` of an object whose fields weren't written in typedef order: different key order | `JS-FIELDS001` | write the fields in the typedef's order |
| `json(map)` or a list of maps: `{}` vs the entries; `len(map)`: `undefined` vs the count | `JS-MAP001` | pass the values; use `m.size` |
| `parse` of database rows whose columns differ from the struct: extra, missing or reordered keys | `JS-SHAPE001` | name exactly the struct's fields, in order, in constant SQL |
| `parse` of program-built JSON that doesn't have the struct's exact shape | `JS-SHAPE001` | build exactly that shape |

An object that is never serialized behaved the same whatever its field order; it must be reordered
too, because the build can't tell which objects reach `json()`.

### Also

- **New example, [jot](examples/jot):** an agent-first CLI following cli-output-spec and
  cli-guide-spec.
- A `@typedef` spread over several lines is now reported as such (`JS-UNSUP001`) instead of as a
  bad field name.

## 0.9.0 (2026-11-26)

An **alpha** prerelease for Linux x86-64 (glibc). **Before upgrading, upgrade machin to 0.144.3 or
newer.**

### May reject a program that built before

- A store into a list reached through another list, such as `rows[0].tags[0] = f(rows)`, is now
  `JS-ORDER001` when the value calls something that could replace the row. This is a precaution:
  machin doesn't guarantee the evaluation order. In the case tried, 0.8.1 happened to behave
  correctly. Fix: compute the value into a variable first.

### Changes

- **Nested lists:** `[[1, 2], [3]]`, `grid[i][j]` reads and stores, and grids built with `push`.
- **Needs machin 0.144.3 or newer** (was 0.144.0). Runaway or very deep recursion now stops with
  `panic: stack overflow` and keeps earlier output. machin reports that its check makes
  recursion-heavy `--safe` builds, which machin-js always uses, about 2x slower in its benchmark,
  and that recursion deeper than 1,000,000 calls stops even where it used to finish
  (`MFL_MAX_DEPTH` raises the limit).
- `+=`, `++` and `--` on a grid cell are accepted when the row and column are simple and the value
  calls nothing; `push([])` and `push([…])` take the list's row type.

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
