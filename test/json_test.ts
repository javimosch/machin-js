// json_valid and "machin/json" must agree between Deno and native on hand-picked and random text.
import { assertEquals } from "jsr:@std/assert@1";
import { buildGraph } from "../transpile/transpile.ts";

const root = new URL("../", import.meta.url).pathname;
const KEYS = ["a", "b", "c"];

/** Seeded generator. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (n: number) => Math.floor(next() * n), pick: <T>(xs: T[]) => xs[Math.floor(next() * xs.length)] };
}

const SCALARS = ['"x"', '""', '"a\\"b"', '"\\\\"', '"\\u00e9"', '"\\ud83d\\ude00"', '"\\udc00x"', '"a\\ud800"', '"\\n\\t\\/\\b\\f"', '"}],:{"', '"é ☃"', '"x\\u0000y"', '"\\u0061"',
  "0", "7", "-12", "-0", "1.5", "1e3", "2E-2", "123456789012345", "1234567890123456", "99999999999999999999", "true", "false", "null", "01", "+1", "NaN", "'x'", "tru", '"\\q"', '"\t"'];

/** Random JSON-like text: mostly valid, with duplicate and escaped keys; sometimes damaged. */
function document(seed: number): string {
  const r = rng(seed);
  const space = () => r.pick(["", "", "", " ", "\n", "\t "]);
  const value = (d: number): string => {
    if (d > 0 && r.int(4) === 0) return r.int(2) ? object(d - 1) : `[${Array.from({ length: r.int(3) }, () => value(d - 1)).join(",")}]`;
    return r.int(25) === 0 ? r.pick(SCALARS) : r.pick(SCALARS.slice(0, 26));
  };
  const key = () => (r.int(12) === 0 ? "\\u0061" : r.pick([...KEYS, ...KEYS, "A", "", "a.b", 'q\\"a', "ab"]));
  const object = (d: number): string => `{${Array.from({ length: r.int(4) }, () => `${space()}"${key()}"${space()}:${space()}${value(d)}${space()}`).join(",")}}`;
  let text = space() + (r.int(8) === 0 ? value(2) : object(2)) + space();
  if (r.int(5) === 0) {
    const at = r.int(text.length + 1);
    text = r.pick([text.slice(0, at), text.slice(0, at) + r.pick([",", "}", "]", "{", '"', "x", ":", "\\"]) + text.slice(at), text + r.pick(["x", "{}", ",", "1"])]);
  }
  //why: a lone surrogate can't travel through percent-encoding.
  return text.toWellFormed();
}

const HAND = ["", " ", "{}", "[]", "null", '{"a":1,"a":"two"}', '{"\\u0061":1}', '{"x":{"a":1},"a":2}', '{"x":"\\",\\"a\\":9","a":3}', '{"a":1', '{"a":1}x', '{"a":01}',
  '{"a":"\\ud800"}', '{"a":1e999}', '{"a":"x\\u0000y"}', `${"[".repeat(512)}${"]".repeat(512)}`, `${"[".repeat(513)}${"]".repeat(513)}`, `{"a":${"[".repeat(511)}${"]".repeat(511)}}`, `{"a":${"[".repeat(512)}${"]".repeat(512)}}`, '{"a":"[[[["}'];

const PROGRAM = (docs: string[]) => `import { url_decode, json_valid } from "machin";
import { json_has, json_is_string, json_string, json_is_int, json_int, json_is_bool, json_bool } from "machin/json";

/**
 * Print everything the accessors say about one field.
 * @param {string} d
 * @param {string} k
 */
function field(d, k) {
  //why: t.
  console.log(\`\${k} h=\${json_has(d, k)} s=\${json_is_string(d, k)} [\${json_string(d, k)}] i=\${json_is_int(d, k)} \${json_int(d, k)} b=\${json_is_bool(d, k)} \${json_bool(d, k)}\`);
}

/** m */
export function main() {
  //why: t.
  let n = 0;
  for (const encoded of [${docs.map((d) => `"${encodeURIComponent(d)}"`).join(", ")}]) {
    const d = url_decode(encoded);
    console.log(\`doc \${n} valid=\${json_valid(d)}\`);
    for (const k of ["a", "b", "c", "A", "", "a.b"]) {
      field(d, k);
    }
    n++;
  }
}
`;

/** Run a command, returning exit code and output. */
async function run(cmd: string, args: string[]) {
  const r = await new Deno.Command(cmd, { args }).output();
  return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
}

/** Compare both runtimes on a batch of documents; names the first document that differs. */
export async function compare(docs: string[]) {
  const d = await Deno.makeTempDir();
  await Deno.writeTextFile(`${d}/m.js`, PROGRAM(docs));
  const built = await buildGraph(`${d}/m.js`);
  assertEquals(built.diags, []);
  const sources = [...await Promise.all(built.native.map((f) => Deno.readTextFile(f))), ...built.order.map((o) => o.out)];
  await Deno.writeTextFile(`${d}/m.src`, sources.join("\n"));
  await Deno.writeTextFile(`${d}/run.mjs`, 'import { main } from "./m.js";\nmain();\n');
  await Deno.writeTextFile(`${d}/map.json`, JSON.stringify({ imports: { machin: `${root}shim/machin.js`, "machin/json": `${root}shim/json.js` } }));
  const js = await run("deno", ["run", "-A", "--no-config", `--import-map=${d}/map.json`, `${d}/run.mjs`]);
  assertEquals(js.code, 0, js.err);
  const enc = await run("machin", ["encode", `${d}/m.src`]);
  assertEquals(enc.code, 0, enc.err);
  await Deno.writeTextFile(`${d}/m.mfl`, enc.out);
  const native = await run("machin", ["run", `${d}/m.mfl`, "--safe"]);
  assertEquals(native.code, 0, native.err);
  await Deno.remove(d, { recursive: true });
  const chunks = (s: string) => s.split(/^(?=doc \d+ valid=)/m);
  const a = chunks(js.out), b = chunks(native.out);
  const at = a.findIndex((x, i) => x !== b[i]);
  assertEquals(a[at], b[at], at < 0 ? "" : `document ${at}: ${JSON.stringify(docs[at])}`);
  assertEquals(a.length, docs.length);
  return (native.out.match(/valid=true/g) ?? []).length;
}

Deno.test("machin/json: hand-picked documents agree", async () => {
  await compare(HAND);
});

for (const first of [1, 1000]) {
  Deno.test(`machin/json: 400 random documents agree (seeds from ${first})`, async () => {
    const valid = await compare(Array.from({ length: 400 }, (_, i) => document(first + i)));
    //why: the test is only meaningful if it exercises both outcomes.
    if (valid < 100 || valid > 390) throw new Error(`unbalanced generator: ${valid} of 400 valid`);
  });
}

if (import.meta.main) {
  const batches = Number(Deno.args[0] ?? 10), start = Number(Deno.args[1] ?? 5000);
  let valid = 0;
  for (let b = 0; b < batches; b++) valid += await compare(Array.from({ length: 400 }, (_, i) => document(start + b * 400 + i)));
  console.log(`${batches * 400} random documents agree (${valid} valid)`);
}
