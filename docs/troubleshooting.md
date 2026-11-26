# Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `typecheck: no main function defined` | `machin encode` checks the whole program, so pass every module in `order.txt`. To only format one file, add `--no-check` |
| `unknown flag`, or `no structured params` from `gen-dts.ts` | your machin is older than 0.143.0; upgrade it |
| `JS-IMPORT002 cannot read …/machweb.src` | set `MACHIN_FRAMEWORK` to the `framework/` directory of a machin source checkout |
| `serve` or `ok_html` undefined | the files in `native.txt` were not passed to `machin encode` |
| `no raylib at …` from `build-desktop.sh` | set `RAYLIB_DIR` to a raylib 5.0 directory with `lib/libraylib.a` |
| `Could not find a matching package for 'npm:acorn…'` | run from inside the repo, so that its `deno.json` is used |
| gate says the port is in use | something is already serving there; set `PORT` to a free port |
| `the Deno stand-in supports only plain ? placeholders` | repeat the parameter: `WHERE ? = '' OR tag = ?` with `[tag, tag]` |
| a 500 only under Deno | read the server's output: the SQLite and `parse` stand-ins throw where native code fails silently |
| native errors point at machin or C lines | source maps don't exist yet |
