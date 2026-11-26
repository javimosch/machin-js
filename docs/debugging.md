# Debugging

You debug in JavaScript. Errors name your `.js` file and line, and the same code runs under Deno,
where you have a real debugger.

## 1. The build fails

Every build error is `file.js:line: CODE message`. Look the code up in
[Diagnostics](diagnostics.md). `JS-TYPE001` ends with TypeScript's own code, which you can search.

If a build fails with an error from **machin** (no `JS-` code, or a line in a `.src` or `.mfl`
file), the transpiler let through something it shouldn't have. That's a bug in machin-js: please
[report it](https://github.com/javimosch/machin-js/issues) with the snippet.

## 2. The native program stops with a message

Reading or writing outside a list, and dividing by zero, stop the program with the place in your
code:

```text
report.js:41: index 3 is outside the list (length 3)
money.js:55: division by zero
```

The transpiler adds these checks itself, so they work with or without `--safe`. The line is where
the access or the divisor is written.

Your own `eprintln` messages and `exit` codes behave as you wrote them.

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

[No command yet?](getting-started.md#install)

Use a throwaway database, not your real one.

Remember that under Deno, reading past the end of a list gives `undefined` and dividing by zero
gives `Infinity` or `NaN`, and the program carries on. So look for where the bad value starts.

## 4. Step through it

```sh
machin-js debug src/main.js --inspect-brk -- test/fixtures/good.csv
```

Deno waits for a debugger. Open `chrome://inspect` in Chrome, click **inspect**, then set
breakpoints in your `.js` files. (`debugger;` statements aren't part of the subset, so use
breakpoints.) `console.log` works in both runtimes.

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

## The agent-off test

The exit test for this phase is a person fixing a planted bug alone, using only this page.
