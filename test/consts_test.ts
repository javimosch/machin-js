// Top-level constants, .join, .includes and multi-line typedefs: same as Deno, or refused.
import { assertEquals } from "jsr:@std/assert@1";
import { buildGraph } from "../transpile/transpile.ts";

const root = new URL("../", import.meta.url).pathname;
const fn = (head: string, body: string, tags = "") => `/**\n * f\n${tags} */\nfunction ${head} {\n  //why: t.\n  ${body}\n}\n`;
const pub = (text: string) => text.replace("\nfunction ", "\nexport function ");
const main = (body: string) => pub(fn("main()", body));

/** Build the files (m.js is the entry); with no `want`, also run both ways and compare. */
async function check(files: Record<string, string>, want?: string[]) {
  const d = await Deno.makeTempDir();
  for (const [name, text] of Object.entries(files)) await Deno.writeTextFile(`${d}/${name}`, text);
  const built = await buildGraph(`${d}/m.js`);
  assertEquals([...new Set(built.diags.map((x) => x.code))], want ?? [], JSON.stringify(built.diags));
  if (want) return;
  const bridged = await Promise.all(built.native.map((f) => Deno.readTextFile(f)));
  await Deno.writeTextFile(`${d}/m.src`, [...bridged, ...built.order.map((o) => o.out)].join("\n"));
  await Deno.writeTextFile(`${d}/run.mjs`, 'import { main } from "./m.js";\nmain();\n');
  await Deno.writeTextFile(`${d}/map.json`, JSON.stringify({ imports: { machin: `${root}shim/machin.js`, "machin/crypto": `${root}shim/crypto.js`, "machin/web": `${root}shim/web.js` } }));
  const run = async (cmd: string, args: string[]) => {
    const r = await new Deno.Command(cmd, { args, cwd: d }).output();
    return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
  };
  const enc = await run("machin", ["encode", "m.src"]);
  assertEquals(enc.code, 0, enc.err);
  await Deno.writeTextFile(`${d}/m.mfl`, enc.out);
  const native = await run("machin", ["run", "m.mfl", "--safe"]);
  const js = await run("deno", ["run", "--no-config", "--import-map=map.json", "run.mjs"]);
  assertEquals([js.code, js.out], [native.code, native.out], js.err + native.err);
}

const TOP = 'const LIMIT = 3;\nconst NAME = "linkbox";\nconst ON = true;\nconst LOW = -5;\n/** @type {int} */\nconst BIG = 9007199254740991;\nconst UNUSED = 1;\n';

const SAME: [string, Record<string, string>][] = [
  ["constants of each kind", { "m.js": TOP + main("console.log(`${LIMIT} ${NAME} ${ON} ${LOW} ${BIG}`); if (ON && LOW < LIMIT) { console.log(NAME + \"!\"); }") }],
  ["declared after the function that reads it", { "m.js": main("console.log(LATE);") + 'const LATE = "late";\n' }],
  ["read from an arrow", { "m.js": TOP + fn("apply(f)", "return f(1);", " * @param {(x: int) => int} f\n * @returns {int}\n") + main("console.log(apply((x) => x + LIMIT));") }],
  ["imported from another module", { "m.js": 'import { SIZE, show } from "./b.js";\n' + main("console.log(SIZE); show();"), "b.js": "export const SIZE = 7;\n" + pub(fn("show()", "console.log(SIZE + 1);")) }],
  //why: in another module the same name may be a parameter, a variable or a loop name.
  ["another module's names don't clash with it", { "m.js": 'import { SIZE, use } from "./b.js";\n' + main('console.log(use(2)); console.log(SIZE);'), "b.js": 'import { other } from "./c.js";\nexport const SIZE = 7;\n' + pub(fn("use(n)", "return other(n);", " * @param {int} n\n * @returns {int}\n")), "c.js": pub(fn("other(SIZE)", 'let t = SIZE; for (const x of ["a"]) { console.log(x); } return t;', " * @param {int} SIZE\n * @returns {int}\n")) }],
  ["a loop name equal to another module's constant", { "m.js": 'import { loops } from "./c.js";\nimport { say } from "./b.js";\n' + main("loops(); say();"), "b.js": 'const x = "global x";\nconst i = "global i";\n' + pub(fn("say()", "console.log(x + i);")), "c.js": pub(fn("loops()", 'for (const x of [1, 2]) { console.log(x); } for (let i = 0; i < 2; i++) { console.log(i); }')) }],
  ["a constant named like the emitter's result name", { "m.js": 'const r = "value";\n' + fn("get()", "return r;", " * @returns {string}\n") + main("console.log(get());") }],
  //why: bridge and framework code shares the namespace; its locals must not write to a constant.
  ["constants named like locals inside the bridges", { "m.js": 'import { random_hex, digest_equal } from "machin/crypto";\nimport { ok_text } from "machin/web";\nconst key = "K_key";\nconst e = "K_e";\nconst c = "K_c";\nconst ok = "K_ok";\nconst text = "K_text";\nconst line = "K_line";\nconst part = "K_part";\nconst raw = "K_raw";\nconst conn = "K_conn";\nconst req = "K_req";\nconst res = "K_res";\nconst out = "K_out";\nconst body = "K_body";\nconst msg = "K_msg";\n' + main("const k = random_hex(4); console.log(digest_equal(k, k)); console.log(ok_text(\"hi\").body); console.log([key, e, c, ok, text, line, part, raw, conn, req, res, out, body, msg].join(\",\"));") }],
  ["join text", { "m.js": main('const a = ["a", "", "c"]; console.log(a.join(", ")); console.log(a.join(""));\n  /** @type {string[]} */\n  const e = []; console.log("[" + e.join(",") + "]"); console.log([""].join(",") + "|");') }],
  ["join, then push", { "m.js": main('const a = ["x"]; console.log(a.join("-")); a.push("y"); console.log(a.join("-")); console.log(a.includes("y")); a.push("z"); console.log(a.length);') }],
  ["includes on lists", { "m.js": main('const n = [1, -2, 3]; const s = ["a", "b c"]; const b = [true]; console.log(`${n.includes(-2)} ${n.includes(2)} ${s.includes("a")} ${s.includes("b")} ${b.includes(false)} ${b.includes(true)}`);\n  /** @type {int[]} */\n  const e = []; console.log(e.includes(0));') }],
  ["includes on text", { "m.js": 'const TEXT = "linkbox";\n' + main('console.log(`${TEXT.includes("box")} ${TEXT.includes("")} ${TEXT.includes("Box")} ${"".includes("")} ${"".includes("a")}`);') }],
  ["includes in a condition and on a call", { "m.js": fn("kinds()", 'return ["a", "b"];', " * @returns {string[]}\n") + main('if (kinds().includes("b") && !kinds().includes("c")) { console.log(kinds().join("+")); }') }],
  ["typedef over several lines", { "m.js": 'import { json } from "machin";\n/**\n * A task.\n * @typedef {{\n *   id: int,\n *   title: string,\n *   tags: string[],\n * }} Task\n */\n' + main('/** @type {Task} */\n  const t = { id: 1, title: "x * y: z, w", tags: [] }; console.log(json(t));') }],
];
for (const [name, files] of SAME) Deno.test(`same in both: ${name}`, () => check(files));

const REFUSED: [string, Record<string, string>, ...string[]][] = [
  ["a list constant", { "m.js": "const A = [1];\n" + main("console.log(A.length);") }, "JS-UNSUP001"],
  ["an object constant", { "m.js": "const A = { n: 1 };\n" + main("console.log(1);") }, "JS-UNSUP001"],
  ["a computed constant", { "m.js": "const A = 1 + 1;\n" + main("console.log(A);") }, "JS-UNSUP001"],
  ["a constant from a call", { "m.js": 'import { env } from "machin";\nconst A = env("HOME");\n' + main("console.log(A);") }, "JS-UNSUP001"],
  ["a top-level let", { "m.js": "let a = 1;\n" + main("console.log(a);") }, "JS-UNSUP001", "JS-UNDEF001"],
  ["a decimal constant", { "m.js": "const A = 1.5;\n" + main("console.log(1);") }, "JS-NUM001"],
  ["assigning a constant", { "m.js": "const A = 1;\n" + main("A = 2; console.log(A);") }, "JS-TYPE001"],
  ["a local with a constant's name", { "m.js": "const A = 1;\n" + main("const A = 2; console.log(A);") }, "JS-SCOPE001"],
  ["a parameter with a constant's name", { "m.js": "const A = 1;\n" + fn("f(A)", "console.log(A);", " * @param {int} A\n") + main("f(2);") }, "JS-SCOPE001"],
  ["a constant named like a builtin", { "m.js": "const len = 1;\n" + main("console.log(len);") }, "JS-NAME001"],
  ["a constant named like a machin keyword", { "m.js": "const range = 1;\n" + main("console.log(range);") }, "JS-NAME001"],
  ["the same constant in two modules", { "m.js": 'import { f } from "./b.js";\nconst A = 1;\n' + main("f(); console.log(A);"), "b.js": "const A = 2;\n" + pub(fn("f()", "console.log(A);")) }, "JS-DUP001"],
  ["a constant and a function of one name", { "m.js": 'import { f } from "./b.js";\nconst twice = 1;\n' + main("f(); console.log(twice);"), "b.js": pub(fn("f()", "twice();")) + fn("twice()", "console.log(2);") }, "JS-DUP001"],
  ["join of numbers", { "m.js": main('console.log([1, 2].join(","));') }, "JS-UNSUP001"],
  ["join on a list of unknown type", { "m.js": main('const e = []; console.log(e.join(","));') }, "JS-ARR001", "JS-ANY001"],
  ["join without a separator", { "m.js": main('const a = ["a"]; console.log(a.join());') }, "JS-UNSUP001"],
  ["includes with a start position", { "m.js": main('console.log("abc".includes("a", 1));') }, "JS-UNSUP001"],
  ["includes on a list of objects", { "m.js": "/** @typedef {{n: int}} T */\n" + main('/** @type {T} */\n  const t = { n: 1 }; const a = [t]; console.log(a.includes(t));') }, "JS-UNSUP001"],
  ["includes on a list of lists", { "m.js": main("const a = [[1]]; console.log(a.includes(a[0]));") }, "JS-UNSUP001"],
  ["includes of the wrong type", { "m.js": main('const a = [1]; console.log(a.includes("1"));') }, "JS-TYPE001"],
  ["a variable hiding the join builtin", { "m.js": main('const join = "x"; console.log(["a"].join(join));') }, "JS-NAME001"],
];
for (const [name, files, ...codes] of REFUSED) Deno.test(`refused: ${name} -> ${codes[0]}`, () => check(files, codes));
