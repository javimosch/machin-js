import { env, index, substr, len, parse_int, has_prefix, json, sqlite_close } from "machin";
import { header, query, ok_json } from "machin/web";
import { openStore, addLink, listLinks, removeLink, countByTag } from "./store.js";
import { formField, problemWith } from "./input.js";
import { fail, one } from "./reply.js";

/** @typedef {import("machin/web").Request} Request */
/** @typedef {import("machin/web").Response} Response */

/**
 * Create a link from the form fields url, title and tag.
 * @param {Request} req
 * @param {int} db
 * @returns {Response}
 */
function create(req, db) {
  //why: validate before touching the database, so nothing invalid is ever stored.
  const url = formField(req.body, "url");
  const title = formField(req.body, "title");
  const tag = formField(req.body, "tag");
  const problem = problemWith(url, title, tag);
  if (problem != "") {
    return fail("400 Bad Request", problem);
  }
  return one(addLink(db, url, title, tag), "201 Created");
}

/**
 * Handle a request that changes data: it needs the token.
 * @param {Request} req
 * @param {string} path without the query string.
 * @param {int} db
 * @returns {Response}
 */
function handleWrite(req, path, db) {
  //why: the token is checked once, here, so no writing route can forget it.
  if (header(req, "authorization") != "Bearer " + env("LINKBOX_TOKEN")) {
    return fail("401 Unauthorized", "missing or wrong token");
  }
  if (req.method == "POST" && path == "/api/links") {
    return create(req, db);
  }
  if (req.method == "DELETE" && has_prefix(path, "/api/links/")) {
    return one(removeLink(db, parse_int(substr(path, len("/api/links/"), len(path)))), "200 OK");
  }
  return fail("404 Not Found", "no such route");
}

/**
 * Route one request.
 * @param {Request} req
 * @param {string} path without the query string.
 * @param {int} db
 * @returns {Response}
 */
function routeRequest(req, path, db) {
  //why: reading is public; everything else goes through handleWrite(), which wants the token.
  if (req.method != "GET") {
    return handleWrite(req, path, db);
  }
  if (path == "/api/links") {
    return ok_json(json(listLinks(db, query(req, "tag"))));
  }
  if (path == "/api/tags") {
    return ok_json(json(countByTag(db)));
  }
  return fail("404 Not Found", "no such route");
}

/**
 * Handle one HTTP request.
 * @param {Request} req
 * @returns {Response}
 */
export function handle(req) {
  //why: req.path still carries the query string, so cut it off before routing.
  const mark = index(req.path, "?");
  let path = req.path;
  if (mark >= 0) {
    path = substr(req.path, 0, mark);
  }
  let file = env("LINKBOX_DB");
  if (file == "") {
    file = "links.db";
  }
  const db = openStore(file);
  const res = routeRequest(req, path, db);
  sqlite_close(db);
  return res;
}
