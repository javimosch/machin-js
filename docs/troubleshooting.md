# Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `typecheck: no main function defined` | `machin encode` needs the whole program; pass every module in `order.txt` ([machin#711](https://github.com/javimosch/machin/issues/711)) |
| `undefined variable "handle"` from machin | a function was passed as a value; use an arrow ([machin#710](https://github.com/javimosch/machin/issues/710)) |
| `serve` or `ok_html` undefined | the files in `native.txt` were not passed to `machin encode` |
| `no raylib at …` from `build-desktop.sh` | set `RAYLIB_DIR` to a raylib 5.0 directory with `lib/libraylib.a` ([machin#713](https://github.com/javimosch/machin/issues/713)) |
| `Could not find a matching package for 'npm:acorn…'` | run from inside the repo, so that its `deno.json` is used |
| gate says the port is in use | something is already serving there; set `PORT` to a free port |
| native errors point at machin or C lines | source maps don't exist yet |
