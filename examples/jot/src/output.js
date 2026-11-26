import { json } from "machin";
import { includes } from "./args.js";

/** @typedef {import("./model.js").Row} Row */
/** @typedef {import("./model.js").Task} Task */
/** @typedef {import("./model.js").Line} Line */
/** @typedef {{ok: boolean, version: string, task: Task}} One */
/** @typedef {{ok: boolean, version: string, count: int, tasks: Task[]}} Many */

/**
 * A stored row as the task that gets printed.
 * @param {Row} row
 * @returns {Task}
 */
function toTask(row) {
  //why: agents get a real boolean, not SQLite's 0 or 1.
  return { id: row.id, title: row.title, tag: row.tag, done: row.done == 1 };
}

/**
 * One tab-separated line: id, state, tag, title.
 * @param {Task} t
 * @returns {string}
 */
function textLine(t) {
  //why: title is last, so cut and awk can take the rest of the line.
  const state = t.done ? "done" : "open";
  return `${t.id}\t${state}\t${t.tag}\t${t.title}`;
}

/**
 * Print one task.
 * @param {Line} line
 * @param {Row} row
 * @returns {void}
 */
export function printOne(line, row) {
  //why: JSON unless --text, because the main reader is an agent.
  if (includes(line.flags, "--text")) {
    console.log(textLine(toTask(row)));
  } else {
    /** @type {One} */
    const reply = { ok: true, version: "1.0", task: toTask(row) };
    console.log(json(reply));
  }
}

/**
 * Print a list of tasks.
 * @param {Line} line
 * @param {Row[]} rows
 * @returns {void}
 */
export function printMany(line, rows) {
  //why: in text mode an empty list prints nothing, which is what a pipeline expects.
  /** @type {Task[]} */
  const tasks = [];
  for (const row of rows) {
    tasks.push(toTask(row));
  }
  if (includes(line.flags, "--text")) {
    for (const t of tasks) {
      console.log(textLine(t));
    }
  } else {
    /** @type {Many} */
    const reply = { ok: true, version: "1.0", count: tasks.length, tasks };
    console.log(json(reply));
  }
}
