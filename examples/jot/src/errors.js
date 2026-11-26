import { json, eprintln, exit } from "machin";

/**
 * Print a typed error on stderr and exit with its code (cli-output-spec §2 and §3).
 * @param {int} code 80-89 bad input, 90-99 precondition, 110-119 bug.
 * @param {string} kind stable snake_case name that agents branch on.
 * @param {string} message
 * @param {string[]} suggestions commands that help.
 * @returns {void}
 */
export function die(code, kind, message, suggestions) {
  //why: assembled by hand because the spec's field is "type", which machin reserves, so no
  //     typedef can declare it. json() still does all the escaping.
  const retry = code >= 100 && code < 110;
  const body = `"code":${code},"type":${json(kind)},"message":${json(message)},"recoverable":${retry},"suggestions":${json(suggestions)}`;
  eprintln("{\"ok\":false,\"error\":{" + body + "}}");
  exit(code);
}

/**
 * Bad arguments: exit 80 and point at the catalog.
 * @param {string} message
 * @returns {void}
 */
export function usage(message) {
  //why: the most common error, so its suggestions are in one place.
  die(80, "invalid_arguments", message, ["jot help-json", "jot guide"]);
}
