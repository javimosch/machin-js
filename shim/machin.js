// Node/Deno twins of the machin builtins used by the todo app.
//why: lets the same .js run as plain JS, so a human can debug it and the
//     oracle can diff it against the native build.
import { DatabaseSync } from "node:sqlite";
const dbs = [null];
export function sqlite_open(path) { dbs.push(new DatabaseSync(path)); return dbs.length - 1; }
export function sqlite_exec(h, sql, params = []) { dbs[h].prepare(sql).run(...params); return 0; }
export function sqlite_query(h, sql, params = []) { return JSON.stringify(dbs[h].prepare(sql).all(...params)); }
export function sqlite_close(h) { dbs[h].close(); return 0; }
export function parse(json, _witness) { return JSON.parse(json); }
export function replace(s, a, b) { return s.split(a).join(b); }
