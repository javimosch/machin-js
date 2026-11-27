// What a client receives in the response head: the native server and the Deno stand-in must agree.
//why: text from a request can reach a header (redirect(query(req, "next"))), so both must refuse
//     a value that would add a line to the head.
import { assertEquals } from "jsr:@std/assert@1";

const root = new URL("../", import.meta.url).pathname;
const PROGRAM = `import { serve, response, redirect, query } from "machin/web";

/** @param {import("machin/web").Request} req */
function reply(req) {
  //why: each head value comes from the request.
  const what = query(req, "what");
  const v = query(req, "v");
  if (what === "location") return redirect(v);
  if (what === "type") return response("200 OK", v, "body");
  if (what === "status") return response(v, "text/plain", "body");
  return response("200 OK", "text/plain", "up");
}

/** m */
export function main() {
  //why: t.
  serve(PORT, (req) => reply(req));
}
`;

function freePort(): number {
  const l = Deno.listen({ port: 0 });
  const { port } = l.addr as Deno.NetAddr;
  l.close();
  return port;
}

/** The status, the headers the program controls, any extra header named planted, and the body. */
async function ask(port: number, target: string) {
  const conn = await Deno.connect({ hostname: "127.0.0.1", port });
  await conn.write(new TextEncoder().encode(`GET ${target} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`));
  const bytes: number[] = [];
  const buf = new Uint8Array(4096);
  let want = -1;
  while (want < 0 || bytes.length < want) {
    const n = await conn.read(buf);
    if (n === null) break;
    bytes.push(...buf.subarray(0, n));
    //why: latin1 keeps one character per byte, so lengths and raw bytes survive.
    const so = String.fromCharCode(...bytes);
    const end = so.indexOf("\r\n\r\n");
    const length = /\r\ncontent-length: *(\d+)/i.exec(so)?.[1];
    if (end >= 0 && length !== undefined) want = end + 4 + Number(length);
  }
  conn.close();
  const all = String.fromCharCode(...bytes);
  const end = all.indexOf("\r\n\r\n");
  const [status, ...lines] = all.slice(0, end).split("\r\n");
  const headers = Object.fromEntries(lines.map((l) => [l.slice(0, l.indexOf(":")).toLowerCase(), l.slice(l.indexOf(":") + 1).trim()]));
  return { code: status.split(" ")[1], type: headers["content-type"] ?? null, location: headers["location"] ?? null, planted: headers["planted"] ?? null, body: all.slice(end + 4) };
}

async function start(cmd: string, args: string[], cwd: string, port: number) {
  const child = new Deno.Command(cmd, { args, cwd, stdout: "null", stderr: "piped" }).spawn();
  const err = new Response(child.stderr).text();
  for (let i = 0; i < 100; i++) {
    try {
      await ask(port, "/");
      return { child, err };
    } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  child.kill();
  throw new Error(`no server: ${await err}`);
}

const enc = encodeURIComponent;
const BREAKS = ["\r\nplanted: 1", "\nplanted: 1", "\rplanted: 1", "\r\n\r\nplanted"];
const CASES: [string, string][] = [
  ...["location", "type", "status"].flatMap((what) => BREAKS.map((b): [string, string] => [what, (what === "status" ? "200 OK" : "text/x") + b])),
  ["location", "/ok?a=1&b=%20"],
  ["location", "/café/€"],
  ["location", "  /spaced  "],
  ["location", "/tab\there"],
  ["location", "/nul\0cut"],
  ["type", "text/plain; note=é"],
  ...["\x01", "\x0b", "\x0c", "\x1b", "\x7f"].map((c): [string, string] => ["location", `/a${c}b`]),
  ["location", ""],
];

Deno.test("response head values: native and the Deno stand-in agree", async () => {
  const d = await Deno.makeTempDir();
  const ports = [freePort(), freePort()];
  for (const [i, port] of ports.entries()) await Deno.writeTextFile(`${d}/m${i}.js`, PROGRAM.replace("PORT", String(port)));
  const built = await new Deno.Command("deno", { args: ["run", "-A", `${root}cli/machin-js.ts`, "build", `${d}/m0.js`, "-o", `${d}/app`] }).output();
  assertEquals(built.code, 0, new TextDecoder().decode(built.stderr));
  await Deno.writeTextFile(`${d}/run.mjs`, 'import { main } from "./m1.js";\nmain();\n');
  await Deno.writeTextFile(`${d}/map.json`, JSON.stringify({ imports: { "machin/web": `${root}shim/web.js` } }));
  const native = await start(`${d}/app`, [], d, ports[0]);
  const deno = await start("deno", ["run", "-A", "--no-config", "--import-map=map.json", "run.mjs"], d, ports[1]);
  const failures: unknown[] = [];
  try {
    for (const [what, v] of CASES) {
      const target = `/?what=${what}&v=${enc(v)}`;
      const [a, b] = [await ask(ports[0], target), await ask(ports[1], target)];
      if (JSON.stringify(a) !== JSON.stringify(b)) failures.push({ what, v, native: a, deno: b });
      assertEquals(a.planted, null, `native let a line through: ${what}`);
      assertEquals(b.planted, null, `the stand-in let a line through: ${what}`);
    }
  } finally {
    for (const s of [native, deno]) s.child.kill();
  }
  assertEquals(failures, []);
  const refused = (log: string) => log.split("\n").filter((l) => l.startsWith("machweb: response refused: "));
  const logs = await Promise.all([native, deno].map(async (s) => refused(await s.err)));
  assertEquals(logs[1], logs[0]);
  assertEquals(logs[0].length, 3 * BREAKS.length);
});
