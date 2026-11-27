import { json } from "machin";
import { response } from "machin/web";
import { addLink } from "./store.js";
import { problemWith } from "./input.js";
import { announce } from "./notify.js";

/** @typedef {import("machin/web").Response} Response */
/** @typedef {import("./model.js").ApiError} ApiError */
/** @typedef {import("./model.js").Link} Link */
/** @typedef {import("./model.js").NewLink} NewLink */

/**
 * An error response with a JSON body.
 * @param {string} status e.g. "404 Not Found".
 * @param {string} message
 * @returns {Response}
 */
export function fail(status, message) {
  //why: every error has the same shape, so clients need one error path.
  /** @type {ApiError} */
  const body = { error: message };
  return response(status, "application/json", json(body));
}

/**
 * Reply with the one link in `found`, or 404 if there is none.
 * @param {Link[]} found
 * @param {string} status the status when it was found.
 * @returns {Response}
 */
export function one(found, status) {
  //why: shared by create and delete, which both get a list of zero or one from the store.
  if (found.length == 0) {
    return fail("404 Not Found", "no such link");
  }
  return response(status, "application/json", json(found[0]));
}

/**
 * Check a new link and store it: 201 with the link, or 400 saying what is wrong.
 * @param {int} db
 * @param {NewLink} input
 * @returns {Response}
 */
export function save(db, input) {
  //why: validate before touching the database, so nothing invalid is ever stored.
  if (input.problem != "") {
    return fail("400 Bad Request", input.problem);
  }
  const problem = problemWith(input.url, input.title, input.tag);
  if (problem != "") {
    return fail("400 Bad Request", problem);
  }
  const added = addLink(db, input.url, input.title, input.tag);
  if (added.length == 1) {
    announce(added[0]);
  }
  return one(added, "201 Created");
}
