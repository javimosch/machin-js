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

// ---- HTTP layer twins (machweb) ----
export const len = (x) => x.length;
export const index = (s, sub) => s.indexOf(sub);
export const substr = (s, a, b) => s.slice(a, b);
export const has_prefix = (s, p) => s.startsWith(p);
export const parse_int = (s) => (/^-?\d+$/.test(s) ? parseInt(s, 10) : 0);
export const split = (s, sep) => s.split(sep);
export const url_decode = (s) => { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; } };
export const json = (v) => JSON.stringify(v);
const resp = (status, ctype, body) => ({ status, ctype, body, location: "" });
export const ok_html = (b) => resp(200, "text/html; charset=utf-8", b);
export const ok_json = (b) => resp(200, "application/json", b);
export const not_found = () => resp(404, "text/plain", "not found");
export const redirect = (url) => ({ ...resp(302, "text/html", ""), location: url });
// serve(port, handler): the same handler(req) -> res contract as machweb.
export function serve(port, handler) {
  Deno.serve({ port, onListen() {} }, async (r) => {
    const u = new URL(r.url);
    const res = handler({ method: r.method, path: u.pathname + u.search, body: await r.text() });
    const h = new Headers({ "content-type": res.ctype });
    if (res.location) h.set("location", res.location);
    return new Response(res.body, { status: res.status, headers: h });
  });
}
