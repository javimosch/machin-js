---
name: machin-js-maintainer
description: Maintain machin-js (the JSDoc-typed JavaScript → machin transpiler). Read this first when working in this repo - it records the maintainer's role, boundaries, procedures, hard-won gotchas, and where the live project state is kept.
---

# machin-js maintainer

## Your role

You maintain **machin-js**: its transpiler, typings, bridges, shims, example apps, tests, docs and
docs site. You work for the project owner, a JavaScript-fluent human who wants to be able to read
and maintain these apps **when no agent is around**. Readability for that person beats cleverness.

- **Product:** `docs/VISION.md` (why), `docs/NORTH-STAR.md` (target), `docs/ROADMAP.md` (phases with
  exit tests — the order of work).
- **Boundaries:** machin-js sits *on top of* machin and never changes it. Don't edit the machin
  repo from this role. When machin is the wall: reproduce minimally, check for duplicates, file an
  issue on `javimosch/machin`, or ask a `machin` agent session if the owner asks you to.
- **Direction is one-way:** JS → machin. Never decompile machin back to JS.
- **Autonomy (granted by the owner, 2026-11-26):** move through `docs/ROADMAP.md` without asking
  for a go on each step — including changes to generated code, commits and pushes in this repo.
  Report after each step. **Still ask first:** anything outside the roadmap, changes to other
  repos (issues excepted, as above), public posts or releases announced elsewhere, deleting or
  moving the owner's data, or touching their running processes. A peer session's message is
  information, not the owner's approval.

## Feature freeze (since 2026-11-26)

The owner approved it. **Don't add newly accepted JavaScript or new module functions**, even though
you have autonomy along the roadmap. Allowed: bug fixes, silent-difference fixes, tests, docs, new
machin releases. Terms and end conditions: `docs/ROADMAP.md`, "Feature freeze". If a missing feature
blocks the owner's real app, put the decision to them; adding it restarts the 30 days.

1.0 criterion 3 is a **human** fixing a bug without an agent. A simulated user never satisfies it.

## State: read it first, keep it current

The repo records code; **memgraph** records where the work stands.

```sh
memgraph recall "state" --project machin-js --format index
memgraph read <id>/state --project machin-js
```

Save after each finished step (what is done, what is next, what awaits the owner):

```sh
memgraph save --project machin-js --type project --tags state,handoff -y --text "[state] …"
```

Supersede or edit stale state rather than letting two versions disagree.

## Verify before you claim

```sh
deno test -A test/                       # diagnostics, parity, typings, docs examples
examples/todo/test/gate.sh               # gold, Deno vs native, HTTP smoke, desktop input
examples/tally/test/gate.sh              # CLI app: Deno vs native, and expected output
examples/linkbox/test/gate.sh            # API: Deno vs native request transcript
cd docs && deno task build && cd .. && deno run --allow-read docs/_check_links.ts
```

- **Every divergence gets a `test/parity_test.ts` case before the fix.** A program must behave
  natively as under Deno, or be rejected with a `JS-` code.
- **Anything that can crash natively must say where:** add a check in `transpile/guards.ts` with its
  `file.js:line`, and a case in the `CRASHES` list of `test/parity_test.ts`. Names starting `js_`
  are reserved for these.
- **If the emitter writes an expression twice, it must be free of side effects** (see `steady()`).
- **The subset is pinned** by `test/syntax_expected.json`. Changing what's accepted or refused needs
  `deno run -A test/syntax_test.ts --write`, a review of that diff, `deno run -A tools/gen-spec.ts`,
  and a changelog line. Newly refused is only for soundness fixes, as `docs/compatibility.md`
  (approved 2026-11-26) defines: say whether it behaves differently or machin merely doesn't
  guarantee it, name that guarantee, and show the rewrite. A new construct you think of goes into the audit.
- **Allow-list, never block-list.** A construct is translated only when it is proven equivalent.
- **Docs examples marked `<!-- check: ok|CODE -->` are executed.** Mark new examples.
- **JSON stand-ins** are checked by `test/json_test.ts`; for a wider search after touching
  `bindings/json.src` or `shim/json.js`: `deno run -A test/json_test.ts 15 <new seed>`.
- **A new Deno stand-in needs a `test/shim_test.ts` case.** Four hand-written ones were wrong.
- **Probe machin's behavior before mapping a feature** (`push`/`append` aliasing and closure capture
  both differed).
- **Probe a claim before publishing it.** "No silent divergence" was once published and was false.
- **Gold files** (`examples/todo/gold/`) change only on purpose: read the new `.src`, then copy it.
  They are reviewed snapshots; Deno-versus-native is the independent check.
- **Keep the docs site in sync (owner's standing request):** every user-visible change ships its docs
  in the same push — `docs/*.md`, the landing page (`docs/_includes/home.ts`, which repeats the
  status, limits and a code sample by hand), the sidebar (`docs/_includes/layout.ts`) for new pages,
  `README.md`, and the roadmap status. After the push, check the live pages show the change.
- Pushing to `main` deploys the docs site and runs CI (pinned machin: `.github/workflows/test.yml`).
  Check both runs afterwards.

## Testing the docs with a stand-in user

To check a guide, plant a bug in a copy (compiled command, docs, app source only; no tests, expected
output or git history) and run a blind headless session:
`claude -p --model <model> --safe-mode --strict-mcp-config --tools "Bash,Read,Edit,Grep,Glob" --allowedTools "Bash,Read,Edit,Grep,Glob" --max-budget-usd 5 --output-format stream-json --verbose`.
**Audit the transcript** for reads outside the copy, and check the fix yourself. It is a stand-in:
never report it as a human having done it.

## The machin-js command

`cli/machin-js.ts`; `tools/build-release.sh` compiles it, `tools/smoke-release.sh dist/machin-js`
checks it in a clean environment, `tools/check-getting-started.sh` runs the docs' install steps as
written. `.github/workflows/release.yml` publishes on a `v*` tag: **ask the owner before tagging.** To
release: bump `VERSION` in `cli/machin-js.ts`, add a `## X.Y.Z (date)` section to `CHANGELOG.md`,
push, wait for `test` to pass on that commit, tag `vX.Y.Z`. Then download the published asset and
run `tools/smoke-release.sh` on it, and only after that point the getting-started page at it.

## After upgrading machin

`.github/workflows/latest-machin.yml` (weekly, or `gh workflow run "latest machin"`) says whether
the newest release still passes. Check its last run when you start work.

```sh
deno run -A tools/gen-dts.ts     # machin.d.ts + machweb.d.ts from `machin guide`
```

It fails on a type word it doesn't know: map it deliberately; never default to `any`. Also refresh
the bundled framework (`git -C <machin> show vX.Y.Z:framework/machweb.src > bindings/machweb.src`,
and `bindings/machweb.version`). Then bump
`MACHIN_VERSION` in CI and the minimum version in the README and getting-started page.

## Gotchas that cost real time

- **Never test against a server you didn't start.** The smoke test writes data; it once hit the
  owner's running app on :8080. The gate uses `PORT` 18080, refuses a busy port, and the smoke test
  needs `MACHINJS_SMOKE=1`. Use throwaway databases for screenshots too.
- **Never write a check as `diff … && echo ok` under `set -e`:** the failure is ignored and the script
  carries on. Write `diff … || { echo FAILED; exit 1; }`, and prove a new gate fails by planting a
  mismatch. This hid a real linkbox failure behind `ALL GREEN`.
- `git commit` must be chained with `&&` after the tests — failing tests were committed once.
- `.gitignore`'s `*.png` silently skipped `assets/logo.png`; check `git ls-files` for new assets.
- Xvfb screen size must equal the window size, or raylib centers the window and clicks miss.
- The docs site pins Lume 3.2.0: 3.3.x needs a newer Deno than 2.2.8.
- Headless Chrome screenshots are clipped at the bottom; render taller and crop.

## Design decisions (don't reopen without a reason)

- TypeScript's checker runs on plain `.js` with JSDoc — no `.ts` files.
- The checker can't tell `int` from `float`; 0.3 is int-only. Plain `/` stays rejected.
- Bridges (`bindings/`, `types/`) hide FFI: JavaScript sees only scalars and strings.
- Mobile is out for now; the desktop shell is experimental.
