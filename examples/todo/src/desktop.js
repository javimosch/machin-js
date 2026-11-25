import { env, substr, sqlite_close } from "machin";
import { ui_open, ui_should_close, ui_quit, ui_begin, ui_end, ui_close, ui_text, ui_button, ui_typed,
  ui_key_enter, ui_key_backspace, ui_screenshot } from "machin/desktop";
import { openStore, addTodo, toggleTodo, removeTodo, listTodos } from "./store.js";

/** @typedef {import("./model.js").Todo} Todo */

/**
 * The database file: $TODO_DB, or todos.db — the same default file as the web app.
 * @returns {string}
 */
function dbPath() {
  //why: sharing the default file means the desktop and web apps show the same todos.
  const p = env("TODO_DB");
  if (p == "") {
    return "todos.db";
  }
  return p;
}

/**
 * Apply this frame's typing to the draft: appended characters, then backspace.
 * @param {string} draft
 * @returns {string} the new draft.
 */
function readDraft(draft) {
  //why: typed text is appended before backspace so one frame of "a" + backspace nets zero.
  let d = draft + ui_typed();
  if (ui_key_backspace() == 1 && d.length > 0) {
    d = substr(d, 0, d.length - 1);
  }
  return d;
}

/**
 * Draw the title and the "new todo" line.
 * @param {string} draft
 * @returns {void}
 */
function drawHeader(draft) {
  //why: a trailing "_" is the cursor — there is no real text widget in immediate mode.
  ui_text("todos", 20, 16, 30, 0);
  if (draft == "") {
    ui_text("type a todo, press Enter", 20, 64, 20, 1);
  } else {
    ui_text(draft + "_", 20, 64, 20, 0);
  }
}

/**
 * The button label for one todo, e.g. "[x] buy milk".
 * @param {Todo} t
 * @returns {string}
 */
function labelOf(t) {
  //why: ASCII checkbox, since the default raylib font has no tick glyph.
  const mark = t.done == 1 ? "[x] " : "[ ] ";
  return mark + t.title;
}

/**
 * Draw every todo as two buttons (toggle, delete) and apply any click to the store.
 * @param {int} db
 * @param {Todo[]} todos
 * @returns {void}
 */
function drawList(db, todos) {
  //why: the caller reloads the list every frame, so a click shows up on the next frame and
  //     this function needs no bookkeeping about what changed.
  for (let i = 0; i < todos.length; i++) {
    const y = 110 + i * 34;
    if (ui_button(labelOf(todos[i]), 20, y, 380, 30, 2) == 1) {
      toggleTodo(db, todos[i].id);
    }
    if (ui_button("x", 410, y, 40, 30, 2) == 1) {
      removeTodo(db, todos[i].id);
    }
  }
}

/**
 * Add the typed draft as a todo when Enter is pressed.
 * @param {int} db
 * @param {string} draft
 * @returns {string} the draft to keep: "" after a successful add.
 */
function submitDraft(db, draft) {
  //why: blank drafts are ignored, so a stray Enter never creates an empty todo.
  if (ui_key_enter() == 1 && draft != "") {
    addTodo(db, draft);
    return "";
  }
  return draft;
}

/**
 * Demo mode ($SEED=1): fill an empty database so a screenshot has something to show.
 * @param {int} db
 * @returns {void}
 */
function seedDemo(db) {
  //why: only for verification — real runs never set SEED.
  addTodo(db, "buy milk");
  addTodo(db, "write the docs");
  addTodo(db, "call mum");
  toggleTodo(db, 1);
}

/**
 * Run the desktop todo window. $SHOT=name.png saves a screenshot at frame 5 and quits.
 * @returns {void}
 */
export function main() {
  //why: $SHOT exists because we can't inject keystrokes here; a screenshot is the check.
  const db = openStore(dbPath());
  if (env("SEED") == "1") { seedDemo(db); }
  ui_open(480, 420, "todos");
  let draft = "";
  let frames = 0;
  while (ui_should_close() == 0) {
    ui_begin();
    draft = submitDraft(db, readDraft(draft));
    drawHeader(draft);
    drawList(db, listTodos(db));
    ui_end();
    frames = frames + 1;
    if (env("SHOT") != "" && frames == 5) { ui_screenshot(env("SHOT")); ui_quit(); }
  }
  ui_close();
  sqlite_close(db);
}
