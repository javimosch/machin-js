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
  assertEquals(codes(`/** x */\nfunction f() {\n  //why: t\n${body}\n}`), ["JS-SIZE001"]);
});
Deno.test("unsupported syntax is reported, not silently emitted", () => {
  assertEquals(codes("/** x */\nfunction f(a) {\n  //why: t\n  return a ?? 1;\n}"), ["JS-UNSUP001"]);
});
Deno.test("passing a bare function name is reported with a hint", () => {
  const src = "/** x */\nfunction g(a) {\n  //why: t\n  return a;\n}\n/** x */\nfunction f() {\n  //why: t\n  serve(1, g);\n}";
  assertEquals(codes(src), ["JS-FNVAL001"]);
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
