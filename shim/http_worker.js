// The network half of shim/http.js: a port of machin's HTTP client (0.146.1, unchanged in 0.146.3), over a plain socket.
// test/http_test.ts compares the two, including the bytes they send.
import { workerData } from "node:worker_threads";
import { lookup } from "node:dns/promises";

const utf8 = new TextEncoder();
//why: header text is only searched for ASCII, and one byte per character keeps positions right.
const latin1 = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return s; };
const fail = (error) => ({ status: 0, body: new Uint8Array(0), error });
const IDLE = Symbol("idle");

/** `promise`, or IDLE after `ms` (0 waits for ever). */
async function within(promise, ms) {
  if (ms <= 0) return await promise;
  let timer;
  const late = new Promise((ok) => (timer = setTimeout(() => ok(IDLE), ms)));
  promise.catch(() => {});
  try { return await Promise.race([promise, late]); } finally { clearTimeout(timer); }
}

function parseUrl(url) {
  if (/[\x00-\x1f\x7f]/.test(url)) return { error: "url" };
  let rest = url, tls = true;
  if (/^https:\/\//i.test(url)) rest = url.slice(8);
  else if (/^http:\/\//i.test(url)) { rest = url.slice(7); tls = false; }
  else {
    const at = url.indexOf("://");
    if (at >= 0 && at < url.split(/[/?#]/)[0].length) return { error: "scheme" };
  }
  const authority = rest.split(/[/?#]/)[0];
  if (/[@ ]/.test(authority)) return { error: "url" };
  let host, port, v6 = false;
  if (authority.startsWith("[")) {
    const close = authority.indexOf("]");
    if (close < 0) return { error: "url" };
    host = authority.slice(1, close);
    v6 = true;
    if (close + 1 < authority.length) {
      if (authority[close + 1] !== ":") return { error: "url" };
      port = authority.slice(close + 2);
    }
  } else {
    const colon = authority.indexOf(":");
    host = colon < 0 ? authority : authority.slice(0, colon);
    port = colon < 0 ? undefined : authority.slice(colon + 1);
  }
  if (host === "" || utf8.encode(host).length >= 256) return { error: "url" };
  let number = tls ? 443 : 80;
  if (port) {
    if (!/^\d+$/.test(port) || Number(port) > 65535 || Number(port) === 0) return { error: "url" };
    number = Number(port);
  }
  const tail = rest.slice(authority.length).split("#")[0];
  const target = (tail.startsWith("/") ? "" : "/") + tail.replaceAll(" ", "%20");
  return { tls, host, port: number, v6, target };
}

const hostName = (u) => (u.v6 ? `[${u.host}]` : u.host);

/** The URL a Location header names, or null for a scheme that isn't followed. */
function resolveLocation(base, loc) {
  const scheme = base.tls ? "https" : "http";
  const first = /^[^/?#:]*/.exec(loc)[0];
  if (loc[first.length] === ":") return /^https?:\/\//i.test(loc) ? loc : null;
  if (loc.startsWith("//")) return `${scheme}:${loc}`;
  const root = `${scheme}://${hostName(base)}:${base.port}`;
  let path = base.target.split("?")[0];
  if (loc.startsWith("/")) return root + loc;
  if (loc === "" || loc.startsWith("#")) return root + base.target;
  if (loc.startsWith("?")) return root + path + loc;
  const up = () => { path = path.slice(0, path.lastIndexOf("/") + 1); };
  up();
  for (;;) {
    if (loc.startsWith("./")) loc = loc.slice(2);
    else if (loc.startsWith("../")) {
      loc = loc.slice(3);
      if (path.length > 1) { path = path.slice(0, -1); up(); }
    } else break;
  }
  return root + path + loc;
}

//why: on a redirect to another origin only these are forwarded; a secret can be under any name.
const FORWARDED = new Set(["accept", "accept-charset", "accept-encoding", "accept-language", "cache-control", "content-encoding",
  "content-language", "content-type", "if-match", "if-modified-since", "if-none-match", "if-range", "if-unmodified-since", "pragma", "range", "user-agent"]);

/** The value of the first header called `name`, or null. */
function header(head, name) {
  for (const line of head.split("\n").slice(1)) {
    if (line.slice(0, name.length + 1).toLowerCase() === `${name}:`) return line.slice(name.length + 1).replace(/^[ \t]+/, "").split("\r")[0];
  }
  return null;
}

/** Send the request and read until the connection ends: { error } or { raw, ended }. */
async function exchange(u, bytes, ms) {
  let conn;
  //why: native resolves the name before its timeout starts, so a slow resolver still ends in "dns".
  try { await lookup(u.host); } catch { return { error: "dns" }; }
  const opening = Deno.connect({ hostname: u.host, port: u.port });
  try { conn = await within(opening, ms); }
  catch (e) { return { error: /lookup address|not known|No address/i.test(e.message) ? "dns" : "connect" }; }
  if (conn === IDLE) { opening.then((c) => c.close(), () => {}); return { error: "timeout" }; }
  try {
    if (u.tls) {
      try {
        conn = await Deno.startTls(conn, { hostname: u.host });
        if (await within(conn.handshake(), ms) === IDLE) return { error: "timeout" };
      } catch { return { error: "tls" }; }
    }
    try {
      for (let sent = 0; sent < bytes.length;) {
        const n = await within(conn.write(bytes.subarray(sent)), ms);
        if (n === IDLE) break;
        sent += n;
      }
    } catch { /* as natively: whatever the server answered is still read */ }
    const parts = [], buffer = new Uint8Array(8192);
    let ended = "eof";
    for (;;) {
      let n;
      try { n = await within(conn.read(buffer), ms); }
      //why: TLS closed without close_notify counts as a normal end, as natively.
      catch (e) { ended = e instanceof Deno.errors.UnexpectedEof ? "eof" : "broken"; break; }
      if (n === IDLE) { ended = "idle"; break; }
      if (n === null) break;
      parts.push(buffer.slice(0, n));
    }
    const raw = new Uint8Array(parts.reduce((total, p) => total + p.length, 0));
    parts.reduce((at, p) => (raw.set(p, at), at + p.length), 0);
    return { raw, ended };
  } finally {
    try { conn.close(); } catch { /* already closed */ }
  }
}

/** The body of a chunked reply, and whether all of it arrived. */
function dechunk(body) {
  const text = latin1(body), parts = [];
  let at = 0, complete = false;
  while (/[0-9a-f]/i.test(text[at] ?? "")) {
    let size = 0;
    while (/[0-9a-f]/i.test(text[at] ?? "") && size <= body.length) size = size * 16 + parseInt(text[at++], 16);
    const line = text.indexOf("\n", at);
    if (line < 0) break;
    at = line + 1;
    if (size === 0) { complete = true; break; }
    if (size > body.length - at) break;
    parts.push(body.subarray(at, at + size));
    at += size;
    if (text[at] === "\r") at++;
    if (text[at] !== "\n") break;
    at++;
  }
  const out = new Uint8Array(parts.reduce((total, p) => total + p.length, 0));
  parts.reduce((o, p) => (out.set(p, o), o + p.length), 0);
  return { out, complete };
}

/** One call, following redirects. `lines` are the caller's header lines. */
async function call(method, url, lines, body, timeout, redirects) {
  if (!/^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/.test(method)) return fail("method");
  const u = parseUrl(url);
  if (u.error) return fail(u.error);
  const host = hostName(u) + (u.port === (u.tls ? 443 : 80) ? "" : `:${u.port}`);
  const payload = utf8.encode(body);
  const head = utf8.encode(`${method} ${u.target} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: machin/0.8\r\nAccept: */*\r\n` +
    lines.map((l) => `${l}\r\n`).join("") + (payload.length ? `Content-Length: ${payload.length}\r\n` : "") + "Connection: close\r\n\r\n");
  const request = new Uint8Array(head.length + payload.length);
  request.set(head);
  request.set(payload, head.length);
  const got = await exchange(u, request, timeout);
  if (got.error) return fail(got.error);

  const cut = got.ended === "idle" ? "timeout" : "truncated";
  const all = latin1(got.raw);
  let start = 0, status, headers, rest;
  for (;;) {
    if (start === all.length) return fail(got.ended === "idle" ? "timeout" : "empty");
    const message = all.slice(start);
    if (!"HTTP/".startsWith(message.slice(0, 5))) return fail("response");
    const text = message.split("\0")[0];
    const blank = text.indexOf("\r\n\r\n");
    if (blank < 0) return fail(cut);
    const space = text.indexOf(" ");
    status = space >= 0 && space < blank ? parseInt(text.slice(space + 1), 10) || 0 : 0;
    if (status < 100 || status > 999) return fail("response");
    if (status < 200 && status !== 101) { start += blank + 4; continue; }
    headers = text.slice(0, blank);
    rest = got.raw.subarray(start + blank + 4);
    break;
  }

  if (redirects > 0 && [301, 302, 303, 307, 308].includes(status)) {
    const found = header(headers, "location");
    const location = found === null ? "" : found.replace(/[ \t]+$/, "");
    //why: the header was read one byte per character; give the URL its text back.
    const next = location && resolveLocation(u, new TextDecoder().decode(Uint8Array.from(location, (c) => c.charCodeAt(0))));
    if (next) {
      const n = parseUrl(next);
      if (n.error) return fail(n.error);
      const keep = status === 307 || status === 308;
      const nextBody = keep ? body : "";
      //why: a request body is never sent again from https to plain http: the 3xx is returned.
      if (!(u.tls && !n.tls && nextBody)) {
        const same = n.tls === u.tls && n.port === u.port && n.host.toLowerCase() === u.host.toLowerCase();
        const forwarded = same ? lines : lines.filter((l) => l.includes(":") && FORWARDED.has(l.slice(0, l.indexOf(":")).toLowerCase()));
        return await call(keep || method === "HEAD" ? method : "GET", next, forwarded, nextBody, timeout, redirects - 1);
      }
    }
  }

  const coding = header(headers, "transfer-encoding");
  if (method === "HEAD" || status === 101 || status === 204 || status === 304) rest = new Uint8Array(0);
  else if (coding !== null && /chunked$/i.test(coding)) {
    const { out, complete } = dechunk(rest);
    if (!complete) return fail(cut);
    rest = out;
  } else {
    const length = header(headers, "content-length");
    if (length !== null) {
      const digits = /^\d+(?=$|[ \t\n])/.exec(length);
      if (!digits) return fail("response");
      if (Number(digits[0]) > rest.length) return fail(cut);
      rest = rest.subarray(0, Number(digits[0]));
    } else if (got.ended !== "eof") return fail(got.ended === "idle" ? "timeout" : "read");
  }
  if (rest.includes(0)) return fail("nul");
  return { status, body: rest.slice(), error: "" };
}

workerData.port.on("message", async (r) => {
  let reply;
  try {
    const lines = r.headers.filter((h) => h !== "");
    reply = lines.some((h) => /[\r\n]/.test(h)) ? fail("header") : await call(r.method, r.url, lines, r.body, r.timeout, r.redirects);
  } catch (e) {
    reply = { crash: String(e?.message ?? e) };
  }
  workerData.port.postMessage(reply);
  Atomics.store(workerData.done, 0, 1);
  Atomics.notify(workerData.done, 0);
});
