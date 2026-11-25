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

Two things the check does **not** do yet:

- `int` and `float` are both just `number` to the checker, so it won't stop you passing one as the other.
- It follows JavaScript's rules, so `1 + "x"` passes the check and then fails in machin.

The code generator doesn't use the checker's types yet. That is the next step of
[Phase 1](ROADMAP.md).

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

`parse(json, [])` takes its element type from the enclosing function's `@returns`:

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
- whole numbers up to 2^53-1, `true`, `false`, printable-ASCII strings with `\n` and `\t`
- `const x = cond ? a : b`, where `b` is a literal or a name
- arrows with an expression body: `(req) => handle(req)`
- `a[i]` on arrays, `.length`, reading `a.field`
- `String(x)` and `console.log(...)`
- arrays of strings: `["a", "b"]`

## Not supported yet

Division (`/`), decimals, `null`, non-ASCII string literals, `typeof`, `var`, destructuring,
default and rest parameters, assigning to an object field, shadowing a name, classes, `async`,
template literals, `??`, `switch`, method calls such as `.push` or `.map`, object literals,
`continue`, block-bodied arrows, top-level `const`, ternaries in any other position, and array
literals of numbers or booleans.

A function that returns a value must return one on every path. The transpiler accepts only a final
`return`, or an `if` / `else` where both sides return.

## Known differences

These can still behave differently from plain JavaScript. Anything **not** listed here that differs
is a bug: please report it.

| Case | Under Deno | Native |
|---|---|---|
| non-ASCII text arriving **at run time** (user input, files, database) | `.length` and slicing count UTF-16 units | they count bytes |
| integer results beyond 2^53 | rounded | exact, and they wrap past 2^63 |
| reading past the end of an array | `undefined` | with `--safe`, the program stops; without it, no error |
| builtins from `"machin"` | hand-written stand-ins in `shim/` | the real machin builtin |

Some areas, such as `%` by zero and comparing arrays or objects with `==`, are not covered by
tests.

## Never, by design

Prototypes, `this`, `eval`, dynamic keys, `==` coercion, npm packages.
