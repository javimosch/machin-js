# Debugging

You debug in JavaScript. A bad list index or a division by zero names the place in your `.js` file,
and the same code runs as plain JavaScript under Deno.

The commands below use the `machin-js` command ([install it](getting-started.md#install)). In
general:

```sh
machin-js run   path/to/main.js -- your arguments    # native
machin-js debug path/to/main.js -- your arguments    # the same files as plain JavaScript
```

## 1. The build fails

Every build error is `file.js:line: CODE message`. Look the code up in
[Diagnostics](diagnostics.md). `JS-TYPE001` ends with TypeScript's own code, which you can search.

If a build fails with an error from **machin** (no `JS-` code, or a line in a `.src` or `.mfl`
file), the transpiler let through something it shouldn't have. That's a bug in machin-js: please
[report it](https://github.com/javimosch/machin-js/issues) with the snippet.

## 2. The native program stops with a message

Reading or writing outside a list, and dividing by zero, stop the program and say where:

```text
report.js:25:49: reading totals[at]: index 1 is outside the list (length 1)
money.js:55:30: division by zero
```

That is **file : line : column**, then whether it was reading or writing, and which expression. One
line often uses the same list more than once, so check the column. The file name has no folder. The
program exits with status 1 (your own program may use 1 for other things too, so read the message).

These checks are added by the transpiler. They are always there: you don't need any build option.
Your own `eprintln` messages and `exit` codes behave as you wrote them.

### Finding where a bad index came from

The line in the message is where the bad value was **used**. The mistake is usually where it was
**made**:

1. Just before that line, print the index and the length:
   `console.log("at", at, "length", totals.length);`
2. Find every place that sets the index (here: where `at` and the map it comes from are written).
3. Print there too, until you see the first wrong value.
4. Remove your temporary lines.

## 3. Reproduce it under Deno

`machin-js debug` runs your files as plain JavaScript, with stand-ins for machin's modules. Pass your
program's arguments after `--`:

```sh
cd examples/tally
machin-js debug src/main.js -- test/fixtures/good.csv
```

For a server, start it the same way and send it the request that fails:

```sh
cd examples/linkbox
LINKBOX_TOKEN=secret LINKBOX_DB=/tmp/debug.db machin-js debug src/server.js
```


Use a throwaway database, not your real one.

Deno behaves like normal JavaScript here, which is **not** like the native program:

- reading past the end of a list gives `undefined`, and writing past the end silently makes the list
  longer, possibly with gaps;
- dividing by zero gives `Infinity` or `NaN`.

It carries on until something can't use the bad value. `undefined.cents`, for example, throws a
`TypeError` with a stack trace and a column; adding `undefined` to a number just gives `NaN`. If
Deno doesn't stop at all, use the native message to find the place, then trace the value.

## 4. Step through it

This needs Chrome (or another Chromium browser) on the same machine:

```sh
machin-js debug src/main.js --inspect-brk -- test/fixtures/good.csv
```

Deno waits for a debugger before running your program. Open `chrome://inspect`, click **inspect**,
open your `.js` file in the **Sources** panel and set breakpoints. (`debugger;` statements aren't
part of the subset.) In a terminal only, use the `console.log` method above; it works in both
runtimes.

## 5. It works under Deno but not natively

First check the [known differences](language.md#known-differences). If yours isn't listed, it is a
machin-js bug. A good report is the smallest program that prints different things in the two
runtimes.

## What has no good error yet

| Symptom | Likely cause |
|---|---|
| the native program dies with **no message** (exit code 139), or seems to hang, and earlier output may be missing | recursion that never ends ([machin#719](https://github.com/javimosch/machin/issues/719)). Under Deno you get a `RangeError` with a stack trace |
| the program hangs | an endless loop; pause it in the debugger under Deno |
| the desktop app misbehaves | it has no Deno version; debug the shared logic through the web or console build |
