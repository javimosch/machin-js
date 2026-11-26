import { args, read_file, eprintln, exit } from "machin";
import { parseFile } from "./expense.js";
import { totalsByCategory, printReport } from "./report.js";

/** @typedef {import("./model.js").Entry} Entry */

/**
 * Complain about every bad line on stderr.
 * @param {Entry[]} entries
 * @returns {int} how many were bad.
 */
function reportBad(entries) {
  //why: list them all at once, so the file can be fixed in one go.
  let bad = 0;
  for (const e of entries) {
    if (!e.ok) {
      eprintln(`line ${e.line}: expected category,amount[,note]`);
      bad++;
    }
  }
  return bad;
}

/**
 * tally <file>: summarize expenses. Exit 0 ok, 1 bad lines, 2 usage or unreadable file.
 * @returns {void}
 */
export function main() {
  //why: distinct exit codes let scripts tell "fix your data" from "you called it wrong".
  const argv = args();
  if (argv.length != 2) {
    eprintln("usage: tally <expenses-file>");
    exit(2);
  }
  const content = read_file(argv[1]);
  if (content == "") {
    eprintln(`tally: cannot read ${argv[1]} (missing or empty)`);
    exit(2);
  }
  const entries = parseFile(content);
  if (reportBad(entries) > 0) {
    exit(1);
  }
  printReport(totalsByCategory(entries));
}
