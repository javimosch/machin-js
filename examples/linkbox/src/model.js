/**
 * A saved bookmark.
 * @typedef {{id: int, url: string, title: string, tag: string}} Link
 */
/**
 * How many links carry a tag.
 * @typedef {{tag: string, count: int}} TagCount
 */
/**
 * What a client sent to create a link. `problem` is "" if it could be read.
 * @typedef {{url: string, title: string, tag: string, problem: string}} NewLink
 */
/**
 * The body of every error response: {"error": "..."}.
 * @typedef {{error: string}} ApiError
 */
//why: these are also the exact JSON shapes clients receive.
export {};
