/**
 * A task as stored. `done` is 0 or 1, as SQLite keeps it.
 * @typedef {{id: int, title: string, tag: string, done: int}} Row
 */
/**
 * A task as printed.
 * @typedef {{id: int, title: string, tag: string, done: boolean}} Task
 */
/**
 * One command line, taken apart. `problem` is "" if it could be understood.
 * @typedef {{command: string, operands: string[], flags: string[], tag: string, problem: string}} Line
 */
//why: field order here is the order in the JSON that agents receive.
export {};
