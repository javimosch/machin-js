import { len, has_prefix } from "machin";

/** @typedef {import("./model.js").Line} Line */

/**
 * Is `list` holding `item`?
 * @param {string[]} list
 * @param {string} item
 * @returns {boolean}
 */
export function includes(list, item) {
  //why: there is no .includes() in the subset.
  for (const x of list) {
    if (x == item) {
      return true;
    }
  }
  return false;
}

/**
 * What one argument is: "word", "flag", "end" (--), "tag" (--tag) or "tagvalue".
 * @param {string} arg
 * @param {string} before what the argument before it was.
 * @param {boolean} ended has "--" been seen?
 * @returns {string}
 */
function kindOf(arg, before, ended) {
  //why: "--" ends the flags, so that a title may start with a dash.
  if (before == "tag") {
    return "tagvalue";
  }
  if (!ended && arg == "--") {
    return "end";
  }
  if (!ended && arg == "--tag") {
    return "tag";
  }
  if (!ended && len(arg) > 1 && has_prefix(arg, "-")) {
    return "flag";
  }
  return "word";
}

/**
 * The kind of every argument after the program name.
 * @param {string[]} argv
 * @returns {string[]} one kind per argument, in order.
 */
function kindsOf(argv) {
  //why: deciding once what each argument is keeps the collecting below trivial.
  /** @type {string[]} */
  const kinds = [];
  let before = "";
  let ended = false;
  for (let i = 1; i < argv.length; i++) {
    before = kindOf(argv[i], before, ended);
    if (before == "end") {
      ended = true;
    }
    kinds.push(before);
  }
  return kinds;
}

/**
 * The arguments of either of two kinds.
 * @param {string[]} argv
 * @param {string[]} kinds from kindsOf(argv).
 * @param {string} kind
 * @param {string} other a second kind, or the same one again.
 * @returns {string[]}
 */
function pick(argv, kinds, kind, other) {
  //why: kinds[i] describes argv[i + 1], since argv[0] is the program.
  /** @type {string[]} */
  const found = [];
  for (let i = 0; i < kinds.length; i++) {
    if (kinds[i] == kind || kinds[i] == other) {
      found.push(argv[i + 1]);
    }
  }
  return found;
}

/**
 * Split the command line into command, operands, flags and the tag.
 * @param {string[]} argv
 * @returns {Line}
 */
export function parseLine(argv) {
  //why: the first plain word is the command; the rest are its operands.
  const kinds = kindsOf(argv);
  const words = pick(argv, kinds, "word", "word");
  const flags = pick(argv, kinds, "flag", "tag");
  const values = pick(argv, kinds, "tagvalue", "tagvalue");
  const tags = pick(argv, kinds, "tag", "tag");
  const problem = tags.length > values.length ? "--tag needs a value" : "";
  let tag = "";
  if (values.length > 0) {
    tag = values[values.length - 1];
  }
  return shape(words, flags, tag, problem);
}

/**
 * Turn the collected words into a Line.
 * @param {string[]} words
 * @param {string[]} flags
 * @param {string} tag
 * @param {string} problem
 * @returns {Line}
 */
function shape(words, flags, tag, problem) {
  //why: --help-json is the spec's flag spelling of the help-json command.
  let command = "";
  if (words.length > 0) {
    command = words[0];
  }
  /** @type {string[]} */
  const operands = [];
  for (let i = 1; i < words.length; i++) {
    operands.push(words[i]);
  }
  if (includes(flags, "--help-json")) {
    command = "help-json";
  }
  return { command, operands, flags, tag, problem };
}
