# Getting started

## What you need

Linux x86-64. (Other platforms aren't built or tested yet.)

| Tool | Why |
|---|---|
| a C compiler (`cc`), and SQLite headers if you use SQLite | machin builds through C |
| [`machin`](https://github.com/javimosch/machin) 0.146.3 or newer | compiles the output to native |
| `machin-js` | the command, one self-contained binary of about 100 MB |
| [`deno`](https://deno.com) 2.2 or newer, **optional** | only for `machin-js debug` |

You don't need a source checkout of either project. On Debian or Ubuntu the first row is
`sudo apt-get install build-essential libsqlite3-dev`.

## Install

Make sure `~/.local/bin` is on your `PATH`. Then install machin, checking the download:

<!-- run: install-machin -->
```sh
mkdir -p ~/.local/bin ~/.cache/machin-js-install && cd ~/.cache/machin-js-install
B=https://github.com/javimosch/machin/releases/download/v0.146.3
curl -fsSLO $B/machin-v0.146.3-linux-amd64
curl -fsSL -o machin.SHA256SUMS $B/SHA256SUMS.txt
sha256sum --check --ignore-missing machin.SHA256SUMS
install -m755 machin-v0.146.3-linux-amd64 ~/.local/bin/machin
cd ~
```

Then machin-js:

<!-- run: install -->
```sh
mkdir -p ~/.cache/machin-js-install && cd ~/.cache/machin-js-install
B=https://github.com/javimosch/machin-js/releases/download/v0.9.1
curl -fsSLO $B/machin-js-x86_64-unknown-linux-gnu
curl -fsSL -o machin-js.SHA256SUMS $B/SHA256SUMS.txt
sha256sum --check --ignore-missing machin-js.SHA256SUMS
install -m755 machin-js-x86_64-unknown-linux-gnu ~/.local/bin/machin-js
cd ~
```

The release is an **alpha prerelease**. These docs describe the current source, which can be ahead
of it; the [changelog](https://github.com/javimosch/machin-js/blob/main/CHANGELOG.md) lists what is
not released yet. The licences of what the binary contains are in
`THIRD_PARTY_LICENSES.txt` on the [release page](https://github.com/javimosch/machin-js/releases/tag/v0.9.1).

### Or build it from source

This needs `deno`.

<!-- run: source -->
```sh
git clone https://github.com/javimosch/machin-js && cd machin-js
tools/build-release.sh
mkdir -p ~/.local/bin && cp dist/machin-js ~/.local/bin/
cd ..
```

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
