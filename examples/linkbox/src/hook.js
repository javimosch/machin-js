import { env, has_prefix, json_valid } from "machin";
import { header } from "machin/web";
import { hmac_sha256_hex, digest_equal } from "machin/crypto";
import { fail, save } from "./reply.js";
import { fromJson } from "./input.js";

/** @typedef {import("machin/web").Request} Request */
/** @typedef {import("machin/web").Response} Response */

/**
 * Is the body signed with the shared secret? The header is "sha256=" and the HMAC in hex.
 * @param {Request} req
 * @param {string} secret
 * @returns {boolean}
 */
function signedBy(req, secret) {
  //why: digest_equal, because the time == takes would help someone guess a signature.
  return digest_equal(header(req, "x-signature"), "sha256=" + hmac_sha256_hex(secret, req.body));
}

/**
 * Let another service create a link: a JSON body signed with $LINKBOX_HOOK_SECRET, no token.
 * @param {Request} req
 * @param {int} db
 * @returns {Response}
 */
export function receiveHook(req, db) {
  //why: with no secret anyone could sign, so the route doesn't exist until one is set.
  const secret = env("LINKBOX_HOOK_SECRET");
  if (secret == "" || !has_prefix(header(req, "content-type"), "application/json")) {
    return fail("404 Not Found", "no such route");
  }
  //why: checked first, since only valid text hashes the same under Deno and natively.
  if (!json_valid(req.body)) {
    return fail("400 Bad Request", "invalid JSON");
  }
  if (!signedBy(req, secret)) {
    return fail("401 Unauthorized", "missing or wrong signature");
  }
  return save(db, fromJson(req.body));
}
