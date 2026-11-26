import { sqlite_close } from "machin";
import { openStore, insert, tasksWhere } from "./store.js";
import { find, finish, erase } from "./byid.js";
import { die } from "./errors.js";
import { expect, idOf, oneLine } from "./check.js";
import { includes } from "./args.js";
import { printOne, printMany } from "./output.js";

/** @typedef {import("./model.js").Line} Line */
/** @typedef {import("./model.js").Row} Row */

/**
 * jot add <title> [--tag name]
 * @param {Line} line
 * @returns {void}
 */
export function add(line) {
  //why: everything is validated before the database is touched.
  expect(line, 1, ["--tag"]);
  const title = line.operands[0];
  if (title == "") {
    die(82, "missing_argument", "the title is empty", []);
  }
  oneLine("title", title, 200);
  oneLine("tag", line.tag, 50);
  const db = openStore();
  const rows = insert(db, title, line.tag);
  if (rows.length == 0) {
    die(110, "internal_error", "the task was not saved", []);
  }
  printOne(line, rows[0]);
  sqlite_close(db);
}

/**
 * jot list [--all] [--tag name]
 * @param {Line} line
 * @returns {void}
 */
export function list(line) {
  //why: open tasks only by default, since that is what there is left to do.
  expect(line, 0, ["--all", "--tag"]);
  const db = openStore();
  const withDone = includes(line.flags, "--all") ? 1 : 0;
  printMany(line, tasksWhere(db, withDone, line.tag));
  sqlite_close(db);
}

/**
 * Print the single row in `rows`, or stop with "not found".
 * @param {Line} line
 * @param {Row[]} rows
 * @param {int} id
 * @returns {void}
 */
function printFound(line, rows, id) {
  //why: show, done and rm all report a missing id the same way.
  if (rows.length == 0) {
    die(92, "not_found", `no task with id ${id}`, ["jot list --all"]);
  }
  printOne(line, rows[0]);
}

/**
 * jot show <id> and jot rm <id>
 * @param {Line} line
 * @returns {void}
 */
export function showOrRemove(line) {
  //why: both take an id and print the task; only the query differs.
  expect(line, 1, []);
  const id = idOf(line);
  const db = openStore();
  if (line.command == "rm") {
    printFound(line, erase(db, id), id);
  } else {
    printFound(line, find(db, id), id);
  }
  sqlite_close(db);
}

/**
 * jot done <id>
 * @param {Line} line
 * @returns {void}
 */
export function done(line) {
  //why: finishing twice is a conflict (95), distinct from a missing id (92), so an agent can tell.
  expect(line, 1, []);
  const id = idOf(line);
  const db = openStore();
  const changed = finish(db, id);
  if (changed.length == 0 && find(db, id).length > 0) {
    die(95, "already_done", `task ${id} is already done`, [`jot show ${id}`]);
  }
  printFound(line, changed, id);
  sqlite_close(db);
}
