import { sqlite_open, sqlite_exec, sqlite_query, parse } from "machin";

/** @typedef {import("./model.js").Link} Link */
/** @typedef {import("./model.js").TagCount} TagCount */

/**
 * Open the database, creating the table on first use.
 * @param {string} path
 * @returns {int} database handle.
 */
export function openStore(path) {
  //why: NOT NULL everywhere, because a NULL would silently turn into "" natively.
  const db = sqlite_open(path);
  sqlite_exec(db, "CREATE TABLE IF NOT EXISTS links (id INTEGER PRIMARY KEY, url TEXT NOT NULL, title TEXT NOT NULL, tag TEXT NOT NULL)");
  return db;
}

/**
 * Save a link.
 * @param {int} db
 * @param {string} url
 * @param {string} title
 * @param {string} tag
 * @returns {Link[]} the saved link, as a list of one.
 */
export function addLink(db, url, title, tag) {
  //why: RETURNING hands back the row with its new id, with no second query to race against.
  return parse(sqlite_query(db, "INSERT INTO links (url, title, tag) VALUES (?, ?, ?) RETURNING id, url, title, tag", [url, title, tag]), []);
}

/**
 * Links, oldest first; all of them when `tag` is "".
 * @param {int} db
 * @param {string} tag
 * @returns {Link[]}
 */
export function listLinks(db, tag) {
  //why: one query handles both cases, so they can't drift apart.
  return parse(sqlite_query(db, "SELECT id, url, title, tag FROM links WHERE ? = '' OR tag = ? ORDER BY id", [tag, tag]), []);
}

/**
 * Delete a link.
 * @param {int} db
 * @param {int} id
 * @returns {Link[]} the deleted link, or an empty list if there was none.
 */
export function removeLink(db, id) {
  //why: RETURNING tells us whether anything was deleted, which decides between 200 and 404.
  return parse(sqlite_query(db, "DELETE FROM links WHERE id = ? RETURNING id, url, title, tag", [String(id)]), []);
}

/**
 * Link counts per tag, most used first.
 * @param {int} db
 * @returns {TagCount[]}
 */
export function countByTag(db) {
  //why: the database groups for us — no need for maps in the program.
  return parse(sqlite_query(db, "SELECT tag, COUNT(*) AS count FROM links GROUP BY tag ORDER BY count DESC, tag"), []);
}
