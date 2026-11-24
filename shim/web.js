// Deno twin of machin's machweb: same handler(req) -> res contract.
//why: lets the exact same handler run as plain JS so smoke tests can compare it to native.
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
