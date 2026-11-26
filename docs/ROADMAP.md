# Roadmap to 1.0

## What "stable" means

1. **No known silent differences.** A program behaves like the JavaScript, or is rejected with a
   `JS-` error. Limits that can't be removed are documented.
2. **Frozen subset.** Written down; breaking changes need a new major version.
3. **Real use.** Three different apps work, and a human has fixed a bug in one with the agent off.
4. **Debuggable.** Errors point to `file.js:line`.
5. **Installable.** One command on a clean machine; CI tests everything claimed as supported.

## Phases

Each phase ends only when its exit test passes. Features are added only when one of the three apps
needs them.

| Phase | Work | Exit test | Status |
|---|---|---|---|
| **0. Honest** (0.2) | correct the claims; allow-list; reject known divergences; parity tests; CI | every parity case matches or gets a `JS-` error, and none crashes | done |
| **1. Typed** (0.3) | type-check JSDoc (TypeScript's checker on plain `.js`); define division, numbers, strings | wrong types fail with a JS line number; generated random programs show no differences | done |
| **2. Useful** (0.4–0.6) | typed arrays, object literals, `for…of`, template literals, `push`/`map`/`filter`, error handling; a CLI tool and an API service | all three apps pass their checks without workarounds | **open:** all three apps pass, but not without workarounds (see notes) |
| **3. Debuggable** (0.7) | source maps for compile errors and crashes; shims for every supported builtin; debugging guide | the agent-off test: a planted bug is found and fixed by a human alone | |
| **4. Shippable** (0.8–0.9) | a `machin-js` command (`new`, `build`, `run`, `check`) via `deno compile`; bundled bridges; tested machin versions; releases and changelog | a clean machine goes from install to a running app using only the docs | |
| **5. Stable** (1.0) | freeze the subset; compatibility policy; a period of real use with no new features | all five criteria hold, with no open silent-difference bugs | |

**Outside 1.0:** the desktop shell stays experimental. A terminal shell, client-side UI,
`async`/`await` and mobile come later, unless one of the apps needs them.

## Risks

- **machin dependencies:** none open. #710–#713 were cleared in machin 0.143.0. Bundling bridges
  (Phase 4) still needs a way to ship `machweb.src` without a machin checkout.
- **machin changes often:** CI pins a version; testing the latest one too is still to do.
- **Numbers never match completely:** document the limits, and reject or check what we can.

## Phase 1 notes

- **Numbers are integers.** The checker can't tell `int` from `float`, so decimals stay rejected.
  Supporting them needs our own small `int`/`float` analysis.
- **Strings are bytes,** through `len`, `substr` and `index`.
- **What the exit test covers:** random programs use integers, booleans, ASCII strings, arrays,
  one struct, functions as values, branches and loops. They found a real difference the
  hand-written cases missed (`console.log` format codes). "No differences" means none in the
  space they explore.

## Phase 2 notes

- **Done:** `for…of`, template and object literals, `push` under an ownership rule, and the second
  app, [tally](https://github.com/javimosch/machin-js/tree/main/examples/tally).
- **Error handling** is a result struct with an `ok` field; machin has no exceptions.
- **What tally had to work around:** no `padEnd` (a loop), no maps (a linear search), and column
  padding counts bytes, so non-ASCII names misalign. `map` and `filter` wait for an app that needs them.
- **Found on the way:** arrows capturing loop variables silently differed (now rejected), and four
  Deno stand-ins disagreed with machin (fixed, and now compared by a test).
- **Third app:** [linkbox](https://github.com/javimosch/machin-js/tree/main/examples/linkbox), a
  bookmarks API. Its main workaround: it **can't read JSON request bodies**, because machin's `parse`
  never reports bad input, so it takes form fields.
- **Why the phase stays open:** that limit, and tally's (no `padEnd`, no maps), mean "without
  workarounds" isn't met. The JSON one needs a way to validate JSON in machin. Phase 3 doesn't
  depend on it, so it goes ahead.
