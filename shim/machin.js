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

// ---- string/number builtins ----
export const has_prefix = (s, p) => s.startsWith(p);
export const parse_int = (s) => (/^-?\d+$/.test(s) ? parseInt(s, 10) : 0);
export const split = (s, sep) => s.split(sep);
export const url_decode = (s) => { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; } };
export const json = (v) => JSON.stringify(v);
export const env = (name) => Deno.env.get(name) ?? "";
//why: machin strings are bytes, so these count UTF-8 bytes here too (not UTF-16 units).
const utf8 = new TextEncoder(), text = new TextDecoder();
export const len = (x) => typeof x === "string" ? utf8.encode(x).length : x.length;
export const substr = (s, a, b) => text.decode(utf8.encode(s).slice(a, b));
export const index = (s, sub) => { const i = s.indexOf(sub); return i < 0 ? -1 : utf8.encode(s.slice(0, i)).length; };
