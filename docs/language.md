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

The whole `@typedef {{...}} Name` must be **on one line**.

To use the type from another file:

```js
/** @typedef {import("./model.js").Todo} Todo */
```

That line also tells the transpiler to include `model.js` in the build.

## Decoding rows

`parse(json, [])` takes its result type from where it is used, usually the function's `@returns`
(a list such as `Todo[]`, or a single `Todo`).

**`parse` is only for JSON your program controls:** the direct result of `sqlite_query(...)`, or
text built from constants plus `String()` of numbers and booleans. machin's `parse` never fails:
bad or mistyped input silently becomes empty values, while `JSON.parse` throws or keeps the wrong
types. Passing it outside input is rejected with
[`JS-JSON001`](diagnostics.md#js-json001-parse-of-outside-input).

For JSON from outside, such as a request body, use [`"machin/json"`](modules.md#machinjson-outside-json),
which reads one top-level field at a time and tells you whether it has the type you expect.

Because native `parse` keeps only the struct's fields, in its order, and fills gaps with empty
values, the build checks the shape ([`JS-SHAPE001`](diagnostics.md#js-shape001-parse-shape-doesnt-match)):

- **Database rows:** write the SQL as a constant that names its columns, in a `SELECT …` list or after
  `RETURNING`. They must be exactly the struct's fields, in the same order, and each field `int` or
  `string`. `SELECT *` isn't allowed.
- **JSON your code builds** must already have exactly the struct's fields, in order, with the right types.

Columns should be `NOT NULL`, and hold the type the field says:
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

## Conditions

machin has no "truthy" or "falsy" values. Whatever you test, with `if`, `while`, `for`, `? :`, `!`,
`&&` or `||`, must be `true` or `false`: write `n != 0`, `s != ""` or `xs.length > 0`.

An audit of edge cases, with the exact result for each, is in
[the reference](specification.md).

## Supported

- `function` declarations, `export`, `import { x } from "..."` (no default, `*` or `as`)
- `const` and `let` with an initial value
- `=`, `+=`, `-=`, `*=`, `%=`, `++`, `--` (on a list element, [the index must be simple](diagnostics.md#js-order001-element-update-with-an-index-that-isnt-simple))
- `if` / `else`, `while`, `for (init; test; update)` (all three parts), `break`, `return`
- `+ - * %`, comparisons, `&&`, `||`, `!`, unary `-` (`===` is treated as `==`)
- `+` on two numbers or two strings (convert with `String(x)`)
- integer division, written `Math.trunc(a / b)`
- whole numbers up to 2^53-1, `true`, `false`, printable-ASCII strings with `\n` and `\t`
- `const x = cond ? a : b`, where `b` is a literal or a name
- arrows with an expression body: `(s) => parse_int(s)`
- passing and storing your own functions (`serve(port, handle)`); builtins need an arrow
- arrays of numbers, strings, booleans or structs; `a[i]`, `a[i] = x`, `a.length`
- lists of lists: `[[1, 2], [3]]`, `grid[i][j]`
- reading `a.field` on a struct
- `==` and `!=` on numbers, strings and booleans
- `String(x)` and `console.log(...)` of numbers, strings and booleans
- `parse(json, [])` into a struct or a list, typed by where the result is used
- `for (const x of list)`
- `new Map()` as a key-value store (below)
- template literals: `` `${n} items` `` with numbers, strings and booleans
- object literals that match a named `@typedef`: `{ id, title: "x", done: 0 }`
- `list.push(value)`, while the function is the list's only owner (below)

### Building a list with `push`

In JavaScript, `push` changes the one list that every variable pointing to it sees. machin's
`append` may or may not keep them connected. So `push` is allowed only while nobody else can be
pointing to the list: **build it completely, then share it**.

<!-- check: ok -->
```js
/**
 * The squares below n squared.
 * @param {int} n
 * @returns {int[]}
 */
export function squares(n) {
  //why: pushed to only before anyone else can see it.
  /** @type {int[]} */
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(i * i);
  }
  return out;
}
```

The list must be created in the same function with `const name = [...]`. Reading and writing its
elements and reading `.length` don't share it. Passing it to a function, assigning it, capturing it
in an arrow or looping over it with `for…of` does, and no `push` may come after that, including on a
loop's next pass. `return name` is always fine.

### Key-value lookups with `Map`

Use JavaScript's own `Map`. Declare its types on their own line, with `string` or `int` keys, and
text, number, boolean or named-struct values:

<!-- check: ok -->
```js
/**
 * How often each word appears; the count for `wanted`.
 * @param {string[]} words
 * @param {string} wanted
 * @returns {int}
 */
export function countOf(words, wanted) {
  //why: a Map avoids searching the list again for every word.
  /** @type {Map<string, int>} */
  const counts = new Map();
  for (const w of words) {
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return counts.get(wanted) ?? 0;
}
```

You can use `m.get(key) ?? fallback`, `m.has(key)`, `m.size`, and `m.set(key, value)` or
`m.delete(key)` on their own line. A map is shared, as in JavaScript: a function you pass it to
changes the same map.

- A bare `m.get(key)` isn't allowed: a missing key is `undefined` in JavaScript but `0` or `""`
  natively. The fallback must be a constant or a variable, or a call that changes nothing, because
  it is always evaluated.
- **You can't loop over a map:** machin lists keys in a different order. If order matters, keep your
  own list of keys, as [tally](https://github.com/javimosch/machin-js/tree/main/examples/tally) does.
- Maps inside a `@typedef`, and lists or maps as values, aren't supported.

### Arrows and captured variables

An arrow may use its own parameters, and the function's parameters and variables declared directly
in its body. It may not capture a variable declared inside a block or a loop: JavaScript makes a new
one each time, and machin doesn't.

> Put a `/** @type {...} */` comment on its own line. TypeScript ignores one that follows other
> code on the same line.


### Object field order, and `json()`

An object literal lists its fields **in the order the `@typedef` declares them**
([`JS-FIELDS001`](diagnostics.md#js-fields001-object-fields-out-of-order)). Native `json()` writes the
typedef's order; JavaScript writes the literal's. `json()` and the other builtins and module
functions can't take a `Map`.

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

Plain division (`/`), decimals, `null`, non-ASCII string literals,
`typeof`, `var`, destructuring, default and rest parameters, assigning to an object field,
shadowing a name, looping over a `Map`, classes, `async`, `??`, `switch`, method calls other than `push` (such as `.map`),
object spread and computed keys, tagged templates, `continue`, block-bodied arrows, top-level `const`, and
ternaries in any other position.

A function that returns a value must return one on every path. The transpiler accepts only a final
`return`, or an `if` / `else` where both sides return.

## Known differences

These can still behave differently from plain JavaScript. Anything **not** listed here that differs
is a bug: please report it.

| Case | Under Deno | Native |
|---|---|---|
| dividing by zero: `Math.trunc(a / 0)`, `a % 0` | `Infinity` or `NaN`, and carries on | stops with `file.js:line:column: division by zero` |
| negative zero, e.g. `console.log(Math.trunc(-1 / 2))` | prints `-0` | prints `0` (`String(x)` gives `0` in both) |
| integer results beyond 2^53 | rounded | exact, and they wrap past 2^63 |
| reading or writing past the end of an array | `undefined`, or the array grows | stops, naming the place, the expression and the index |
| recursion that never ends, or very deep recursion | `RangeError` with a stack trace, typically after some thousands of calls | `panic: stack overflow`, exit 1, with earlier output kept. The limit is much higher: the stack's size, or 1,000,000 calls (`MFL_MAX_DEPTH` to change) |
| `substr` cutting a non-ASCII character in half | a replacement character | the raw bytes |
| other builtins from `"machin"` | a hand-written stand-in in `shim/`, if there is one | the real builtin |
| `parse_int` of a number beyond 2^53 | rounded | exact, limited to 64 bits |
| a column holding another type than its field (a number in a `string` field) | keeps the stored type | silently becomes `""` or `0` |
| a `NULL` column reaching `parse` | the stand-in stops with an error, on purpose | silently becomes `""` or `0` |
| numbered SQL placeholders (`?1`) | the stand-in stops with an error | work |
| a failing SQL statement | the stand-in throws | returns an error code or `""` |

Random programs are compared on both runtimes (see [how it is tested](how-it-works.md)), but they
only use the features the generator knows. The stand-ins for string, list and JSON-output builtins are compared
with the real ones on awkward inputs (`test/shim_test.ts`); the SQLite and web ones are covered by
the apps' tests. Other builtins, decimals from builtins such as
`parse_float`, and ordering of non-ASCII strings are not covered.

### Behaves the same, but may surprise you

- Strings end at the first zero byte: `url_decode("a%00b")` is `"a"`.
- `json_valid` allows at most 512 levels of nesting.

## Never, by design

Prototypes, `this`, `eval`, dynamic keys, `==` coercion, npm packages.
