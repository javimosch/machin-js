import { json } from "machin";
import { BUILD, CONTRACT } from "./model.js";
import { catalog } from "./catalog.js";
import { guide } from "./guide.js";
import { markdown } from "./human.js";
import { expect } from "./check.js";
import { usage } from "./errors.js";

/** @typedef {import("./model.js").Line} Line */
/** @typedef {import("./guidetypes.js").GuideReply} GuideReply */
/** @typedef {{ok: boolean, version: string, tool: string, build: string}} Version */

/**
 * jot guide [--human]
 * @param {Line} line
 * @returns {void}
 */
function printGuide(line) {
  //why: JSON by default; --human is for people.
  expect(line, 0, ["--human"]);
  if (line.flags.includes("--human")) {
    console.log(markdown(guide(BUILD)));
  } else {
    /** @type {GuideReply} */
    const reply = { ok: true, version: CONTRACT, guide: guide(BUILD) };
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
    console.log(catalog(BUILD));
  } else if (line.command == "guide") {
    printGuide(line);
  } else if (line.command == "version") {
    expect(line, 0, []);
    /** @type {Version} */
    const reply = { ok: true, version: CONTRACT, tool: "jot", build: BUILD };
    console.log(json(reply));
  } else {
    usage("unknown command: " + line.command);
  }
}
