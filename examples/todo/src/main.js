import { sqlite_close } from "machin";
import { openStore, addTodo, toggleTodo, removeTodo, listTodos } from "./store.js";
import { renderLine, renderPage } from "./render.js";

/** @typedef {import("./model.js").Todo} Todo */

/**
 * Print every todo, one per line.
 * @param {Todo[]} todos
 * @returns {void}
 */
function printAll(todos) {
  //why: split out so main() reads as the story: add, toggle, remove, show.
  for (let i = 0; i < todos.length; i++) {
    console.log(renderLine(todos[i]));
  }
}

/**
 * Demo: exercise the store end to end against an in-memory database.
 * @returns {void}
 */
export function main() {
  //why: in-memory so the demo leaves no file behind and runs anywhere.
  const db = openStore(":memory:");
  addTodo(db, "buy milk");
  addTodo(db, "write <b>docs</b>");
  toggleTodo(db, 1);
  printAll(listTodos(db));
  removeTodo(db, 2);
  console.log("-- after remove --");
  printAll(listTodos(db));
  console.log(renderPage(listTodos(db)));
  sqlite_close(db);
}
