# Diagnostics

Every problem prints as `file:line: CODE message`, and the transpiler exits non-zero.

## JS-DOC001: function has no JSDoc block

<!-- check: JS-DOC001 -->
```js
function f() {
  //why: example.
}
```

Add a `/** … */` block directly above the function (above `export` if there is one).

## JS-WHY001: function has no `//why:` comment

<!-- check: JS-WHY001 -->
```js
/** Do nothing. */
function f() {
}
```

Add a line comment starting `//why:` inside the body. Say why it exists or why it is written that
way. The tool can only check that the comment is there, not that it is good.

## JS-SIZE001: function is longer than 20 lines

Split it. The count runs from the `function` line to the closing brace.

## JS-UNSUP001: unsupported syntax

<!-- check: JS-UNSUP001 -->
```js
/** Default a value. */
function f(a) {
  //why: example.
  return a ?? 1;
}
```

See [the supported subset](language.md).

## JS-FNVAL001: a function was used as a value

machin functions are not values, so wrap the call in an arrow
([machin#710](https://github.com/javimosch/machin/issues/710)).

<!-- check: JS-FNVAL001 -->
```js
import { serve } from "machin/web";
/** Handle a request. */
function handle(req) {
  //why: example.
  return req;
}
/** Start. */
function main() {
  //why: example.
  serve(8080, handle);
}
```

Fixed:

<!-- check: ok -->
```js
import { serve } from "machin/web";
/** Handle a request. */
function handle(req) {
  //why: example.
  return req;
}
/** Start. */
function main() {
  //why: the arrow is required.
  serve(8080, (req) => handle(req));
}
```

## JS-UNDEF001: name not defined or imported

<!-- check: JS-UNDEF001 -->
```js
/** Open a database. */
function f() {
  //why: example.
  return sqlite_open("x.db");
}
```

Add `import { sqlite_open } from "machin";`. There are no ambient globals apart from `String` and
`console`.

## JS-IMPORT001: the module has no such export

The name is not exported by that module. For `"machin"` the list comes from `machin guide`.

## JS-IMPORT002: unknown module

Only `"machin"`, `"machin/web"`, `"machin/desktop"` and relative paths exist.

## JS-DUP001: function defined in two modules

machin has a single namespace, so function names must be unique across your program, including
private helpers.

## JS-CYCLE001: import cycle

Move the shared code into a third module that both can import.
