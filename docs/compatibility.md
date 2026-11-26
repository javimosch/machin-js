# Compatibility policy

> **Approved** by the project owner on 2026-11-26. It **takes effect at 1.0**. Until then anything may
> change; changes are listed in the
> [changelog](https://github.com/javimosch/machin-js/blob/main/CHANGELOG.md).

## What is stable from 1.0

| Stable | Not stable |
|---|---|
| the meaning of a program that builds | the generated `.src` and machin code |
| what the subset accepts (it only grows) | the wording of error messages |
| diagnostic codes (`JS-…`) and what each one is about | `machin/desktop`, which stays experimental |
| the `machin-js` commands, their options and exit codes | timing, memory use and binary size |
| the functions of `machin/json`, `machin/text`, `machin/crypto` and the documented part of `machin/web` | the rest of the builtins in `"machin"`, which follow machin |

## The promise

Within one major version:

1. **A program that builds keeps building, with the same behavior.**
2. New versions may **accept more**: something refused before may start to work.
3. A diagnostic code is never reused for a different problem.

## The one exception: soundness fixes

A release may **refuse a program that built before** if:

- it behaves differently from its JavaScript, **or**
- machin doesn't guarantee that it behaves the same. This part is used only when the missing
  guarantee can be named.

Either can happen in any release. The changelog lists it under "Soundness fixes", says **which of
the two** it is, gives the code you'll now see, and shows how to rewrite the program. It is never
used to remove a feature that is guaranteed to behave correctly.

## Versions

| Release | May contain |
|---|---|
| patch (`1.0.x`) | bug fixes, soundness fixes, clearer messages |
| minor (`1.x.0`) | newly accepted JavaScript, new bridge functions, a higher minimum machin version |
| major (`x.0.0`) | anything, with migration notes |

## machin

**Limits set by machin, such as the maximum recursion depth, and speed aren't covered.** The
changelog reports changes we know of.

Each release states the oldest machin it supports. machin is developed separately and its builtins
can change; a weekly job tests machin-js against the newest machin release. If machin changes
behavior in a way that affects the promise above, a machin-js release either adapts or states the
newest machin version it supports.

## How it is enforced

- [The reference](specification.md) pins the result of every audited construct; a change fails the
  tests until the list is changed on purpose.
- Gold files and the example apps catch unintended changes in what working programs do.
- The checks can't cover every program. A break they miss is a bug: please report it.
