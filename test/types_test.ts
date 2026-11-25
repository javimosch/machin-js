// The typings must be valid and complete, and type errors must stop a build.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { program, typeErrors } from "../transpile/typecheck.ts";
import { buildGraph } from "../transpile/transpile.ts";

const root = new URL("../", import.meta.url).pathname;

Deno.test("every file in types/ is valid TypeScript", () => {
  const files = ["machin.d.ts", "machweb.d.ts", "desktop.d.ts"].map((f) => `${root}types/${f}`);
  assertEquals(typeErrors(program(files)), []);
});

Deno.test("machin.d.ts exports every builtin and types none of them as any-by-default", async () => {
  const names: string[] = JSON.parse(await Deno.readTextFile(`${root}types/machin-builtins.json`));
  const dts = await Deno.readTextFile(`${root}types/machin.d.ts`);
  for (const n of names) assert(new RegExp(`export function ${n}\\b|as ${n} \\}`).test(dts), `missing ${n}`);
  assert(!/\): any;/.test(dts), "a builtin returns any, which silently turns checking off");
});

for (const entry of ["main", "server", "desktop"]) {
  Deno.test(`todo example type-checks: ${entry}.js`, async () => {
    assertEquals((await buildGraph(`${root}examples/todo/src/${entry}.js`)).diags, []);
  });
}

const doc = (tags: string, body: string) => `/**\n * t\n${tags} */\nexport function f(${tags.includes("@param") ? "a" : ""}) {\n  //why: t.\n${body}\n}\n`;
const MISTAKES: [string, string, number][] = [
  ["wrong argument", 'import { sqlite_open } from "machin";\n' + doc("", "  return sqlite_open(42);"), 7],
  ["wrong return", doc(" * @returns {int}\n", '  return "x";'), 7],
  ["misspelled field", '/** @typedef {{title: string}} T */\n' + doc(" * @param {T} a\n", "  return a.titel;"), 8],
  ["untyped parameter", doc("", "  return 1;").replace("f()", "f(b)"), 4],
  ["field of a parsed row", 'import { parse } from "machin";\n/** @typedef {{id: int}} T */\n/**\n * g\n * @returns {T[]}\n */\nfunction g() {\n  //why: t.\n  return parse("[]", []);\n}\n' + doc("", "  return g()[0].nope;"), 16],
];
for (const [name, source, line] of MISTAKES) {
  Deno.test(`build stops with JS-TYPE001: ${name}`, async () => {
    const d = await Deno.makeTempDir();
    await Deno.writeTextFile(`${d}/m.js`, source);
    const { diags } = await buildGraph(`${d}/m.js`);
    assertEquals(diags.map((x) => [x.code, x.line]), [["JS-TYPE001", line]], JSON.stringify(diags));
  });
}
