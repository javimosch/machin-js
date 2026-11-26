/** @typedef {{storage: string, output: string, errors: string}} Model */
/** @typedef {{task: string, id: string, tag: string, done: string}} Concepts */
/** @typedef {{tasks: string[], about: string[]}} Groups */
/** @typedef {{goal: string, do: string[]}} Example */
/**
 * @typedef {{
 *   jot: string,
 *   one_liner: string,
 *   model: Model,
 *   loop: string[],
 *   concepts: Concepts,
 *   commands: Groups,
 *   examples: Example[],
 *   gotchas: string[],
 *   version: string,
 *   see_also: string[],
 * }} Guide
 */
/** @typedef {{ok: boolean, version: string, guide: Guide}} GuideReply */
//why: these are the fields cli-guide-spec requires; "jot" is the spec's <tool> key.
export {};
