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

## JS-FNVAL001: a builtin was used as a value

Your own functions, and those from `"machin/web"` and `"machin/desktop"`, can be passed around as
in JavaScript. machin's **builtins** (imported from `"machin"`) cannot, so wrap one in an arrow.

<!-- check: JS-FNVAL001 -->
```js
import { parse_int } from "machin";
/**
 * Apply a converter.
 * @param {(s: string) => number} convert
 */
function use(convert) {
  //why: example.
  return convert("1");
}
/** Run. */
function run() {
  //why: example.
  return use(parse_int);
}
```

Fixed:

<!-- check: ok -->
```js
import { parse_int } from "machin";
/**
 * Apply a converter.
 * @param {(s: string) => number} convert
 */
function use(convert) {
  //why: example.
  return convert("1");
}
/** Run. */
function run() {
  //why: the arrow makes the builtin a value.
  return use((s) => parse_int(s));
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

## JS-NUM002: plain division

<!-- check: JS-NUM002 -->
```js
/**
 * Half.
 * @param {int} a
 */
function f(a) {
  //why: example.
  return a / 2;
}
```

machin divides integers, so `7 / 2` would be `3`. Say what you mean with `Math.trunc(a / 2)`,
which truncates toward zero in both. Decimals are not supported yet.

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

## JS-ADD001: mixed `+`

<!-- check: JS-ADD001 -->
```js
/**
 * Example.
 * @param {int} a
 */
function f(a) {
  //why: example.
  return "total " + a;
}
```

Write `"total " + String(a)`. machin never converts implicitly.

## JS-CMP001: comparing arrays or objects

<!-- check: JS-CMP001 -->
```js
/**
 * Example.
 * @param {int[]} a
 * @returns {boolean}
 */
function f(a) {
  //why: example.
  return a == a;
}
```

JavaScript compares them by identity; machin has no equivalent. Compare the values you care about.

## JS-VAL001: printing or converting an array or object

<!-- check: JS-VAL001 -->
```js
/**
 * Example.
 * @param {int[]} a
 */
function f(a) {
  //why: example.
  console.log(a);
}
```

The two runtimes can't print them the same way. Loop over the items.

## JS-STR002: `.length` or indexing on a string

<!-- check: JS-STR002 -->
```js
/**
 * Example.
 * @param {string} a
 */
function f(a) {
  //why: example.
  return a.length;
}
```

Use `len(s)` or `substr(s, i, i + 1)` from `"machin"`: they count bytes in both runtimes.

## JS-ARR001: unclear array element type

<!-- check: JS-ARR001 -->
```js
/**
 * Example.
 */
function f() {
  //why: example.
  const mixed = ["x", 1];
  console.log(mixed.length);
}
```

Use one element type. For an empty array, annotate it: `/** @type {int[]} */`. Nested array literals aren't supported.

## JS-ANY001: unknown type

<!-- check: JS-ANY001 -->
```js
/**
 * Example.
 * @param {any} a
 */
function f(a) {
  //why: example.
  return a + 1;
}
```

The transpiler can't prove the translation is safe without a type. Replace `any` with the real one.

## JS-LOG001: `console.log` would read format codes

<!-- check: JS-LOG001 -->
```js
/**
 * Example.
 * @param {string} a
 */
function f(a) {
  //why: example.
  console.log(a, "done");
}
```

With two or more arguments, JavaScript treats a string first argument as a format: `%%` prints as `%`, and `%s` takes the next argument. machin does not. Start with a fixed label, or join into one string.

## JS-PUSH001: `push` on a list that may be shared

<!-- check: JS-PUSH001 -->
```js
/**
 * Example.
 * @param {int[]} xs
 */
function f(xs) {
  //why: example.
  xs.push(1);
}
```

The caller wouldn't see the new item natively. Create the list in this function, push to it before sharing it, and return it. See [building a list](language.md#building-a-list-with-push).

## JS-CLOSURE001: arrow captures a block or loop variable

<!-- check: JS-CLOSURE001 -->
```js
/**
 * Example.
 */
function f() {
  //why: example.
  let g = () => 0;
  for (let i = 0; i < 3; i++) {
    g = () => i;
  }
  console.log(g());
}
```

JavaScript gives each loop pass its own `i`; machin has one, so the two would print different numbers. Write a function that takes the value and returns the arrow.

## JS-OBJ001: object literal without a named type

<!-- check: JS-OBJ001 -->
```js
/**
 * Example.
 */
function f() {
  //why: example.
  const p = { a: 1 };
  console.log(p.a);
}
```

machin structs have names. Declare a `@typedef` and say where it applies, with `@returns {T}` or `/** @type {T} */` on its own line.

## JS-NAME001: name taken by machin

<!-- check: JS-NAME001 -->
```js
/**
 * Example.
 */
function f() {
  //why: example.
  const range = 3;
  console.log(range);
}
```

Some names are machin keywords, a few (`len`, `str`, `append`, `parse`, `println`) are used by the generated code, and your functions can't take a builtin's name. All code ends up in one namespace, so your functions and types also can't reuse a name defined inside a bridge you import: `machin/web`'s source defines `route` and `dispatch`, for example. A full build reports that.

## JS-JSON001: `parse` of outside input

<!-- check: JS-JSON001 -->
```js
import { parse } from "machin";

/** @typedef {{n: int}} T */

/**
 * Decode a request body.
 * @param {string} body
 * @returns {T}
 */
function f(body) {
  //why: example.
  return parse(body, []);
}
```

machin's `parse` never fails: bad input silently becomes empty values, and JavaScript's `JSON.parse`
behaves differently. Use `parse` only on `sqlite_query(...)` results or JSON your code builds. Read
outside input as [form fields or query parameters](language.md#decoding-rows).

## JS-INTERNAL001: transpiler bug

The transpiler failed on your code. Please [report it](https://github.com/javimosch/machin-js/issues) with the snippet.
