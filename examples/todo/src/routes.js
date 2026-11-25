import { split, index, substr, url_decode, parse_int, has_prefix, json, sqlite_close } from "machin";
import { not_found, redirect, ok_html, ok_json } from "machin/web";
import { openStore, addTodo, toggleTodo, removeTodo, listTodos } from "./store.js";
import { renderPage } from "./render.js";

/** @typedef {import("machin/web").Request} Request */
/** @typedef {import("machin/web").Response} Response */

/**
 * Read one field from an application/x-www-form-urlencoded body.
 * @param {string} body e.g. "title=buy+milk&x=1".
 * @param {string} name
 * @returns {string} the decoded value, or "" if absent.
 */
function formField(body, name) {
  //why: hand-rolled because forms are the only input; url_decode also turns + into space.
  const parts = split(body, "&");
  for (let i = 0; i < parts.length; i++) {
    const eq = index(parts[i], "=");
    if (eq > 0 && substr(parts[i], 0, eq) == name) {
      return url_decode(substr(parts[i], eq + 1, parts[i].length));
    }
  }
  return "";
}

/**
 * The numeric id at the end of a path like "/toggle/7".
 * @param {string} path
 * @param {string} prefix e.g. "/toggle/".
 * @returns {int} the id, or 0 if not a number.
 */
function idFromPath(path, prefix) {
  //why: parse_int gives 0 for junk, and no todo has id 0, so junk is a harmless no-op.
  return parse_int(substr(path, prefix.length, path.length));
}

/**
 * Apply a POST (add / toggle / delete) to the store.
 * @param {Request} req
 * @param {int} db
 * @returns {void}
 */
function applyPost(req, db) {
  //why: every mutation is a POST; the caller redirects back to "/" afterwards.
  const title = formField(req.body, "title");
  if (req.path == "/add" && title != "") {
    addTodo(db, title);
  }
  if (has_prefix(req.path, "/toggle/")) {
    toggleTodo(db, idFromPath(req.path, "/toggle/"));
  }
  if (has_prefix(req.path, "/delete/")) {
    removeTodo(db, idFromPath(req.path, "/delete/"));
  }
}

/**
 * Handle one HTTP request.
 * @param {Request} req
 * @returns {Response}
 */
export function handle(req) {
  //why: the db is opened per request — stateless, so no handle is shared across goroutines.
  const db = openStore("todos.db");
  let res = not_found();
  if (req.method == "POST") {
    applyPost(req, db);
    res = redirect("/");
  } else if (req.path == "/") {
    res = ok_html(renderPage(listTodos(db)));
  } else if (req.path == "/api/todos") {
    res = ok_json(json(listTodos(db)));
  }
  sqlite_close(db);
  return res;
}
