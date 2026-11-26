// Node/Deno twins of the machin builtins used by the todo app.
//why: lets the same .js run as plain JS, so a human can debug it and the
//     oracle can diff it against the native build.
import { DatabaseSync } from "node:sqlite";
const dbs = [null];
export function sqlite_open(path) { dbs.push(new DatabaseSync(path)); return dbs.length - 1; }
//why: Deno's node:sqlite can't bind numbered placeholders (?1), which machin can.
function prepare(h, sql) {
  if (/\?\d/.test(sql)) throw new Error("the Deno stand-in supports only plain ? placeholders, not ?1");
  return dbs[h].prepare(sql);
}
export function sqlite_exec(h, sql, params = []) { prepare(h, sql).run(...params); return 0; }
export function sqlite_query(h, sql, params = []) { return JSON.stringify(prepare(h, sql).all(...params)); }
export function sqlite_close(h) { dbs[h].close(); return 0; }
export function parse(json, _witness) {
  //why: natively a NULL column silently becomes "" or 0; here it stays null, so fail loudly.
  return JSON.parse(json, (key, value) => {
    if (value === null) throw new Error(`parse: "${key}" is null — natively it would silently become empty; declare the column NOT NULL`);
    return value;
  });
}

// ---- string/number builtins ----
export const has_prefix = (s, p) => s.startsWith(p);
export const split = (s, sep) => s.split(sep);
//why: a machin string ends at the first NUL byte, so %00 cuts off the rest.
export const url_decode = (s) => { try { return decodeURIComponent(s.replace(/\+/g, " ")).split("\0")[0]; } catch { return s; } };
export const json = (v) => JSON.stringify(v);
//why: Deno throws on a name no variable can have; machin just finds nothing.
export const env = (name) => (name === "" || /[=\0]/.test(name) ? "" : Deno.env.get(name) ?? "");
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
export const read_file = (path) => {
  let bytes;
  try { bytes = Deno.readFileSync(path); } catch { return ""; }
  //why: a machin string ends at the first zero byte.
  const end = bytes.indexOf(0);
  //why: natively invalid bytes are kept; JavaScript would silently replace them, so stop instead.
  try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(end < 0 ? bytes : bytes.subarray(0, end)); }
  catch { throw new Error(`read_file: ${path} is not valid UTF-8 — natively its raw bytes would be kept`); }
};
//why: joined first, because console.error reads % codes in a first argument that has others after it.
export const eprintln = (...xs) => console.error(xs.map(String).join(" "));
export const exit = (code) => Deno.exit(code);
export const contains = (s, sub) => s.includes(sub);
//why: RFC 3986 like machin: only A-Z a-z 0-9 - . _ ~ stay as they are (encodeURIComponent keeps more).
export const url_encode = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
//why: machin's check is strict RFC 8259 with at most 512 nested levels; JSON.parse has no limit.
export const json_valid = (s) => {
  if (!s.isWellFormed()) return false;
  try { JSON.parse(s); } catch { return false; }
  let depth = 0;
  for (const c of s.replace(/"(?:[^"\\]+|\\.)*"/g, "")) {
    depth += c === "{" || c === "[" ? 1 : c === "}" || c === "]" ? -1 : 0;
    if (depth > 512) return false;
  }
  return true;
};
