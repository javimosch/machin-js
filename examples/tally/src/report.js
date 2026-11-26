import { sort_by } from "machin";
import { pad_end } from "machin/text";
import { formatCents } from "./money.js";

/** @typedef {import("./model.js").Entry} Entry */
/** @typedef {import("./model.js").Total} Total */

/**
 * Add up entries per category, biggest spend first.
 * @param {Entry[]} entries
 * @returns {Total[]}
 */
export function totalsByCategory(entries) {
  //why: the list keeps first-seen order; the map only remembers each category's place in it.
  /** @type {Map<string, int>} */
  const places = new Map();
  /** @type {Total[]} */
  const totals = [];
  for (const e of entries) {
    if (!places.has(e.category)) {
      places.set(e.category, totals.length);
      totals.push({ category: e.category, cents: 0, count: 0 });
    }
    const at = places.get(e.category) ?? 0;
    totals[at] = { category: e.category, cents: totals[at].cents + e.cents, count: totals[at].count + 1 };
  }
  return sort_by(totals, (a, b) => a.cents > b.cents);
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
    console.log(`${pad_end(t.category, 14)}${pad_end(formatCents(t.cents), 10)}(${t.count})`);
    sum += t.cents;
  }
  console.log(`${pad_end("total", 14)}${formatCents(sum)}`);
}
