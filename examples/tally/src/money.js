import { split, parse_int, len, substr, index } from "machin";

/** @typedef {{ok: boolean, cents: int}} Amount */

/**
 * Is `s` one or more digits and nothing else?
 * @param {string} s
 * @returns {boolean}
 */
function isDigits(s) {
  //why: parse_int alone accepts "12abc" as 12, which would silently swallow typos in money.
  for (let i = 0; i < len(s); i++) {
    if (index("0123456789", substr(s, i, i + 1)) < 0) {
      return false;
    }
  }
  return len(s) > 0;
}

/**
 * Read "12", "12.5" or "12.50" as cents.
 * @param {string} text
 * @returns {Amount} ok is false for anything else.
 */
export function parseCents(text) {
  //why: split at the dot and use whole numbers, so no rounding can ever happen.
  const parts = split(text, ".");
  const fraction = parts.length == 2 ? parts[1] : "00";
  if (parts.length > 2 || !isDigits(parts[0]) || !isDigits(fraction) || len(fraction) > 2) {
    return { ok: false, cents: 0 };
  }
  const padded = substr(fraction + "0", 0, 2);
  return { ok: true, cents: parse_int(parts[0]) * 100 + parse_int(padded) };
}

/**
 * Show cents as "12.50".
 * @param {int} cents zero or more.
 * @returns {string}
 */
export function formatCents(cents) {
  //why: the 100 + trick keeps the leading zero in 5 cents -> "05".
  const rest = substr(String(100 + cents % 100), 1, 3);
  return `${Math.trunc(cents / 100)}.${rest}`;
}
