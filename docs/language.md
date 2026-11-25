# The JavaScript you can write

machin-js accepts a strict subset. Anything else is rejected with a
[diagnostic](diagnostics.md); it is never silently translated into something different.

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

machin infers types when it compiles. Today the transpiler itself reads JSDoc types in two places:
`@typedef` structs, and `@returns {T[]}` for `parse` (below). Write accurate types everywhere
anyway, because they are the documentation, but don't assume every annotation is verified.

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

- `function` declarations, `export`, `import { x } from "..."`
- `const` and `let`, assignment, `+=`, `++`
- `if` / `else`, `while`, `for (init; test; update)` (all three parts), `break`, `return`
- `+ - * / %`, comparisons, `&&`, `||`, `!` (`===` is treated as `==`)
- `const x = cond ? a : b`, where `b` is a literal or a name
- arrows with an expression body: `(req) => handle(req)`
- `a[i]`, `a.length`, `a.field`
- `String(x)` and `console.log(...)`
- arrays of strings: `["a", "b"]`

## Not supported yet

Classes, `async`, template literals, `??`, `switch`, method calls such as `.push` or `.map`, object
literals, `continue` inside `for`, block-bodied arrows, top-level `const`, ternaries in any other
position, and array literals of anything but strings.

> Two limits are **not** caught for you yet. An array literal of non-strings is emitted as a string
> array, so the error shows up later, from machin. Two `for (let i …)` loops in the same function
> have not been tested.

## Never, by design

Prototypes, `this`, `eval`, dynamic keys, `==` coercion, npm packages.
