import { json } from "machin";
import { catalog } from "./catalog.js";
import { guide } from "./guide.js";
import { markdown } from "./human.js";
import { expect } from "./check.js";
import { usage } from "./errors.js";
import { includes } from "./args.js";

/** @typedef {import("./model.js").Line} Line */
/** @typedef {import("./guidetypes.js").GuideReply} GuideReply */
/** @typedef {{ok: boolean, version: string, tool: string, build: string}} Version */

/**
 * jot's own version, in one place so guide, help-json and version can't disagree.
 * @returns {string}
 */
function build() {
  //why: the subset has no top-level constants, so a function holds it.
  return "0.1.0";
}

/**
 * jot guide [--human]
 * @param {Line} line
 * @returns {void}
 */
function printGuide(line) {
  //why: JSON by default; --human is for people.
  expect(line, 0, ["--human"]);
  if (includes(line.flags, "--human")) {
    console.log(markdown(guide(build())));
  } else {
    /** @type {GuideReply} */
    const reply = { ok: true, version: "1.0", guide: guide(build()) };
    console.log(json(reply));
  }
}

/**
 * The commands about jot itself: help-json, help, guide, version. Anything else is an error.
 * @param {Line} line
 * @returns {void}
 */
export function meta(line) {
  //why: the last stop of the dispatch, so unknown commands end here with exit 80.
  if (line.command == "help-json" || line.command == "help") {
    expect(line, 0, []);
    console.log(catalog(build()));
  } else if (line.command == "guide") {
    printGuide(line);
  } else if (line.command == "version") {
    expect(line, 0, []);
    /** @type {Version} */
    const reply = { ok: true, version: "1.0", tool: "jot", build: build() };
    console.log(json(reply));
  } else {
    usage("unknown command: " + line.command);
  }
}
