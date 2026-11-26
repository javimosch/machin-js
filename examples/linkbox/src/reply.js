import { json } from "machin";
import { response } from "machin/web";

/** @typedef {import("machin/web").Response} Response */
/** @typedef {import("./model.js").ApiError} ApiError */
/** @typedef {import("./model.js").Link} Link */

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
