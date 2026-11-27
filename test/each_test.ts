// .map(f) and .filter(f): the same results natively and under Deno, or a JS- diagnostic.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildGraph } from "../transpile/transpile.ts";

const root = new URL("../", import.meta.url).pathname;
const TYPES = `/** @typedef {{name: string, n: int, tags: string[]}} P */
/**
 * @param {int} x
 * @returns {int}
 */
function twice(x) {
  //why: t.
  return x * 2;
}
/**
 * @param {int} a
 * @param {int} b
 * @returns {int}
 */
function pair(a, b) {
  //why: t.
  return a + b;
}
/**
 * Raise the last element, to see whether a later step notices.
 * @param {int[]} xs
 * @returns {int}
 */
function bump(xs) {
  //why: t.
  if (xs[2] < 30) {
    xs[2] = 30;
  }
  return xs[0] * 10 - xs[0] + 1;
}
`;

async function write(body: string) {
  const d = await Deno.makeTempDir();
  await Deno.writeTextFile(`${d}/m.js`, `${TYPES}/** m */\nexport function main() {\n  //why: t.\n  ${body}\n}\n`);
  return { d, built: await buildGraph(`${d}/m.js`) };
}

async function both(body: string) {
  const { d, built } = await write(body);
  assertEquals(built.diags, []);
  await Deno.writeTextFile(`${d}/m.src`, built.order.map((o) => o.out).join("\n"));
  await Deno.writeTextFile(`${d}/run.mjs`, 'import { main } from "./m.js";\nmain();\n');
  const run = async (cmd: string, args: string[]) => {
    const r = await new Deno.Command(cmd, { args, cwd: d }).output();
    return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
  };
  const enc = await run("machin", ["encode", "m.src"]);
  assertEquals(enc.code, 0, enc.err);
  await Deno.writeTextFile(`${d}/m.mfl`, enc.out);
  const native = await run("machin", ["run", "m.mfl", "--safe"]);
  const deno = await run("deno", ["run", "-A", "--no-config", `--import-map=${root}deno.json`, "run.mjs"]);
  assertEquals([deno.code, deno.out], [native.code, native.out], deno.err + native.err);
  return native.out;
}

const SAME: [string, string, string][] = [
  ["numbers to text, and chained", 'const a = [1, 2, 3, 4]; console.log(a.filter((x) => x % 2 == 0).map((x) => `<${x}>`).join(","));', "<2>,<4>\n"],
  ["your own function", 'const a = [1, 2]; const b = a.map(twice); console.log(`${b[0]} ${b[1]} ${a[0]} ${b.length}`);', "2 4 1 2\n"],
  ["empty list", 'const a = [""].filter((s) => s != ""); const b = a.map((s) => s + "!"); console.log(`${a.length} ${b.length} [${b.join(",")}]`);', "0 0 []\n"],
  ["nothing kept", 'const b = [1].filter((x) => x > 9); console.log(b.length); console.log(b.includes(1));', "0\nfalse\n"],
  ["objects", '/** @type {P[]} */\n  const ps = [{ name: "a", n: 1, tags: [] }, { name: "b", n: 2, tags: ["t"] }];\n  console.log(ps.filter((p) => p.n > 1).map((p) => p.name).join(""));\n  console.log(ps.map((p) => p.n * 10).includes(20));', "b\ntrue\n"],
  ["making objects", '/** @type {P[]} */\n  const ps = ["x", "y"].map((s) => ({ name: s, n: 1, tags: [s] }));\n  console.log(`${ps[1].name} ${ps[1].tags[0]} ${ps.length}`);', "y y 2\n"],
  ["lists inside are shared, as in JavaScript", 'const rows = [[1], [2]]; const kept = rows.filter((r) => r.length > 0); kept[0][0] = 7; console.log(rows[0][0]);', "7\n"],
  ["the result is a new list", 'const a = [1, 2]; const b = a.filter((x) => x > 0); b[0] = 9; console.log(`${a[0]} ${b[0]}`);', "1 9\n"],
  ["inside a loop", 'for (let i = 0; i < 3; i++) { console.log([1, 2].map(twice)[1] + i); }', "4\n5\n6\n"],
  ["a pushed list can be mapped, then pushed again", '/** @type {int[]} */\n  const a = []; a.push(1); const b = a.map(twice); a.push(2); console.log(`${a.length} ${b.length}`);', "2 1\n"],
  ["one program, several types", 'const n = [1, 2].map((x) => x * 3); const s = n.map((x) => String(x)); const b = s.map((x) => x == "3"); const l = b.map((x) => [x]);\n  console.log(`${n[1]} ${s[0]} ${b[0]} ${b[1]} ${l[0][0]} ${l.length}`);', "6 3 true false true 2\n"],
  ["nested arrows", 'const k = 10; console.log([1, 2].map((x) => [3, 4].map((y) => x * y + k)[1]).map((v) => String(v)).join(" "));', "14 18\n"],
  ["a callback that changes what comes next", '/** @type {int[]} */\n  const a = [1, 2, 3]; const b = a.map((x) => bump(a) + x); console.log(`${b[0]} ${b[1]} ${b[2]} ${a[0]} ${a[2]}`);', "11 12 40 1 30\n"],
  ["an index inside the arrow", 'const a = [5, 6]; console.log([1, 0].map((i) => a[i])[0]);', "6\n"],
];

for (const [name, body, want] of SAME) {

  Deno.test(`map and filter: ${name}`, async () => assertEquals(await both(body), want));
}

const REFUSED: [string, string, string][] = [
  ["a parameter hiding a local", 'const x = "s"; console.log(`${[1].map((x) => x + 1)[0]}${x}`);', "JS-SCOPE001"],
  ["the position", 'console.log([1].map((x, i) => x + i).length);', "JS-UNSUP001"],
  ["no parameter", 'console.log([1].map(() => 0).length);', "JS-UNSUP001"],
  ["a function with two parameters", 'console.log([1].map(pair).length);', "JS-UNSUP001"],
  ["a second argument", 'console.log([1].map(twice, 0).length);', "JS-UNSUP001"],
  ["filter by truthiness", 'console.log([1].filter((x) => x).length);', "JS-COND001"],
  ["a builtin as the function", 'console.log(["1"].map(parseInt).length);', ""],
  ["push to a result", 'const b = [1].map(twice); b.push(1); console.log(b.length);', "JS-PUSH001"],
  ["push after the callback captured the list", '/** @type {int[]} */\n  const a = []; const b = [1].map((x) => a.length + x); a.push(1); console.log(b.length);', "JS-PUSH001"],
  ["a block arrow", 'console.log([1].map((x) => { return x; }).length);', "JS-UNSUP001"],
  ["forEach", '[1].forEach((x) => twice(x));', "JS-UNSUP001"],
];

for (const [name, body, code] of REFUSED) {
  Deno.test(`map and filter refuse ${name}`, async () => {
    const { built } = await write(body);
    const codes = built.diags.map((x) => x.code);
    assert(code ? codes.includes(code) : codes.length > 0, JSON.stringify(built.diags));
  });
}

Deno.test("map and filter: callbacks from your other modules and from a bridge", async () => {
  const d = await Deno.makeTempDir();
  await Deno.writeTextFile(`${d}/words.js`, '/**\n * @param {string} s\n * @returns {string}\n */\nexport function loud(s) {\n  //why: t.\n  return s + "!";\n}\n');
  await Deno.writeTextFile(`${d}/m.js`, 'import { loud } from "./words.js";\nimport { sha256_hex, hmac_sha256_hex } from "machin/crypto";\n\n/** m */\nexport function main() {\n  //why: t.\n  console.log(["a"].map(loud).map(sha256_hex).join(""));\n}\n');
  const built = await buildGraph(`${d}/m.js`);
  assertEquals(built.diags, []);
  const bridged = await Promise.all(built.native.map((f) => Deno.readTextFile(f)));
  await Deno.writeTextFile(`${d}/m.src`, [...bridged, ...built.order.map((o) => o.out)].join("\n"));
  const enc = await new Deno.Command("machin", { args: ["encode", "m.src"], cwd: d }).output();
  assert(enc.success, new TextDecoder().decode(enc.stderr));
  await Deno.writeFile(`${d}/m.mfl`, enc.stdout);
  const native = await new Deno.Command("machin", { args: ["run", "m.mfl", "--safe"], cwd: d }).output();
  await Deno.writeTextFile(`${d}/run.mjs`, 'import { main } from "./m.js";\nmain();\n');
  const deno = await new Deno.Command("deno", { args: ["run", "-A", "--no-config", `--import-map=${root}deno.json`, "run.mjs"], cwd: d }).output();
  assertEquals(new TextDecoder().decode(native.stdout), new TextDecoder().decode(deno.stdout));
  assertEquals(new TextDecoder().decode(native.stdout).trim().length, 64);
});

//why: natively an empty result is an unset list; it must still print and encode like `[]`.
Deno.test("map and filter: empty results inside objects and lists, with join, includes and json", async () => {
  const d = await Deno.makeTempDir();
  await Deno.writeTextFile(`${d}/m.js`, 'import { json } from "machin";\n\n/** @typedef {{tags: string[], rows: int[][]}} B */\n\n/**\n * @param {string[]} words\n * @returns {B}\n */\nfunction box(words) {\n  //why: t.\n  return { tags: words.filter((w) => w == "zz"), rows: words.filter((w) => w == "zz").map((w) => [1]) };\n}\n\n/** m */\nexport function main() {\n  //why: t.\n  const none = [box(["a"])].filter((b) => b.tags.length > 0);\n  console.log(`${json(box(["a"]))} ${json(none)} ${json([box([])].map((b) => b.tags))} ${box([]).tags.includes("a")} [${box([]).tags.join("-")}]`);\n}\n');
  const built = await buildGraph(`${d}/m.js`);
  assertEquals(built.diags, []);
  await Deno.writeTextFile(`${d}/m.src`, built.order.map((o) => o.out).join("\n"));
  const enc = await new Deno.Command("machin", { args: ["encode", "m.src"], cwd: d }).output();
  assert(enc.success, new TextDecoder().decode(enc.stderr));
  await Deno.writeFile(`${d}/m.mfl`, enc.stdout);
  const native = await new Deno.Command("machin", { args: ["run", "m.mfl", "--safe"], cwd: d }).output();
  await Deno.writeTextFile(`${d}/run.mjs`, 'import { main } from "./m.js";\nmain();\n');
  const deno = await new Deno.Command("deno", { args: ["run", "-A", "--no-config", `--import-map=${root}deno.json`, "run.mjs"], cwd: d }).output();
  const out = new TextDecoder().decode(native.stdout);
  assertEquals(new TextDecoder().decode(deno.stdout), out);
  assertEquals(out, '{"tags":[],"rows":[]} [] [[]] false []\n');
});
