/**
 * One todo item.
 * @typedef {{id: int, title: string, done: int}} Todo
 */
//why: `done` is int 0/1, not bool — SQLite returns 0/1 and decoding rows
//     straight into this shape avoids a conversion step.
//why: makes this file a module, so others can import the Todo type.
export {};
