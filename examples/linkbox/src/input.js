import { split, index, substr, len, url_decode, url_encode, contains, has_prefix } from "machin";

/**
 * Read one field from an application/x-www-form-urlencoded body.
 * @param {string} body
 * @param {string} name
 * @returns {string} the decoded value, or "" if absent.
 */
export function formField(body, name) {
  //why: outside input arrives as form fields — machin's JSON parser can't reject bad JSON.
  for (const part of split(body, "&")) {
    const eq = index(part, "=");
    if (eq > 0 && substr(part, 0, eq) == name) {
      return url_decode(substr(part, eq + 1, len(part)));
    }
  }
  return "";
}

/**
 * Does the text contain a control character (including newlines)?
 * @param {string} s
 * @returns {boolean}
 */
function hasControl(s) {
  //why: machin's json() would send most of them raw, which is invalid JSON. Percent-encoding
  //     turns bytes 0x00-0x1F into %0x/%1x, and a literal % into %25, so this can't misfire.
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
