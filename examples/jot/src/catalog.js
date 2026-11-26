import { json } from "machin";

/** @typedef {{args: string[], flags: string[], auth: boolean}} Command */

/**
 * `"name":value` for a JSON object built by hand.
 * @param {string} name
 * @param {string} value already JSON.
 * @returns {string}
 */
function member(name, value) {
  //why: keys like "help-json" and "80" can't be struct field names; json() still escapes them.
  return json(name) + ":" + value;
}

/**
 * A JSON object from its members.
 * @param {string[]} members
 * @returns {string}
 */
function object(members) {
  //why: there is no join() among the stand-ins, and this is all it would do.
  let inside = "";
  for (const m of members) {
    if (inside != "") {
      inside += ",";
    }
    inside += m;
  }
  return "{" + inside + "}";
}

/**
 * One command's entry in the catalog.
 * @param {string} name
 * @param {string[]} operands
 * @param {string[]} flags
 * @returns {string}
 */
function command(name, operands, flags) {
  //why: jot is local, so no command ever needs authentication.
  /** @type {Command} */
  const c = { args: operands, flags, auth: false };
  return member(name, json(c));
}

/**
 * Every public command.
 * @returns {string}
 */
function commands() {
  //why: must list everything main() accepts; the conformance test checks that.
  return object([command("add", ["title"], ["--tag <name>"]), command("list", [], ["--all", "--tag <name>"]),
    command("show", ["id"], []), command("done", ["id"], []), command("rm", ["id"], []),
    command("guide", [], ["--human"]), command("help-json", [], []), command("version", [], [])]);
}

/**
 * Every exit code jot uses.
 * @returns {string}
 */
function exitCodes() {
  //why: agents branch on these numbers, so each one is named.
  return object([member("0", json("success")), member("80", json("invalid arguments")),
    member("82", json("missing argument")), member("85", json("invalid value")),
    member("92", json("task not found")), member("94", json("database unavailable")),
    member("95", json("task already done")), member("110", json("internal error"))]);
}

/**
 * The help-json catalog (cli-output-spec §4).
 * @param {string} version
 * @returns {string}
 */
export function catalog(version) {
  //why: global flags are listed once; every command accepts them.
  return object([member("version", json(version)), member("output", json("json")), member("commands", commands()),
    member("global_flags", json(["--json", "--text", "--yes", "-y", "--no-interactive"])),
    member("exit_codes", exitCodes()), member("env", json(["JOT_DB"])), member("see_also", json(["jot guide"]))]);
}
