import { env, json, eprintln } from "machin";
import { http_call } from "machin/http";
import { hmac_sha256_hex } from "machin/crypto";

/** @typedef {import("./model.js").Link} Link */

/**
 * Tell another service that a link was created: a signed POST to $LINKBOX_NOTIFY_URL.
 * @param {Link} saved
 * @returns {void}
 */
export function announce(saved) {
  //why: the address comes only from whoever runs linkbox. Never take it from a request, or anyone
  //     could make this server call machines that only it can reach.
  const url = env("LINKBOX_NOTIFY_URL");
  const secret = env("LINKBOX_NOTIFY_SECRET");
  if (url == "" || secret == "") {
    return;
  }
  const body = json(saved);
  const headers = ["Content-Type: application/json", "X-Signature: sha256=" + hmac_sha256_hex(secret, body)];
  const reply = http_call("POST", url, headers, body);
  //why: the link is already saved, so a failure is only logged. `error` means no complete reply;
  //     a reply can also be complete and still say no. The URL isn't logged: it may hold a token.
  if (reply.error != "") {
    eprintln("linkbox: notify failed: " + reply.error);
  } else if (reply.status < 200 || reply.status > 299) {
    eprintln(`linkbox: notify answered ${reply.status}`);
  }
}
