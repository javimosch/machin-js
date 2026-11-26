# Roadmap to 1.0

## What "stable" means

1. **No known silent differences.** A program behaves like the JavaScript, or is rejected with a
   `JS-` error. Limits that can't be removed are documented.
2. **Frozen subset.** Written down; breaking changes need a new major version, as the
   [compatibility policy](compatibility.md) defines.
3. **Real use.** Three different apps work, and a human has fixed at least one bug in a machin-js
   app without help from an agent, either a planted bug or a real one.
4. **Debuggable.** Errors point to `file.js:line`.
5. **Installable.** One command on a clean machine; CI tests everything claimed as supported.

## Phases

Each phase ends only when its exit test passes. Features are added only when one of the three apps
needs them.

| Phase | Work | Exit test | Status |
|---|---|---|---|
| **0. Honest** (0.2) | correct the claims; allow-list; reject known divergences; parity tests; CI | every parity case matches or gets a `JS-` error, and none crashes | done |
| **1. Typed** (0.3) | type-check JSDoc (TypeScript's checker on plain `.js`); define division, numbers, strings | wrong types fail with a JS line number; generated random programs show no differences | done |
| **2. Useful** (0.4–0.6) | typed arrays, object literals, `for…of`, template literals, `push`/`map`/`filter`, error handling; a CLI tool and an API service | all three apps pass their checks without workarounds | done (`.map`/`.filter` left out: no app needed them) |
| **3. Debuggable** (0.7) | errors at `file.js:line`; shims for every supported builtin; debugging guide | the agent-off test: a planted bug is found and fixed by a human alone | done, with a **simulated** human (owner's choice; see notes) |
| **4. Shippable** (0.8–0.9) | a `machin-js` command (`new`, `build`, `run`, `check`, `debug`) via `deno compile`; bundled bridges; tested machin versions; releases and changelog | a clean machine goes from install to a running app using only the docs | in progress: only the first release is left |
| **5. Stable** (1.0) | freeze the subset; compatibility policy; a period of real use with no new features | all five criteria hold, with no open silent-difference bugs | paused: [feature freeze lifted](#growing-support-now) on 2026-11-27; policy approved |

## Growing support (now)

**The owner lifted the feature freeze on 2026-11-27: no new release until machin-js supports more.**
The direction: machin's core as a few modules designed for JavaScript, in place of npm. Each one has
typings, a compiled side, a Deno stand-in, tests comparing the two, and an example app that uses it.

| Module | Status |
|---|---|
| `machin/crypto`: SHA-256, HMAC, random tokens, comparing secrets | on `main`; linkbox's signed webhook uses it |
| language: top-level constants, `.join()`, `.includes()`, multi-line `@typedef` | on `main`; jot uses them |
| `machin/http`: outgoing requests | **waiting on machin.** Its HTTP client has behavior we can't hide behind a module, including no timeout |
| `machin/sso`: login | after HTTP |
| `machin/ws`: WebSocket | **waiting on machin**: tests showed its WebSocket server isn't ready to wrap |

Which of these the next release needs is the owner's call.

## Feature freeze (lifted)

It ran from 2026-11-26 to 2026-11-27. Phase 5 is paused, and a new freeze comes before 1.0, with
terms agreed then. The earlier terms asked for 30 days, no known silent difference open during the
last 14, and one real app of the owner's own.

**Outside 1.0:** the desktop shell stays experimental. A terminal shell, client-side UI,
`async`/`await` and mobile come later, unless one of the apps needs them.

## Risks

- **machin dependencies:** none open. machin-js requires 0.144.3; [#718](https://github.com/javimosch/machin/issues/718) and
  [#719](https://github.com/javimosch/machin/issues/719) are adopted.
- **machin changes often:** CI pins a version, and a weekly job tests the newest release.
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
- **Workarounds removed:** tally looks categories up in a `Map` and pads with `machin/text`.
  `.map` and `.filter` wait for an app that needs them.
- **Found on the way:** arrows capturing loop variables silently differed (now rejected), and four
  Deno stand-ins disagreed with machin (fixed, and now compared by a test).
- **Third app:** [linkbox](https://github.com/javimosch/machin-js/tree/main/examples/linkbox), a
  bookmarks API.
- **JSON input arrived** with machin 0.144.0's `json_valid`: linkbox now accepts JSON request bodies,
  through `machin/json`. It reads top-level fields only.
- **Remaining limits no example needs yet:** nested JSON input, looping over a map.

## Phase 3 notes

- **Not source maps.** machin gives no location for a runtime crash and compiles each function onto
  one line, so there is nothing to map. Instead the transpiler adds its own checks to list accesses
  and divisions; each carries its `file.js:line`.
- **Not covered:** endless recursion still crashes with no message. machin's own compile errors
  aren't translated; they should only occur through a transpiler bug. The `falsify` and `certify`
  tools' reports aren't mapped.
- **Shims:** the string, list and JSON-output stand-ins are compared with machin. Most of machin's
  builtins have no stand-in at all.
- **Found on the way:** `a[f()] += 1` called `f` twice natively (now `JS-ORDER001`).
- **The agent-off test** was run on 2026-11-26 with a stand-in, because the owner couldn't take it:
  a separate, non-interactive Claude Sonnet 5.5 session with no project instructions, memory or tool
  servers. It was given the symptom, the compiled command, the docs and the app's source (no tests,
  expected output or history), and asked to act as a JavaScript developer new to the project. It
  fixed a planted off-by-one in tally; the transcript showed it stayed inside its folder, and the
  output matched the expected output.
- **What that does and doesn't show:** the guide was enough for one easy, crashing bug. It fixed it
  by reading the code; it didn't use breakpoints. It is not evidence about a human: 1.0 criterion 3
  (a human has fixed a bug with the agent off) is **still open**.
- **Its findings, since fixed:** the crash message didn't say which of three uses of a list on one
  line had failed (it now gives column, expression and read or write); the guide overstated that
  Deno "carries on", didn't cover writes past the end, had no way to trace a bad value, assumed
  Chrome and this repository's folders. The new guide has not been re-tested.

## Phase 4 notes

- **The command** is one binary of about 99 MB (mostly Deno and TypeScript). CI compiles it and runs
  it with an empty home and no checkout. Only Linux x86-64 is tested.
- **machweb** is bundled as an exact copy from the pinned machin version, checked in CI.
- **Newest machin:** a weekly job runs the tests and app gates against it.
- **First release:** [v0.8.0](https://github.com/javimosch/machin-js/releases/tag/v0.8.0), an alpha
  prerelease. CI runs the getting-started page as written, downloading the real releases, on a path
  with neither machin nor Deno. The C compiler and SQLite headers are assumed to be installed.
- **Still open:** other platforms (only Linux x86-64 is built or tested).

## Phase 5 notes

- **Pinned:** the [reference](specification.md) records the result of 190 audited constructs, and the
  tests fail if any changes.
- **What the audit found:** 18 constructs that weren't handled soundly on its first run, one of them
  a silent difference (`__proto__` as a key) that is in v0.8.0.
- **Left before 1.0:** more support, then a new freeze, and criterion 3: a human has fixed a bug
  without an agent (a bug fixed while building the real app counts). The
  [compatibility policy](compatibility.md) was approved on 2026-11-26.
- **v0.8.1** ([release](https://github.com/javimosch/machin-js/releases/tag/v0.8.1)) ships the audit's
  fixes, including the `__proto__` difference that 0.8.0 has.
- **v0.9.0** ([release](https://github.com/javimosch/machin-js/releases/tag/v0.9.0)): nested lists
  and machin 0.144.3 as the minimum version.
- **2026-11-26, during the freeze:** preparing a CLI example turned up six silent differences around
  `json()`, `parse` shapes and `Map` arguments, all present in v0.9.0. Random testing had never
  compared `json()` output. Fixed in
  [v0.9.1](https://github.com/javimosch/machin-js/releases/tag/v0.9.1); 0.8.0, 0.8.1 and 0.9.0 have them.
- **2026-11-26, later the same day:** `check` accepted any builtin or `machin/web` function, but
  only some have a Deno stand-in. The rest are now `JS-IMPORT003`. Checking the stand-ins without a
  direct comparison found four more differences (`read_file`, `eprintln`, `env`), fixed on `main`
  (not yet released).
- **jot** was added during the freeze: an example in the existing subset, not a language feature.
  It doesn't count as the owner's own app. Limits it met: no field named `type`, no keys such as
  `help-json`, one-line `@typedef` only, no top-level constants.

