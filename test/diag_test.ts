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
