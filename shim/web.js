// Deno twin of machin's machweb: same handler(req) -> res contract.
//why: lets the exact same handler run as plain JS so smoke tests can compare it to native.
//why: shapes and status strings mirror framework/machweb.src.
export const response = (status, ctype, body) => ({ status, ctype, body, location: "" });
export const ok_text = (b) => response("200 OK", "text/plain", b);
export const ok_html = (b) => response("200 OK", "text/html; charset=utf-8", b);
export const ok_json = (b) => response("200 OK", "application/json", b);
export const created = (b) => response("201 Created", "application/json", b);
export const bad_request = (msg) => response("400 Bad Request", "text/plain", msg);
export const not_found = () => response("404 Not Found", "text/plain", "not found");
export const redirect = (url) => ({ ...response("302 Found", "text/html; charset=utf-8", ""), location: url });
export const header = (req, name) => req.headers[name.toLowerCase()] ?? "";
export const query = (req, name) => {
  const mark = req.path.indexOf("?");
  let value = "";
  if (mark < 0) return value;
  for (const part of req.path.slice(mark + 1).split("&")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === name) value = decode(part.slice(eq + 1));
  }
  return value;
};
const decode = (s) => { try { return decodeURIComponent(s.replace(/\+/g, " ")).split("\0")[0]; } catch { return s; } };
//why: a native string ends at the first NUL byte, and keeps invalid UTF-8 (which json_valid then
//     rejects). JavaScript can't hold those bytes, so such a body becomes a marker that is also invalid.
const text = (bytes) => {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes).split("\0")[0]; } catch { return "\udfff"; }
};
//why: machweb sends a header's UTF-8 bytes as they are. Headers takes one character per byte.
const wire = (s) => String.fromCharCode(...new TextEncoder().encode(s.split("\0")[0]));
/** The first head value that would add a line to the response head, named as machweb names it. */
const refusal = (res) => {
  const values = [["status", res.status], ["content type", res.ctype], ["location", res.location]];
  return values.find(([, value]) => /[\r\n]/.test(value.split("\0")[0]))?.[0] ?? "";
};
//why: like machweb, send nothing of a refused response, and never log the value itself.
const refused = (field) => {
  console.error(`machweb: response refused: ${field}`);
  return new Response("internal server error", { status: 500, headers: { "content-type": "text/plain" } });
};
// serve(port, handler): the same handler(req) -> res contract as machweb.
export function serve(port, handler) {
  Deno.serve({ port, onListen() {} }, async (r) => {
    const u = new URL(r.url);
    const req = { method: r.method, path: u.pathname + u.search, body: text(await r.arrayBuffer()), headers: Object.fromEntries(r.headers) };
    const res = handler(req);
    const field = refusal(res);
    if (field) return refused(field);
    const h = new Headers({ "content-type": wire(res.ctype) });
    if (res.location) h.set("location", wire(res.location));
    return new Response(res.body, { status: parseInt(res.status, 10), headers: h });
  });
}
