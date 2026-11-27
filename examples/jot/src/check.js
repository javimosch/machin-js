import { len, substr, index, parse_int, url_encode, contains } from "machin";
import { die, usage } from "./errors.js";

/** @typedef {import("./model.js").Line} Line */

/**
 * Stop unless the line has exactly `count` operands and only flags this command knows.
 * @param {Line} line
 * @param {int} count
 * @param {string[]} allowed flags, besides the ones every command takes.
 * @returns {void}
 */
export function expect(line, count, allowed) {
  //why: a mistyped flag must fail loudly; silently ignoring it would mislead an agent.
  const global = ["--json", "--text", "--yes", "-y", "--no-interactive", "--help-json"];
  const unknown = line.flags.filter((flag) => !global.includes(flag) && !allowed.includes(flag));
  if (unknown.length > 0) {
    usage(`unknown flag for ${line.command}: ${unknown[0]}`);
  }
  if (line.operands.length < count) {
    die(82, "missing_argument", `${line.command} needs ${count} argument(s)`, ["jot help-json"]);
  }
  if (line.operands.length > count) {
    usage(`too many arguments for ${line.command}; quote a title that has spaces`);
  }
}

/**
 * The task id in the first operand.
 * @param {Line} line
 * @returns {int}
 */
export function idOf(line) {
  //why: parse_int would read "3abc" as 3; an id must be digits only.
  const text = line.operands[0];
  let digits = len(text) > 0 && len(text) <= 15;
  for (let i = 0; i < len(text); i++) {
    if (index("0123456789", substr(text, i, i + 1)) < 0) {
      digits = false;
    }
  }
  if (!digits) {
    die(85, "invalid_value", "the id must be a whole number: " + text, ["jot list --all"]);
  }
  return parse_int(text);
}

/**
 * Stop unless `value` is one line of at most `limit` bytes.
 * @param {string} name
 * @param {string} value
 * @param {int} limit
 * @returns {void}
 */
export function oneLine(name, value, limit) {
  //why: --text prints one task per line, so a newline or tab would forge rows.
  const encoded = url_encode(value);
  if (len(value) > limit || contains(encoded, "%0") || contains(encoded, "%1") || contains(encoded, "%7F")) {
    die(85, "invalid_value", `${name} must be one line, at most ${limit} bytes, without control characters`, []);
  }
}
