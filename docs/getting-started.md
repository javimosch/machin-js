# Getting started

## What you need

| Tool | Why |
|---|---|
| [`deno`](https://deno.com) 2.x | runs the transpiler, and runs your app as plain JS |
| [`machin`](https://github.com/javimosch/machin) | compiles the output to native (0.143.0 or newer) |
| a C compiler (`cc`) | machin builds through C |

```sh
git clone https://github.com/javimosch/machin-js && cd machin-js
deno test -A test/diag_test.ts
```

## Your first program

Create `hello/main.js` inside the clone:

<!-- check: ok -->
```js
/**
 * Greet someone.
 * @param {string} name
 * @returns {string}
 */
function greet(name) {
  //why: kept apart from main so it can be reused and read on its own.
  return "hello " + name;
}

/**
 * Print a greeting.
 * @returns {void}
 */
export function main() {
  //why: machin programs start at main().
  console.log(greet("world"));
}
```

Transpile it, then run the result with machin:

```sh
deno run -A transpile/transpile.ts hello/out hello/main.js
machin encode $(for f in $(cat hello/out/order.txt); do echo hello/out/$f.src; done) > hello/app.mfl
machin run hello/app.mfl --safe
```

`order.txt` lists your modules in dependency order. If your program imports `machin/web` or
`machin/desktop`, the transpiler also writes `native.txt`: pass those files to `machin encode` first.
The [todo build script](https://github.com/javimosch/machin-js/blob/main/examples/todo/build.sh) shows it.

## Next

- [Debugging](debugging.md)
- [Read the todo app](tutorial.md)
- [What JavaScript you can write](language.md)
