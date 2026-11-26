import { split, trim, len, has_prefix } from "machin";
import { parseCents } from "./money.js";

/** @typedef {import("./model.js").Entry} Entry */

/**
 * Parse one "category,amount,note" line. The note is optional.
 * @param {string} text
 * @param {int} line 1-based line number, for error messages.
 * @returns {Entry}
 */
function parseLine(text, line) {
  //why: a bad line becomes an entry with ok: false — machin has no exceptions to throw.
  const parts = split(text, ",");
  if (parts.length < 2 || parts.length > 3 || trim(parts[0]) == "") {
    return { ok: false, line, category: "", cents: 0, note: "" };
  }
  const amount = parseCents(trim(parts[1]));
  let note = "";
  if (parts.length == 3) {
    note = trim(parts[2]);
  }
  return { ok: amount.ok, line, category: trim(parts[0]), cents: amount.cents, note };
}

/**
 * Parse a whole file, skipping blank lines and # comments.
 * @param {string} content
 * @returns {Entry[]}
 */
export function parseFile(content) {
  //why: line numbers count every line, so they match what an editor shows.
  /** @type {Entry[]} */
  const entries = [];
  const lines = split(content, "\n");
  for (let i = 0; i < lines.length; i++) {
    const text = trim(lines[i]);
    if (len(text) > 0 && !has_prefix(text, "#")) {
      entries.push(parseLine(text, i + 1));
    }
  }
  return entries;
}
