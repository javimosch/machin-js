# jot — machin-js example

A task list that an AI agent or a script can drive: an **agent-first CLI**, written as readable JS
and compiled to one native binary. It follows two of the
[agent-first CLI specs](https://cli-specs.intrane.fr/):
[cli-output-spec](https://github.com/javimosch/cli-output-spec) and
[cli-guide-spec](https://github.com/javimosch/cli-guide-spec). The other specs (feedback, update,
telemetry, daemon and the rest) aren't implemented.

    ./build.sh
    ./jot guide --human          # learn it
    ./jot add "write the report" --tag work
    ./jot list

## What following the specs looks like

| Rule | In jot |
|---|---|
| data on stdout, context on stderr | success: one JSON line on stdout, nothing on stderr |
| typed errors, semantic exit codes | `{"ok":false,"error":{code,type,message,recoverable,suggestions}}` on stderr; the exit code equals `code` |
| `help-json` | every command, its flags, every exit code, and `JOT_DB` |
| non-interactive | no prompts at all; `--yes` and `--no-interactive` are accepted |
| text output | `--text`: tab-separated `id state tag title` |
| `guide` | compiled in; JSON by default, markdown with `--human` |

Exit codes: `0` ok · `80` bad arguments · `82` missing argument · `85` bad value · `92` no such task ·
`94` database unavailable · `95` already done · `110` internal error. A crash that machin-js's own
checks catch (a bad list index) would exit `1`, outside the spec's ranges; the code is written not to
have one.

## Read it

`src/main.js` (dispatch) → `src/commands.js` (what each command does) → `src/store.js` and
`src/byid.js` (SQL) → `src/output.js` (what gets printed) → `src/errors.js` (typed errors).
Understanding the command line: `src/args.js` and `src/check.js`. About jot itself: `src/meta.js`,
`src/catalog.js` (`help-json`), `src/guide.js`, `src/lessons.js`, `src/human.js`.

## Where the subset got in the way

- **A field can't be called `type`** (machin reserves it), and the spec's error object needs one, so
  `errors.js` assembles that JSON by hand, with `json()` doing the escaping.
- **Keys such as `help-json` or `80`** can't be struct fields, so `catalog.js` builds those objects
  by hand too.
- **A `@typedef` must be on one line**, which makes the guide's type in `guidetypes.js` long.
- **No top-level constants, `.includes()` or `.join()`**: each is a small function.

## Verify it

    test/gate.sh

It checks that the same commands give identical stdout, stderr and exit codes under Deno and
natively, then runs `test/conform.ts` against the native binary: both specs' own JSON schemas
(`test/spec/`), stream separation, exit codes, that `help-json` matches what the program accepts, and
that every example in the guide really runs. A path that can't be opened is not in the comparison:
the Deno stand-in for SQLite throws where the native program returns an error code.
