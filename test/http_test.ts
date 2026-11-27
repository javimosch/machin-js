// machin/http: the Deno stand-in is compared with machin's own client, against a raw TCP server.
// Both get the same replies; their results and the bytes they send must be the same.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildGraph } from "../transpile/transpile.ts";

const root = new URL("../", import.meta.url).pathname;
const bytes = (s: string) => new TextEncoder().encode(s);
const show = (b: Uint8Array) => new TextDecoder().decode(b);

/** What the server does with one connection: send these bytes, then close, hang or reset. */
type Reply = { send: string | Uint8Array; then?: "close" | "hang" };
/** One call. `url` and `Location` values may use {A} {B} {S}: two plain origins and a TLS one. */
type Case = { name: string; method?: string; url: string; headers?: string[]; body?: string };

let seen: string[] = [];
function serve(listener: Deno.Listener, tag: string, replies: Map<string, Reply>, fill: (s: string) => string) {
  const held: Deno.Conn[] = [];
  const done = (async () => {
    for await (const conn of listener) {
      (async () => {
        let got = "";
        const buffer = new Uint8Array(65536);
        //why: read the whole request, so closing doesn't reset a connection with unread bytes.
        for (;;) {
          const n = await conn.read(buffer);
          if (n === null) break;
          got += show(buffer.subarray(0, n));
          const blank = got.indexOf("\r\n\r\n");
          const length = /\r\nContent-Length: (\d+)\r\nConnection/.exec(got);
          if (blank >= 0 && bytes(got.slice(blank + 4)).length >= Number(length?.[1] ?? 0)) break;
        }
        seen.push(`${tag} ${got}`);
        const path = (got.split(" ")[1] ?? "").split("?")[0];
        const reply = replies.get(path) ?? { send: "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok" };
        const out = typeof reply.send === "string" ? bytes(fill(reply.send)) : reply.send;
        for (let at = 0; at < out.length;) at += await conn.write(out.subarray(at));
        if (reply.then === "hang") held.push(conn);
        else conn.close();
      })().catch(() => { try { conn.close(); } catch { /* closed */ } });
    }
  })();
  return async () => { listener.close(); await done.catch(() => {}); for (const c of held) try { c.close(); } catch { /* closed */ } };
}

const PROGRAM = `import { http_call } from "machin/http";
import { read_file, split, json, replace, url_decode } from "machin";

/** Run each case in the file: method, url, headers and body, one case per line. */
export function main() {
  //why: %XX keeps tabs and line breaks out of the file's own layout.
  for (const row of split(read_file("cases.txt"), "\\n")) {
    const f = split(row, "\\t");
    if (len(f) == 4) {
      /** @type {string[]} */
      const headers = [];
      for (const h of split(f[2], " ")) {
        if (h != "") {
          headers.push(url_decode(h));
        }
      }
      console.log(json(http_call(url_decode(f[0]), url_decode(f[1]), headers, url_decode(f[3]))));
    }
  }
}
`.replace("replace, url_decode }", "url_decode, len }");

/** Build the program once; returns a function that runs it natively or under Deno. */
async function program(dir: string) {
  await Deno.writeTextFile(`${dir}/m.js`, PROGRAM);
  const built = await buildGraph(`${dir}/m.js`);
  assertEquals(built.diags, []);
  const bridged = await Promise.all(built.native.map((f) => Deno.readTextFile(f)));
  await Deno.writeTextFile(`${dir}/m.src`, [...bridged, ...built.order.map((o) => o.out)].join("\n"));
  const enc = await new Deno.Command("machin", { args: ["encode", "m.src"], cwd: dir }).output();
  assert(enc.success, show(enc.stderr));
  await Deno.writeFile(`${dir}/m.mfl`, enc.stdout);
  const cc = await new Deno.Command("machin", { args: ["build", "m.mfl", "-o", "app", "--safe"], cwd: dir }).output();
  assert(cc.success, show(cc.stderr));
  await Deno.writeTextFile(`${dir}/run.mjs`, 'import { main } from "./m.js";\nmain();\n');
  await Deno.writeTextFile(`${dir}/map.json`, JSON.stringify({ imports: { machin: `${root}shim/machin.js`, "machin/http": `${root}shim/http.js` } }));
}

async function run(dir: string, native: boolean, env: Record<string, string>) {
  const [cmd, args] = native ? [`${dir}/app`, []] : ["deno", ["run", "-A", "--no-config", "--import-map=map.json", "run.mjs"]];
  const r = await new Deno.Command(cmd, { args, cwd: dir, env, signal: AbortSignal.timeout(60000) }).output();
  return { code: r.code, out: show(r.stdout), err: show(r.stderr) };
}

/** A throwaway authority and a certificate for 127.0.0.1 signed by it. */
async function certificate(dir: string) {
  const openssl = async (...args: string[]) => assert((await new Deno.Command("openssl", { args, cwd: dir }).output()).success, `openssl ${args[0]}`);
  const key = ["-newkey", "rsa:2048", "-nodes"];
  await openssl("req", "-x509", ...key, "-keyout", "ca.key", "-out", "ca.pem", "-days", "2", "-subj", "/CN=test authority",
    "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign");
  await openssl("req", ...key, "-keyout", "tls.key", "-out", "tls.csr", "-subj", "/CN=127.0.0.1");
  await Deno.writeTextFile(`${dir}/ext`, "subjectAltName=IP:127.0.0.1\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n");
  await openssl("x509", "-req", "-in", "tls.csr", "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-out", "tls.pem", "-days", "2", "-extfile", "ext");
  return { cert: await Deno.readTextFile(`${dir}/tls.pem`), key: await Deno.readTextFile(`${dir}/tls.key`) };
}

/** Run `cases` both ways against `replies` and require the same results and the same requests. */
async function compare(cases: Case[], replies: Map<string, Reply>, env: Record<string, string> = {}, trust = true) {
  const dir = await Deno.makeTempDir();
  await program(dir);
  const tls = await certificate(dir);
  const plain = [0, 1].map(() => Deno.listen({ hostname: "127.0.0.1", port: 0 }));
  const secure = Deno.listenTls({ hostname: "127.0.0.1", port: 0, ...tls });
  const ports = [...plain, secure].map((l) => (l.addr as Deno.NetAddr).port);
  const fill = (s: string) => s.replaceAll("{A}", `http://127.0.0.1:${ports[0]}`).replaceAll("{B}", `http://127.0.0.1:${ports[1]}`)
    .replaceAll("{S}", `https://127.0.0.1:${ports[2]}`).replaceAll("{PORT}", String(ports[0]));
  const stops = [serve(plain[0], "A", replies, fill), serve(plain[1], "B", replies, fill), serve(secure, "S", replies, fill)];
  const field = (s: string) => encodeURIComponent(s);
  await Deno.writeTextFile(`${dir}/cases.txt`, cases.map((c) =>
    [field(c.method ?? "GET"), field(fill(c.url)), (c.headers ?? []).map(field).join(" "), field(c.body ?? "")].join("\t")).join("\n") + "\n");
  const vars = { MFL_HTTP_TIMEOUT_MS: "700", ...(trust ? { SSL_CERT_FILE: `${dir}/ca.pem`, DENO_CERT: `${dir}/ca.pem` } : {}), ...env };
  const results = [];
  for (const native of [true, false]) {
    seen = [];
    const r = await run(dir, native, vars);
    assertEquals(r.code, 0, r.err);
    results.push({ lines: r.out.trimEnd().split("\n"), seen });
  }
  for (const stop of stops) await stop();
  const [n, d] = results;
  assertEquals(n.lines.length, cases.length, n.lines.join("\n"));
  for (const [i, c] of cases.entries()) assertEquals(d.lines[i], n.lines[i], c.name);
  assertEquals(d.seen, n.seen, "the requests the server received");
  return { results: n.lines.map((l) => JSON.parse(l) as { status: number; body: string; error: string }), seen: n.seen };
}

const ok = "HTTP/1.1 200 OK\r\n";
const to = (status: number, location: string) => `HTTP/1.1 ${status} Moved\r\nLocation: ${location}\r\nContent-Length: 0\r\n\r\n`;

/** [name, reply, what machin should report: the error, or the body of a complete reply] */
const REPLIES: [string, Reply, string][] = [
  ["length", { send: `${ok}Content-Length: 5\r\n\r\nhello` }, "=hello"],
  ["length-extra", { send: `${ok}Content-Length: 2\r\n\r\nhello` }, "=he"],
  ["length-short", { send: `${ok}Content-Length: 100\r\n\r\nonly` }, "truncated"],
  ["length-short-hang", { send: `${ok}Content-Length: 100\r\n\r\nonly`, then: "hang" }, "timeout"],
  ["length-bad", { send: `${ok}Content-Length: x\r\n\r\nhi` }, "response"],
  ["length-tail", { send: `${ok}Content-Length: 2x\r\n\r\nhi` }, "response"],
  ["length-spaces", { send: `${ok}content-length:   2  \r\n\r\nhi` }, "=hi"],
  ["no-length", { send: `${ok}\r\nuntil the end` }, "=until the end"],
  ["no-length-hang", { send: `${ok}\r\nhalf`, then: "hang" }, "timeout"],
  ["chunked", { send: `${ok}Transfer-Encoding: chunked\r\n\r\n3\r\nabc\r\nA;x=1\r\n0123456789\r\n0\r\n\r\n` }, "=abc0123456789"],
  ["chunked-cut", { send: `${ok}Transfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n` }, "truncated"],
  ["chunked-short", { send: `${ok}Transfer-Encoding: chunked\r\n\r\nff\r\nabc` }, "truncated"],
  ["chunked-huge", { send: `${ok}Transfer-Encoding: chunked\r\n\r\nfffffffffffffffffffff\r\nabc` }, "truncated"],
  ["chunked-junk", { send: `${ok}Transfer-Encoding: chunked\r\n\r\nzz\r\n` }, "truncated"],
  ["chunked-hang", { send: `${ok}Transfer-Encoding: gzip, Chunked\r\n\r\n3\r\nabc\r\n`, then: "hang" }, "timeout"],
  ["empty", { send: "" }, "empty"],
  ["silent", { send: "", then: "hang" }, "timeout"],
  ["not-http", { send: "SSH-2.0\r\n\r\n" }, "response"],
  ["partial-word", { send: "HTT" }, "truncated"],
  ["no-blank-line", { send: `${ok}Content-Length: 2\r\n` }, "truncated"],
  ["no-status", { send: "HTTP/1.1 \r\n\r\n" }, "response"],
  ["status-high", { send: "HTTP/1.1 1000 No\r\n\r\n" }, "response"],
  ["interim", { send: `HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 103 Early\r\nLink: x\r\n\r\n${ok}Content-Length: 2\r\n\r\nhi` }, "=hi"],
  ["interim-only", { send: "HTTP/1.1 100 Continue\r\n\r\n" }, "empty"],
  ["switching", { send: "HTTP/1.1 101 Switching\r\n\r\nignored" }, "="],
  ["no-content", { send: "HTTP/1.1 204 No Content\r\n\r\nignored" }, "="],
  ["server-error", { send: "HTTP/1.1 500 Oops\r\nContent-Length: 4\r\n\r\nboom" }, "=boom"],
  ["nul", { send: `${ok}Content-Length: 5\r\n\r\nab\0cd` }, "nul"],
  ["nul-in-headers", { send: `${ok}X: a\0b\r\n\r\nhi` }, "truncated"],
  ["byte-order-mark", { send: `${ok}\r\n﻿x` }, "=﻿x"],
  ["unicode", { send: `${ok}X: é☃\r\n\r\né☃😀` }, "=é☃😀"],
  ["redirect-nowhere", { send: "HTTP/1.1 302 Found\r\nContent-Length: 1\r\n\r\ny" }, "=y"],
  ["redirect-empty", { send: "HTTP/1.1 302 Found\r\nLocation: \r\nContent-Length: 1\r\n\r\ny" }, "=y"],
  ["redirect-scheme", { send: "HTTP/1.1 302 Found\r\nLocation: ftp://x/\r\nContent-Length: 1\r\n\r\ny" }, "=y"],
  ["redirect-userinfo", { send: to(302, "http://u@127.0.0.1/") }, "url"],
  ["loop", { send: to(302, "/loop") }, "="],
];

Deno.test("machin/http: every kind of reply gives the same result in both", async () => {
  const replies = new Map(REPLIES.map(([name, reply]) => [`/${name}`, reply]));
  const r = await compare(REPLIES.map(([name]) => ({ name, url: `{A}/${name}` })), replies);
  for (const [i, [name, , want]] of REPLIES.entries()) {
    const got = r.results[i];
    assertEquals(want.startsWith("=") ? ["", want.slice(1)] : [want, ""], [got.error, got.body], name);
  }
});

const SECRETS = ["Authorization: Bearer s3cret", "Cookie: sid=1", "X-Api-Key: k", "Accept: text/plain", "content-type: a/b", "NoColon"];

Deno.test("machin/http: redirects send the same requests in both", async () => {
  const replies = new Map<string, Reply>();
  const cases: Case[] = [];
  const add = (name: string, status: number, location: string, more: Partial<Case> = {}) => {
    replies.set(`/dir/sub/${name}`, { send: to(status, location) });
    cases.push({ name, url: `{A}/dir/sub/${name}?q=1`, headers: SECRETS, ...more });
  };
  for (const [i, location] of ["/abs", "next", "./next", "../up", "../../../top", "?again=2", "#frag", "{A}/same", "{B}/other", "{S}/secure",
    "//127.0.0.1:{PORT}/network", "HTTP://127.0.0.1:{PORT}/upper", "/with space", "/é"].entries()) add(`to${i}`, 302, location);
  for (const status of [301, 302, 303, 307, 308]) {
    add(`post${status}`, status, "{B}/after", { method: "POST", body: "pay=load é" });
    add(`head${status}`, status, "/after", { method: "HEAD" });
  }
  replies.set("/down", { send: to(307, "{A}/after") });
  replies.set("/down-get", { send: to(302, "{A}/after") });
  cases.push({ name: "https to http with a body", method: "POST", url: "{S}/down", body: "secret", headers: SECRETS });
  cases.push({ name: "https to http without one", url: "{S}/down-get", headers: SECRETS });
  const r = await compare(cases, replies);
  const kept = r.results[cases.length - 2];
  assertEquals([kept.status, kept.error], [307, ""]);
  //why: the point of the rule: nothing secret reaches another origin.
  assert(r.seen.some((s) => s.startsWith("B GET /other")));
  for (const s of r.seen.filter((s) => s.startsWith("B "))) assert(!/s3cret|sid=1|X-Api-Key/.test(s), s);
});

for (const limit of ["0", "2", "junk"]) {
  Deno.test(`machin/http: MFL_HTTP_MAX_REDIRECTS=${limit} behaves the same in both`, async () => {
    await compare([{ name: "loop", url: "{A}/loop" }], new Map([["/loop", { send: to(302, "/loop") }]]), { MFL_HTTP_MAX_REDIRECTS: limit });
  });
}

Deno.test("machin/http: requests, and calls refused before sending, are the same in both", async () => {
  const cases: Case[] = [
    { name: "plain", url: "{A}/x" }, { name: "query without slash", url: "{A}?q=1" }, { name: "bare origin", url: "{A}" },
    { name: "fragment", url: "{A}/x#top" }, { name: "dot segments kept", url: "{A}/a/../b/%2e./c" },
    { name: "odd characters kept", url: "{A}/a b?c=<\"{}|^`\\>&d='é" }, { name: "scheme in capitals", url: "HTTP://127.0.0.1:{PORT}/x" },
    { name: "body", method: "POST", url: "{A}/x", body: "a=é&b=\r\nline" }, { name: "empty body", method: "POST", url: "{A}/x" },
    { name: "other method", method: "PROPFIND", url: "{A}/x" }, { name: "lower method", method: "get", url: "{A}/x" },
    { name: "get with body", url: "{A}/x", body: "b" }, { name: "delete", method: "DELETE", url: "{A}/x" },
    { name: "repeated and unicode headers", url: "{A}/x", headers: ["X-A: 1", "X-A: 2", "X-B: é☃", "Host: other", "User-Agent: mine"] },
    ...["", "GE T", "GET\r\n", "G/T"].map((method) => ({ name: `bad method ${JSON.stringify(method)}`, method, url: "{A}/x" })),
    ...["X: a\r\nY: b", "X: a\nb", "X: \r"].map((h) => ({ name: `bad header ${JSON.stringify(h)}`, url: "{A}/x", headers: [h] })),
    { name: "bad header and bad method", method: "G T", url: "ftp://x", headers: ["a\nb"] },
    ...["", "{A}/a\r\nb", "{A}/a\tb", "{A}/\x7f", "ftp://127.0.0.1/", "ws://127.0.0.1/", "http://", "http://:80/", "http://u:p@127.0.0.1/",
      "http://127.0.0.1 /", "http://127.0.0.1:0/", "http://127.0.0.1:65536/", "http://127.0.0.1:8a/", "http://[::1/", "http://[::1]x/",
      `http://${"a".repeat(256)}/`].map((url) => ({ name: `bad url ${JSON.stringify(url.slice(0, 40))}`, url })),
    { name: "refused connection", url: "http://127.0.0.1:1/" }, { name: "unknown host", url: "http://no-such-host.invalid/" },
    { name: "tls", url: "{S}/x", headers: SECRETS }, { name: "no scheme means https", url: "127.0.0.1:1/x" },
    { name: "tls to a plain server", url: "https://127.0.0.1:1/" },
  ];
  const r = await compare(cases, new Map());
  assertEquals(r.results.find((_, i) => cases[i].name === "tls")?.body, "ok");
});

Deno.test("machin/http: an untrusted certificate is refused in both", async () => {
  const r = await compare([{ name: "untrusted", url: "{S}/x" }], new Map(), {}, false);
  assertEquals(r.results[0].error, "tls");
  assertEquals(r.seen.filter((s) => s.includes("GET")), []);
});

Deno.test("machin/http: a reply that isn't UTF-8 stops under Deno instead of changing the text", async () => {
  const dir = await Deno.makeTempDir();
  await program(dir);
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const raw = new Uint8Array([...bytes(`${"HTTP/1.1 200 OK"}\r\nContent-Length: 3\r\n\r\n`), 120, 255, 121]);
  const stop = serve(listener, "A", new Map([["/x", { send: raw }]]), (s) => s);
  await Deno.writeTextFile(`${dir}/cases.txt`, `GET\thttp%3A%2F%2F127.0.0.1%3A${(listener.addr as Deno.NetAddr).port}%2Fx\t\t\n`);
  const r = await run(dir, false, {});
  await stop();
  assert(r.code !== 0 && r.err.includes("not valid UTF-8"), r.out + r.err);
});

//why: hand-picked replies only cover what was thought of; broken copies of good ones cover more.
Deno.test("machin/http: damaged replies give the same result in both", async () => {
  let seed = Number(Deno.env.get("HTTP_FUZZ_SEED") ?? 7);
  const random = (n: number) => (seed = (seed * 48271) % 2147483647) % n;
  const good = [`${ok}Content-Length: 5\r\n\r\nhello`, `${ok}Transfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n3\r\nabc\r\n0\r\n\r\n`,
    `HTTP/1.1 100 Continue\r\n\r\n${ok}\r\nbody`, to(302, "../a/b?c#d")];
  const pieces = ["\r\n", "\n", "\r", " ", ":", "0", "9", "a", "f", "-", "+", "/", ".", "?", "#", "\0", "HTTP/", "chunked", "Content-Length: ", "Location: ", "http://", "//", "[", "]", "@"];
  const replies = new Map<string, Reply>();
  const cases: Case[] = [];
  for (let i = 0; i < 400; i++) {
    let s = good[random(good.length)];
    for (let edits = 1 + random(3); edits > 0; edits--) {
      const at = random(s.length + 1), kind = random(4);
      s = kind === 0 ? s.slice(0, at) : kind === 1 ? s.slice(0, at) + s.slice(at + 1 + random(6)) : s.slice(0, at) + pieces[random(pieces.length)] + s.slice(at + (kind === 3 ? 1 : 0));
    }
    replies.set(`/f${i}`, { send: s });
    //why: a damaged Location can name a real host; MAX_REDIRECTS=0 below keeps the run on this machine.
    cases.push({ name: JSON.stringify(s), url: `{A}/f${i}` });
  }
  await compare(cases, replies, { MFL_HTTP_MAX_REDIRECTS: "0" });
});

Deno.test("machin/http: the stand-in stops where JavaScript can't match the native bytes", async () => {
  const { http_call } = await import(`${root}shim/http.js`);
  for (const bad of [["GET", "http://127.0.0.1:1/\0", [], ""], ["POST", "http://127.0.0.1:1/", [], "\ud800"], ["GET", "http://127.0.0.1:1/", ["X: \0"], ""]] as const) {
    let message = "";
    try { http_call(bad[0], bad[1], [...bad[2]], bad[3]); } catch (e) { message = (e as Error).message; }
    assert(message.includes("natively"), message);
  }
});
