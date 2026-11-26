# Getting started

## What you need

| Tool | Why |
|---|---|
| [`machin`](https://github.com/javimosch/machin) 0.144.0 or newer | compiles the output to native |
| a C compiler (`cc`), and SQLite headers if you use SQLite (`libsqlite3-dev`) | machin builds through C |
| [`deno`](https://deno.com) 2.2 or newer | to build the `machin-js` command, and for `machin-js debug` |

You don't need a machin source checkout.

## Install

There is no published release yet, so build the command from the source. It becomes a single
self-contained binary of about 100 MB.

<!-- run: install -->
```sh
git clone https://github.com/javimosch/machin-js && cd machin-js
tools/build-release.sh
mkdir -p ~/.local/bin && cp dist/machin-js ~/.local/bin/
cd ..
```

Make sure `~/.local/bin` is on your `PATH`.

## Your first program

<!-- run: first -->
```sh
machin-js new hello
cd hello
machin-js run main.js
```

It prints `hello world`. `new` created:

| File | What it is |
|---|---|
| `main.js` | your program; every program exports `main()` |
| `jsconfig.json` | tells your editor the types of machin's modules |
| `.machin-js/types/` | those typings |

## Everyday commands

```sh
machin-js check main.js                 # every problem, with file and line
machin-js build main.js -o hello        # a native program
machin-js run main.js -- one two        # build and run, with arguments
machin-js debug main.js --inspect-brk   # run as plain JavaScript, with a debugger
```

## Next

- [Debugging](debugging.md)
- [Read the todo app](tutorial.md)
- [What JavaScript you can write](language.md)
