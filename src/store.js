import { sqlite_open, sqlite_exec, sqlite_query, parse } from "machin";
/** @typedef {import("./model.js").Todo} Todo */

/**
 * Open the database and make sure the table exists.
 * @param {string} path SQLite file, or ":memory:".
 * @returns {int} database handle.
 */
export function openStore(path) {
  //why: CREATE IF NOT EXISTS makes startup idempotent, so no migration step.
  const db = sqlite_open(path);
  sqlite_exec(db, "CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, title TEXT, done INTEGER DEFAULT 0)");
  return db;
}

/**
 * Add a todo, not done.
 * @param {int} db
 * @param {string} title
 * @returns {int} sqlite result code, 0 on success.
 */
export function addTodo(db, title) {
  //why: bound parameter (?) — never concatenate user text into SQL.
  return sqlite_exec(db, "INSERT INTO todos (title) VALUES (?)", [title]);
}

/**
 * Flip a todo between done and not done.
 * @param {int} db
 * @param {int} id
 * @returns {int} sqlite result code, 0 on success.
 */
export function toggleTodo(db, id) {
  //why: 1 - done flips 0<->1 in SQL, so no read-modify-write race.
  return sqlite_exec(db, "UPDATE todos SET done = 1 - done WHERE id = ?", [String(id)]);
}

/**
 * Delete a todo.
 * @param {int} db
 * @param {int} id
 * @returns {int} sqlite result code, 0 on success.
 */
export function removeTodo(db, id) {
  //why: deleting a missing id is not an error — it is already gone.
  return sqlite_exec(db, "DELETE FROM todos WHERE id = ?", [String(id)]);
}

/**
 * All todos, oldest first.
 * @param {int} db
 * @returns {Todo[]}
 */
export function listTodos(db) {
  //why: parse() decodes the JSON rows straight into Todo[] by column name.
  return parse(sqlite_query(db, "SELECT id, title, done FROM todos ORDER BY id"), []);
}
