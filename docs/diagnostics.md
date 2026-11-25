# Diagnostics

Every problem prints as `file:line: CODE message`, and the transpiler exits non-zero.

## JS-TYPE001: type error

The TypeScript checker read your JSDoc and found a mismatch. The message ends with TypeScript's own
code, such as `(TS2345)`, which you can search for. Type errors are reported only after all other
diagnostics are fixed, and only by a full build (it needs your imports).

<!-- check: JS-TYPE001 -->
```js
/**
 * Name of a user.
 * @param {{name: string}} user
 */
export function nameOf(user) {
  //why: example, with a misspelled field.
  return user.nmae;
}
```

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
import { serve, ok_text } from "machin/web";
/**
 * Handle a request.
 * @param {import("machin/web").Request} req
 */
function handle(req) {
  //why: example.
  return ok_text(req.path);
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

## JS-NUM001: unsupported number

<!-- check: JS-NUM001 -->
```js
/** Example. */
function f(a) {
  //why: example.
  return 1.5;
}
```

Only whole numbers up to 2^53-1. Decimals print differently natively.

## JS-NUM002: division is not supported yet

<!-- check: JS-NUM002 -->
```js
/** Example. */
function f(a) {
  //why: example.
  return a / 2;
}
```

machin divides integers, so `7 / 2` would be `3`. It returns once the transpiler knows types.

## JS-STR001: string literal is not plain ASCII

<!-- check: JS-STR001 -->
```js
/** Example. */
function f(a) {
  //why: example.
  return "héllo";
}
```

machin counts bytes and JavaScript counts UTF-16 units. Printable ASCII, `\n` and `\t` are allowed.

## JS-SCOPE001: name is already visible

<!-- check: JS-SCOPE001 -->
```js
/** Example. */
function f(a) {
  //why: example.
  if (a == 1) {
    const a = 2;
    console.log(a);
  }
}
```

machin has one scope per function, so an inner name would overwrite the outer one. Rename it. Two loops one after the other may both use `i`.

## JS-RET001: not every path returns a value

<!-- check: JS-RET001 -->
```js
/** Example. */
function f(a) {
  //why: example.
  if (a == 1) {
    return 5;
  }
}
```

JavaScript would return `undefined`; machin would silently return `0` or `""`. End with a `return`, or return on both sides of an `if` / `else`.

## JS-INTERNAL001: transpiler bug

The transpiler failed on your code. Please [report it](https://github.com/javimosch/machin-js/issues) with the snippet.
