/**
 * One line of the expense file, parsed. When `ok` is false only `line` is meaningful.
 * @typedef {{ok: boolean, line: int, category: string, cents: int, note: string}} Entry
 */
/**
 * What was spent in one category.
 * @typedef {{category: string, cents: int, count: int}} Total
 */
//why: money is whole cents in an int — decimals can't represent 0.10 exactly, and machin-js has none.
export {};
