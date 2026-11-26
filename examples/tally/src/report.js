import { sort_by, len } from "machin";
import { formatCents } from "./money.js";

/** @typedef {import("./model.js").Entry} Entry */
/** @typedef {import("./model.js").Total} Total */

/**
 * Add up entries per category, biggest spend first.
 * @param {Entry[]} entries
 * @returns {Total[]}
 */
export function totalsByCategory(entries) {
  //why: a plain search is fine for a handful of categories, and there are no maps in the subset.
  /** @type {Total[]} */
  const totals = [];
  for (const e of entries) {
    let at = -1;
    for (let i = 0; i < totals.length; i++) {
      if (totals[i].category == e.category) { at = i; }
    }
    if (at < 0) {
      totals.push({ category: e.category, cents: e.cents, count: 1 });
    } else {
      totals[at] = { category: e.category, cents: totals[at].cents + e.cents, count: totals[at].count + 1 };
    }
  }
  return sort_by(totals, (a, b) => a.cents > b.cents);
}

/**
 * Pad `s` with spaces on the right up to `width`.
 * @param {string} s
 * @param {int} width
 * @returns {string}
 */
function pad(s, width) {
  //why: there is no padEnd in the subset; a short loop is clear enough.
  let out = s;
  while (len(out) < width) {
    out += " ";
  }
  return out;
}

/**
 * Print one row per category and a grand total.
 * @param {Total[]} totals
 * @returns {void}
 */
export function printReport(totals) {
  //why: the grand total is summed from the rows shown, so the two can't disagree.
  let sum = 0;
  for (const t of totals) {
    console.log(`${pad(t.category, 14)}${pad(formatCents(t.cents), 10)}(${t.count})`);
    sum += t.cents;
  }
  console.log(`${pad("total", 14)}${formatCents(sum)}`);
}
