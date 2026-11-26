/**
 * A saved bookmark.
 * @typedef {{id: int, url: string, title: string, tag: string}} Link
 */
/**
 * How many links carry a tag.
 * @typedef {{tag: string, count: int}} TagCount
 */
/**
 * The body of every error response: {"error": "..."}.
 * @typedef {{error: string}} ApiError
 */
//why: these are also the exact JSON shapes clients receive.
export {};
