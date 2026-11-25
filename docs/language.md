# The JavaScript you can write

machin-js accepts a strict subset. Anything outside it is meant to be rejected with a
[diagnostic](diagnostics.md). It is alpha: see the [known differences](#known-differences)
between what your code does under Deno and as a native binary.

## Functions and types

Every function needs a JSDoc block and a `//why:` comment, and is at most 20 lines.

<!-- check: ok -->
```js
/**
 * Add two numbers.
 * @param {int} a
 * @param {int} b
 * @returns {int}
 */
export function add(a, b) {
  //why: a deliberately tiny example.
  return a + b;
}
```

The build type-checks your JSDoc with the TypeScript checker, on your plain `.js` files: there are
no `.ts` files and no TypeScript syntax. A wrong type stops the build with
[`JS-TYPE001`](diagnostics.md#js-type001-type-error). Every parameter needs a type. A missing
`@returns` is inferred from the code.

One thing the check does **not** do: `int` and `float` are both just `number` to it, so it won't
stop you passing one as the other.

The transpiler also uses these types to decide what is safe to translate. Where a type is unknown
(`any`), it refuses with [`JS-ANY001`](diagnostics.md#js-any001-unknown-type).

## Structs

<!-- check: ok -->
```js
/** @typedef {{id: int, title: string, done: int}} Todo */
```

To use the type from another file:

```js
/** @typedef {import("./model.js").Todo} Todo */
```

That line also tells the transpiler to include `model.js` in the build.

## Decoding rows

`parse(json, [])` takes its result type from where it is used, usually the function's `@returns`
(a list such as `Todo[]`, or a single `Todo`):

<!-- check: ok -->
```js
import { sqlite_query, parse } from "machin";

/** @typedef {{id: int, title: string, done: int}} Todo */

/**
 * All todos.
 * @param {int} db
 * @returns {Todo[]}
 */
export function listTodos(db) {
  //why: parse decodes JSON rows straight into Todo[] by column name.
  return parse(sqlite_query(db, "SELECT id, title, done FROM todos"), []);
}
```

## Supported

- `function` declarations, `export`, `import { x } from "..."` (no default, `*` or `as`)
- `const` and `let` with an initial value
- `=`, `+=`, `-=`, `*=`, `%=`, `++`, `--`
- `if` / `else`, `while`, `for (init; test; update)` (all three parts), `break`, `return`
- `+ - * %`, comparisons, `&&`, `||`, `!`, unary `-` (`===` is treated as `==`)
- `+` on two numbers or two strings (convert with `String(x)`)
- integer division, written `Math.trunc(a / b)`
- whole numbers up to 2^53-1, `true`, `false`, printable-ASCII strings with `\n` and `\t`
- `const x = cond ? a : b`, where `b` is a literal or a name
- arrows with an expression body: `(s) => parse_int(s)`
- passing and storing your own functions (`serve(port, handle)`); builtins need an arrow
- arrays of numbers, strings, booleans or structs; `a[i]`, `a[i] = x`, `a.length`
- reading `a.field` on a struct
- `==` and `!=` on numbers, strings and booleans
- `String(x)` and `console.log(...)` of numbers, strings and booleans
- `parse(json, [])` into a struct or a list, typed by where the result is used

### Strings are counted in bytes

machin strings are bytes, while JavaScript's `.length` counts UTF-16 units. So `.length` and `s[i]`
are rejected on strings. Use `len`, `substr` and `index` from `"machin"`: they count bytes under
Deno too.

<!-- check: ok -->
```js
import { len, substr } from "machin";

/**
 * The text without its last byte.
 * @param {string} s
 * @returns {string}
 */
export function chop(s) {
  //why: len and substr count bytes in both runtimes.
  return substr(s, 0, len(s) - 1);
}
```

## Not supported yet

Plain division (`/`), decimals, nested array literals, `null`, non-ASCII string literals,
`typeof`, `var`, destructuring, default and rest parameters, assigning to an object field,
shadowing a name, classes, `async`, template literals, `??`, `switch`, method calls such as
`.push` or `.map`, object literals, `continue`, block-bodied arrows, top-level `const`, and
ternaries in any other position.

A function that returns a value must return one on every path. The transpiler accepts only a final
`return`, or an `if` / `else` where both sides return.

## Known differences

These can still behave differently from plain JavaScript. Anything **not** listed here that differs
is a bug: please report it.

| Case | Under Deno | Native |
|---|---|---|
| dividing by zero: `Math.trunc(a / 0)`, `a % 0` | `Infinity` or `NaN`, and carries on | the program stops (checked by hand for `Math.trunc` with `--safe`) |
| negative zero, e.g. `console.log(Math.trunc(-1 / 2))` | prints `-0` | prints `0` (`String(x)` gives `0` in both) |
| integer results beyond 2^53 | rounded | exact, and they wrap past 2^63 |
| reading past the end of an array | `undefined` | with `--safe`, the program stops; without it, no error |
| `substr` cutting a non-ASCII character in half | a replacement character | the raw bytes |
| other builtins from `"machin"` | hand-written stand-ins in `shim/`, covering only what the examples use | the real builtin |

Random programs are compared on both runtimes (see [how it is tested](how-it-works.md)), but they
only use the features the generator knows. Other builtins, decimals from builtins such as
`parse_float`, and ordering of non-ASCII strings are not covered.

## Never, by design

Prototypes, `this`, `eval`, dynamic keys, `==` coercion, npm packages.
