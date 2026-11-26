import { args } from "machin";
import { parseLine } from "./args.js";
import { usage, die } from "./errors.js";
import { add, list, showOrRemove, done } from "./commands.js";
import { meta } from "./meta.js";

/** @typedef {import("./model.js").Line} Line */

/**
 * Run the command a line names.
 * @param {Line} line
 * @returns {void}
 */
function dispatch(line) {
  //why: task commands first; everything about the tool itself is in meta().
  if (line.command == "add") {
    add(line);
  } else if (line.command == "list") {
    list(line);
  } else if (line.command == "done") {
    done(line);
  } else if (line.command == "show" || line.command == "rm") {
    showOrRemove(line);
  } else {
    meta(line);
  }
}

/**
 * jot: a task list an agent can drive. See `jot guide`.
 * @returns {void}
 */
export function main() {
  //why: no prompts anywhere, so nothing here ever waits for input.
  const line = parseLine(args());
  if (line.problem != "") {
    die(82, "missing_argument", line.problem, ["jot help-json"]);
  }
  if (line.command == "") {
    usage("no command given");
  }
  dispatch(line);
}
