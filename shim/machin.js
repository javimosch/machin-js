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

// ---- string/number builtins ----
export const has_prefix = (s, p) => s.startsWith(p);
export const split = (s, sep) => s.split(sep);
export const url_decode = (s) => { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; } };
export const json = (v) => JSON.stringify(v);
export const env = (name) => Deno.env.get(name) ?? "";
//why: machin strings are bytes, so these count UTF-8 bytes here too (not UTF-16 units).
const utf8 = new TextEncoder(), text = new TextDecoder();
export const len = (x) => typeof x === "string" ? utf8.encode(x).length : x.length;
export const index = (s, sub) => { const i = s.indexOf(sub); return i < 0 ? -1 : utf8.encode(s.slice(0, i)).length; };
//why: same result as machin's sort_by — a new, stably sorted list; `less(a, b)` orders it.
export const sort_by = (xs, less) => [...xs].sort((a, b) => (less(a, b) ? -1 : less(b, a) ? 1 : 0));

// ---- these mirror machin exactly; test/shim_test.ts compares them with the real builtins ----
const SPACE = /^[ \t\n\r\v\f]+|[ \t\n\r\v\f]+$/g;
//why: ASCII whitespace only — JavaScript's own trim() also strips Unicode spaces, machin doesn't.
export const trim = (s) => s.replace(SPACE, "");
//why: like C's strtoll: leading spaces and a sign are allowed, anything after the digits is ignored.
export const parse_int = (s) => {
  const m = /^[ \t\n\r\v\f]*([+-]?\d+)/.exec(s);
  return m ? Math.max(-(2 ** 63), Math.min(2 ** 63, Number(m[1]))) + 0 : 0;
};
export const replace = (s, a, b) => (a === "" ? s : s.split(a).join(b));
//why: machin clamps both ends into range, and an end before the start gives "".
export const substr = (s, a, b) => {
  const bytes = utf8.encode(s);
  const from = Math.max(0, Math.min(a, bytes.length));
  return text.decode(bytes.slice(from, Math.max(from, Math.min(b, bytes.length))));
};
// ---- command-line programs ----
//why: machin's args()[0] is the program itself; user arguments start at 1.
export const args = () => ["program", ...Deno.args];
export const read_file = (path) => { try { return Deno.readTextFileSync(path); } catch { return ""; } };
export const eprintln = (...xs) => console.error(...xs.map(String));
export const exit = (code) => Deno.exit(code);
