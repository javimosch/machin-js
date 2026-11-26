import { split, index, substr, len, url_decode, url_encode, contains, has_prefix, json_valid } from "machin";
import { json_has, json_is_string, json_string } from "machin/json";

/** @typedef {import("./model.js").NewLink} NewLink */

/**
 * Read one field from an application/x-www-form-urlencoded body.
 * @param {string} body
 * @param {string} name
 * @returns {string} the decoded value, or "" if absent.
 */
function formField(body, name) {
  //why: hand-rolled because it is tiny; url_decode also turns + into space.
  for (const part of split(body, "&")) {
    const eq = index(part, "=");
    if (eq > 0 && substr(part, 0, eq) == name) {
      return url_decode(substr(part, eq + 1, len(part)));
    }
  }
  return "";
}

/**
 * Read the fields from a form body.
 * @param {string} body
 * @returns {NewLink}
 */
export function fromForm(body) {
  //why: an absent form field is simply "", and validation catches the required ones.
  return { url: formField(body, "url"), title: formField(body, "title"), tag: formField(body, "tag"), problem: "" };
}

/**
 * Read the fields from a JSON body, insisting on the right types.
 * @param {string} body
 * @returns {NewLink}
 */
export function fromJson(body) {
  //why: not parse() — it would silently turn bad JSON or a wrong type into "".
  let problem = "";
  if (!json_valid(body)) {
    problem = "invalid JSON";
  } else if (!json_is_string(body, "url") || !json_is_string(body, "title")) {
    problem = "url and title must be strings";
  } else if (json_has(body, "tag") && !json_is_string(body, "tag")) {
    problem = "tag must be a string";
  }
  return { url: json_string(body, "url"), title: json_string(body, "title"), tag: json_string(body, "tag"), problem };
}

/**
 * Does the text contain a control character (including newlines)?
 * @param {string} s
 * @returns {boolean}
 */
function hasControl(s) {
  //why: a URL, title or tag is one line of text. Percent-encoding turns bytes 0x00-0x1F into
  //     %0x/%1x, and a literal % into %25, so this can't misfire.
  const encoded = url_encode(s);
  return contains(encoded, "%0") || contains(encoded, "%1") || contains(encoded, "%7F");
}

/**
 * What is wrong with a new link?
 * @param {string} url
 * @param {string} title
 * @param {string} tag
 * @returns {string} a message for the client, or "" if the link is fine.
 */
export function problemWith(url, title, tag) {
  //why: only web links — a stored javascript: URL would run if some page ever linked to it.
  if (!has_prefix(url, "http://") && !has_prefix(url, "https://")) {
    return "url must start with http:// or https://";
  }
  if (title == "" || len(url) > 2000 || len(title) > 200 || len(tag) > 50) {
    return "title is required; limits are url 2000, title 200, tag 50 bytes";
  }
  if (hasControl(url) || hasControl(title) || hasControl(tag)) {
    return "control characters are not allowed";
  }
  return "";
}
