# Modules

Your own files are ordinary ES modules. Three more modules connect to machin.

## `"machin"`: builtins

The machin builtins (strings, files, SQLite and more). Their typings are in
[`types/machin.d.ts`](https://github.com/javimosch/machin-js/blob/main/types/machin.d.ts),
generated from `machin guide`. After upgrading machin, regenerate them from the repo root:

```sh
deno run -A tools/gen-dts.ts
```

The generator stops with an error on a type word it doesn't know, rather than typing it `any`.
Parameter names are mostly placeholders (`a0`, `a1`), because the guide's text signatures lack them.

## `"machin/web"`: HTTP server

`serve(port, handler)`, `ok_html`, `ok_json`, `ok_text`, `not_found`, `bad_request`, `redirect`.
The handler takes a request with `method`, `path` (including the query string) and `body`. This
wraps machin's `machweb` framework, which is read from `MACHIN_FRAMEWORK`
(default `~/ai/machin/framework`, so you need a machin source checkout). The typings are kept by
hand.

## `"machin/desktop"`: window and drawing

A small immediate-mode API over raylib that uses only numbers and strings:

| Function | Does |
|---|---|
| `ui_open(w, h, title)`, `ui_close()` | window lifetime |
| `ui_should_close()`, `ui_quit()` | loop control |
| `ui_begin()`, `ui_end()` | one frame |
| `ui_text(text, x, y, size, tone)`, `ui_rect(x, y, w, h, tone)` | drawing |
| `ui_button(label, x, y, w, h, tone)` | returns 1 on the frame it is clicked |
| `ui_typed()`, `ui_key_enter()`, `ui_key_backspace()` | keyboard (printable ASCII) |
| `ui_screenshot(name)` | saves a PNG in the working directory |

Tones: 0 text, 1 dim text, 2 button, 3 hovered, 4 background.

It is a spike: there are no widgets, scrolling, selection or text cursor.

## Writing a bridge

JavaScript can't express machin's C FFI. A bridge is therefore a hand-written `.src` file in
`bindings/`, a matching `.d.ts` in `types/`, and an entry in `bridges()` in
`transpile/transpile.ts`.
