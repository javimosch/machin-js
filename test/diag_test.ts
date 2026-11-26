import { transpile } from "../transpile/transpile.ts";
import { assertEquals } from "jsr:@std/assert@1";

const codes = (src: string) => transpile("t.js", src).diags.map((d) => d.code).sort();

Deno.test("missing JSDoc and why are reported", () => {
  assertEquals(codes("function f(a) { return a; }"), ["JS-DOC001", "JS-WHY001"]);
});
Deno.test("compliant function is clean", () => {
  assertEquals(codes("/** x @returns {int} */\nfunction f(a) {\n  //why: test\n  return a;\n}"), []);
});
Deno.test("oversize function is reported", () => {
  const body = Array.from({ length: 22 }, () => "  g();").join("\n");
  assertEquals(codes(`import { g } from "machin";\n/** x */\nfunction f() {\n  //why: t\n${body}\n}`), ["JS-SIZE001"]);
});
Deno.test("unsupported syntax is reported, not silently emitted", () => {
  assertEquals(codes("/** x */\nfunction f(a) {\n  //why: t\n  return a ?? 1;\n}"), ["JS-UNSUP001"]);
});
Deno.test("passing a builtin as a value is reported with a hint; your own functions are fine", () => {
  const head = 'import { parse_int } from "machin";\nimport { serve } from "machin/web";\n/** x */\nfunction g(a) {\n  //why: t\n  return a;\n}\n/** x */\nfunction f() {\n  //why: t\n';
  assertEquals(codes(`${head}  serve(1, parse_int);\n}`), ["JS-FNVAL001"]);
  assertEquals(codes(`${head}  serve(1, g);\n}`), []);
});
Deno.test("an undeclared, unimported name is reported", () => {
  assertEquals(codes("/** x */\nfunction f() {\n  //why: t\n  return sqlite_open(1);\n}"), ["JS-UNDEF001"]);
});
Deno.test("imports are validated: unknown builtin, unknown module, missing export, duplicate fn", async () => {
  const { buildGraph } = await import("../transpile/transpile.ts");
  const d = await Deno.makeTempDir();
  const w = (n: string, s: string) => Deno.writeTextFile(`${d}/${n}`, s);
  const fn = (name: string) => `/** x */\nexport function ${name}() {\n  //why: t\n  return 1;\n}\n`;
  await w("a.js", fn("dup"));
  await w("b.js", `import { nope } from "machin";\nimport { zzz } from "./a.js";\nimport { q } from "other";\n${fn("dup")}`);
  const r = await buildGraph(`${d}/b.js`);
  assertEquals(r.diags.map((x) => x.code).sort(), ["JS-DUP001", "JS-IMPORT001", "JS-IMPORT001", "JS-IMPORT002"]);
});
Deno.test("a function or type that clashes with a bridge's own source is reported at its line", async () => {
  const { buildGraph } = await import("../transpile/transpile.ts");
  const d = await Deno.makeTempDir();
  await Deno.writeTextFile(`${d}/m.js`, `import { serve, ok_text } from "machin/web";
/** @typedef {{n: int}} Response */
/**
 * h
 * @param {string} s
 */
function route(s) {
  //why: t.
  return ok_text(s);
}
/** m */
export function main() {
  //why: t.
  serve(1, (r) => route(r.path));
}
`);
  const { diags } = await buildGraph(`${d}/m.js`);
  assertEquals(diags.map((x) => [x.code, x.msg.split(" ")[0]]).sort(), [["JS-NAME001", "Response"], ["JS-NAME001", "route"]]);
});
Deno.test("a typedef spread over several lines gets one clear message", () => {
  const src = "/**\n * @typedef {{\n *   a: int,\n *   b: string\n * }} T\n */\n";
  const found = transpile("t.js", src).diags;
  assertEquals(found.map((d) => [d.code, d.msg]), [["JS-UNSUP001", "write @typedef {{...}} T on one line"]]);
});
