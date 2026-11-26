# Reading the todo app

The example in [`examples/todo`](https://github.com/javimosch/machin-js/tree/main/examples/todo) is
one core with two shells.

| File | Role | Layer |
|---|---|---|
| `src/model.js` | the `Todo` type | core |
| `src/store.js` | SQLite: add, toggle, remove, list | core |
| `src/render.js` | HTML and text rendering | web shell (`renderLine` is also used by the demo) |
| `src/routes.js` | HTTP requests to store calls | web shell |
| `src/server.js` | starts the server | web shell |
| `src/desktop.js` | a raylib window | desktop shell |
| `src/main.js` | a console demo | test fixture |

> There are two smaller examples too:
> [tally](https://github.com/javimosch/machin-js/tree/main/examples/tally), a command-line tool, and
> [linkbox](https://github.com/javimosch/machin-js/tree/main/examples/linkbox), a bookmarks API. Each
> has its own README with a reading order.

## Run it

```sh
cd examples/todo
./build.sh && ./todo                     # http://localhost:8080   (PORT=9000 ./todo to change)
./build-desktop.sh && ./todo-desktop     # needs a display and raylib (RAYLIB_DIR)
```

Both shells use `todos.db` in the directory you run them from, so run both from the same place to
see the same todos. The desktop app also reads `TODO_DB`.

## Suggested reading order

1. **`routes.js`, `handle`.** One request comes in: a POST changes the store and redirects to `/`;
   `/` renders the page; `/api/todos` returns JSON; anything else is a 404. The database is opened
   per request, so no handle is shared between concurrent requests.
2. **`store.js`.** Each function is one SQL statement. User text always goes through a bound `?`
   parameter.
3. **`render.js`.** Titles are escaped at the one place they enter HTML. The page uses plain forms,
   with no client-side JavaScript.
4. **`desktop.js`.** An immediate-mode loop: every frame it reads typing, draws the list and applies
   clicks. It reuses `store.js` unchanged.

## Change something

Edit a `.js` file, then run `./build.sh`. To run the full check, use `test/gate.sh`. It compares the
transpiled output with the files in `gold/`, so an intentional change makes the gate fail until you
update gold: review the new `.src`, then copy it over.
