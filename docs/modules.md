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
Most builtin parameters have placeholder names (`a0`, `a1`), because machin doesn't name them.

## `"machin/web"`: HTTP server

machin's `machweb` framework: `serve(port, handler)`, `ok_html`, `ok_json`, `ok_text`,
`not_found`, `bad_request`, `redirect`, `response`, `header`, `query` and more. The handler takes a request (`method`, `path`
including the query string, `body`) and returns a response. The typings in `types/machweb.d.ts`
are generated from `machin guide --framework machweb`, by the same command as above. The Deno
stand-in covers only what the example apps use.

A copy of the framework's source ships with machin-js, so you don't need a machin checkout.
Set `MACHIN_FRAMEWORK` to a framework directory to use another one.

## `"machin/json"`: outside JSON

Read a request body or other outside JSON **one top-level field at a time**. Invalid JSON, a missing
field and a wrong type all make `json_is_…` false, so you can answer with a clear error.

<!-- check: ok -->
```js
import { json_valid } from "machin";
import { json_is_string, json_string } from "machin/json";

/**
 * The name in a request body, or what is wrong with it.
 * @param {string} body
 * @returns {string}
 */
export function nameFrom(body) {
  //why: say which of the two problems it is.
  if (!json_valid(body)) {
    return "invalid JSON";
  }
  if (!json_is_string(body, "name")) {
    return "name must be a string";
  }
  return json_string(body, "name");
}
```

| Function | Gives |
|---|---|
| `json_has(body, name)` | the field is there, with any type |
| `json_is_string`, `json_string` | text (`""` if it isn't) |
| `json_is_int`, `json_int` | a whole number of at most 15 digits; decimals and exponents don't count (`0` if it isn't) |
| `json_is_bool`, `json_bool` | `true` or `false` |

Limits: top-level fields of an object only (no nested objects or arrays yet), and names can't contain
`.` or `[`. If a key appears twice, the **first** one counts, which is not what `JSON.parse` does. A
key written with escapes (`"\u0061"`) doesn't match `a`. A string holding half a surrogate pair
doesn't count as a string. The Deno stand-in behaves the same way, and the two are compared on
thousands of random documents.

## `"machin/text"`: padding

| Function | Gives |
|---|---|
| `text_length(s)` | the number of characters (Unicode code points), where `len(s)` counts bytes |
| `pad_end(s, width)`, `pad_start(s, width)` | `s` padded with spaces to `width` characters |

It counts characters the same way in both runtimes, so accented text lines up. It doesn't know
display widths: East Asian wide characters and emoji take more room in a terminal than one column.

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
