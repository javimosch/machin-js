import { env, sqlite_open, sqlite_exec, sqlite_query, parse } from "machin";
import { die } from "./errors.js";

/** @typedef {import("./model.js").Row} Row */

/**
 * Open the database ($JOT_DB, default jot.db) and make sure the table exists.
 * @returns {int} database handle.
 */
export function openStore() {
  //why: a path that can't be written fails here, once, with a clear error.
  let path = env("JOT_DB");
  if (path == "") {
    path = "jot.db";
  }
  const db = sqlite_open(path);
  const rc = sqlite_exec(db, "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, tag TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0)");
  if (rc != 0) {
    die(94, "storage_unavailable", "cannot open or write the database " + path, ["JOT_DB=/writable/path/jot.db jot list"]);
  }
  return db;
}

/**
 * Add a task.
 * @param {int} db
 * @param {string} title
 * @param {string} tag
 * @returns {Row[]} the new row, as a list of one.
 */
export function insert(db, title, tag) {
  //why: RETURNING gives the id without a second query that another process could beat.
  return parse(sqlite_query(db, "INSERT INTO tasks (title, tag) VALUES (?, ?) RETURNING id, title, tag, done", [title, tag]), []);
}

/**
 * Tasks, oldest first.
 * @param {int} db
 * @param {int} withDone 1 to include finished tasks.
 * @param {string} tag only this tag, or "" for all.
 * @returns {Row[]}
 */
export function tasksWhere(db, withDone, tag) {
  //why: the filters live in SQL, so one query covers every combination.
  return parse(sqlite_query(db, "SELECT id, title, tag, done FROM tasks WHERE (done = 0 OR ? = '1') AND (? = '' OR tag = ?) ORDER BY id", [String(withDone), tag, tag]), []);
}
