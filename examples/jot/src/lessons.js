/** @typedef {import("./guidetypes.js").Example} Example */

/**
 * The usual workflow.
 * @returns {string[]}
 */
export function loop() {
  //why: in order, as an agent would do it.
  return ["jot list to see what is open", "jot add <title> for new work", "work on a task", "jot done <id> when it is finished", "jot list again"];
}

/**
 * Commands that work as written on a new database.
 * @returns {Example[]}
 */
export function examples() {
  //why: the conformance test runs every line, so an example can't go stale.
  return [
    { goal: "Add a task and read its id", do: ["jot add \"write the report\" --tag work", "jot show 1"] },
    { goal: "See what is open for one tag", do: ["jot list --tag work", "jot list --tag work --text"] },
    { goal: "Finish a task, then see everything", do: ["jot done 1", "jot list --all"] },
    { goal: "Add a title that starts with a dash", do: ["jot add -- \"-v flag is broken\""] },
  ];
}

/**
 * What surprises people.
 * @returns {string[]}
 */
export function gotchas() {
  //why: each of these has an exit code or a default behind it.
  return [
    "The database is jot.db in the current directory unless JOT_DB is set, so another directory shows another list.",
    "done on a finished task fails with 95 already_done; a missing id is 92 not_found.",
    "Titles and tags are one line. Newlines, tabs and other control characters are refused with 85.",
    "Flags jot does not know are errors (80), not ignored. Put -- before a title that starts with a dash.",
    "jot never retries. An error with recoverable true may be retried by the caller.",
  ];
}
