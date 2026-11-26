import { sqlite_query, parse } from "machin";

/** @typedef {import("./model.js").Row} Row */

/**
 * One task by id.
 * @param {int} db
 * @param {int} id
 * @returns {Row[]} empty if there is none.
 */
export function find(db, id) {
  //why: a list says "found or not" without needing a null.
  return parse(sqlite_query(db, "SELECT id, title, tag, done FROM tasks WHERE id = ?", [String(id)]), []);
}

/**
 * Mark an open task done.
 * @param {int} db
 * @param {int} id
 * @returns {Row[]} empty if there is no open task with that id.
 */
export function finish(db, id) {
  //why: "AND done = 0" makes two racing calls give one success and one conflict.
  return parse(sqlite_query(db, "UPDATE tasks SET done = 1 WHERE id = ? AND done = 0 RETURNING id, title, tag, done", [String(id)]), []);
}

/**
 * Delete a task.
 * @param {int} db
 * @param {int} id
 * @returns {Row[]} the deleted row, or empty if there was none.
 */
export function erase(db, id) {
  //why: returning the row lets the caller show, or restore, what was removed.
  return parse(sqlite_query(db, "DELETE FROM tasks WHERE id = ? RETURNING id, title, tag, done", [String(id)]), []);
}
