import { examples, gotchas, loop } from "./lessons.js";

/** @typedef {import("./guidetypes.js").Model} Model */
/** @typedef {import("./guidetypes.js").Concepts} Concepts */
/** @typedef {import("./guidetypes.js").Groups} Groups */
/** @typedef {import("./guidetypes.js").Guide} Guide */

/**
 * How jot is put together.
 * @returns {Model}
 */
function model() {
  //why: the three facts an agent needs before its first command.
  return {
    storage: "One local SQLite file: $JOT_DB, default jot.db in the current directory. No server, no network.",
    output: "Data goes to stdout as one JSON object with ok and version. --text gives one tab-separated task per line.",
    errors: "On failure stdout is empty, stderr holds one JSON error object, and the exit code equals error.code.",
  };
}

/**
 * The words jot uses.
 * @returns {Concepts}
 */
function concepts() {
  //why: definitions, so commands and errors can use these words freely.
  return {
    task: "id, title, tag and done.",
    id: "A whole number jot assigns. It is never reused, even after rm.",
    tag: "An optional label. list --tag shows one tag.",
    done: "A finished task. list hides done tasks unless --all is given.",
  };
}

/**
 * Commands by purpose.
 * @returns {Groups}
 */
function groups() {
  //why: usage strings; help-json is the machine-readable catalog.
  return {
    tasks: ["jot add <title> [--tag <name>]", "jot list [--all] [--tag <name>]", "jot show <id>", "jot done <id>", "jot rm <id>"],
    about: ["jot guide [--human]", "jot help-json", "jot version"],
  };
}

/**
 * The whole guide (cli-guide-spec §1). It is compiled into the binary.
 * @param {string} version
 * @returns {Guide}
 */
export function guide(version) {
  //why: one structure feeds both the JSON and --human, so they can't disagree.
  return {
    jot: "A task list that an AI agent or a script can drive.",
    one_liner: "jot keeps tasks in a local SQLite file. Every command is non-interactive and answers with JSON.",
    model: model(), loop: loop(), concepts: concepts(), commands: groups(), examples: examples(), gotchas: gotchas(),
    version, see_also: ["jot help-json", "jot version"],
  };
}
