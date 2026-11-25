# machin-js — vision

**Native machin apps, written in JavaScript that a human can fully read, maintain and debug —
even when the agent is off.**

## Why this exists

machin is agent-first: terse, machine-authored, shaped for an agent's write/edit cost. That is the
right call for machin. But the person who owns the code is a human, and humans sometimes need to
step in: a bug at 2 a.m., an agent that is down, a rewrite no one asked a model to do.

machin-js is the human on-ramp. It sits **on top of** machin, never inside it. You write plain
JavaScript (ES modules, JSDoc-typed); machin-js compiles it to machin; machin compiles that to a
native binary. The agent can write in this mode too, but the code it produces is held to a standard
a human can read.

## Principles

1. **Readable by construction.** Tiny functions, a JSDoc block on every function, a `//why:` line
   for intent. These are compiler errors, not style advice — so agent-written code can't drift
   into the unreadable.
2. **A strict subset, aiming at no silent divergence.** Only constructs on an allow-list are
   translated; anything else is refused with a stable error code. This is the goal, not yet a
   guarantee: the [known differences](language.md#known-differences) are listed, and any other
   difference is a bug.
3. **JS is the source; machin is the artifact.** One direction only. Edit the JS. Never decompile
   machin back.
4. **Run it as plain JS.** The same modules run under Deno against thin shims, so you can debug
   with tools you already know, and diff the result against the native build.
5. **One core, thin shells.** Logic (store, model, pure functions) is platform-independent; web,
   desktop and terminal are small shells over it.
6. **Dogfood upstream.** Every wall machin-js hits becomes an issue on machin, so the whole stack
   improves, not just this layer.

## Non-goals

- **Not full JavaScript.** No prototypes, `this`, `eval`, dynamic keys, `==` coercion, or npm. A
  subset you can trust beats a superset you can't.
- **Not Node compatibility.** The target is machin's standard surface, not the Node API.
- **Not a machin replacement or a machin change.** machin stays agent-first; this layer is optional.
- **No human-DX editor tooling of our own.** JSDoc already gives editors types for free.
- **Not mobile, for now.** Web and desktop first; a PWA or webview wrapper is a later question.

## Who it is for

A JS-fluent human who wants small, fast, single-binary native apps without learning a new
language — and who wants to keep the keys to the codebase.
