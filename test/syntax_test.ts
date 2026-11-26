// Syntax audit: every JavaScript construct must either behave natively as under Deno, or be refused
// with a JS- diagnostic. A crash, a raw machin error or a different result is a bug.
//why: the allow-list is only as good as the syntax someone remembered to try. This is the list.
import { assertEquals } from "jsr:@std/assert@1";
import EXPECTED from "./syntax_expected.json" with { type: "json" };
import { buildGraph } from "../transpile/transpile.ts";

const root = new URL("../", import.meta.url).pathname;

/** [name, body of main(), top-level text added after main, text added before it] */
export type Snippet = [string, string, string?, string?];
const fn = (head: string, body: string, doc = "p") => `/** ${doc} */\nfunction ${head} {\n  //why: p.\n  ${body}\n}\n`;
const MAP = "/** @type {Map<string, int>} */\n  const m = new Map(); ";
const ONE = fn("one()", "return 1;");

export const SNIPPETS: Snippet[] = [
  // statements
  ["empty statement", ';;; console.log("a");'],
  ["debugger", "debugger; console.log(1);"],
  ["bare block", "{ const a = 1; console.log(a); } console.log(2);"],
  ["bare block shadowing", "const a = 1; { const a = 2; console.log(a); } console.log(a);"],
  ["if without braces", "const a = 1; if (a == 1) console.log(a); else console.log(2);"],
  ["else if chain", 'const a = v(3); if (a == 1) { console.log(1); } else if (a == 2) { console.log(2); } else if (a == 3) { console.log(3); } else { console.log(4); }', fn("v(n)", "return n;", "@param {int} n")],
  ["dangling else", "const a = v(1); const b = v(2); if (a == 1) if (b == 3) console.log(1); else console.log(2); console.log(3);", fn("v(n)", "return n;", "@param {int} n")],
  ["while without braces", "let i = 0; while (i < 3) i++; console.log(i);"],
  ["do while", "let i = 0; do { i++; } while (i < 3); console.log(i);"],
  ["switch", "const a = 1; switch (a) { case 1: console.log(1); break; default: console.log(2); }"],
  ["try", 'try { console.log(1); } catch (e) { console.log(2); }'],
  ["throw", 'if (1 == 2) { throw new Error("x"); } console.log(1);'],
  ["labelled", "outer: for (let i = 0; i < 2; i++) { break outer; } console.log(1);"],
  ["continue in while", "let i = 0; while (i < 3) { i++; if (i == 2) { continue; } console.log(i); }"],
  ["continue in for", "for (let i = 0; i < 3; i++) { if (i == 1) { continue; } console.log(i); }"],
  ["for in", "const a = [1]; for (const k in a) { console.log(k); }"],
  ["for without init", "let i = 0; for (; i < 2; i++) { console.log(i); }"],
  ["for with two declarators", "for (let i = 0, j = 5; i < 2; i++) { console.log(i + j); }"],
  ["for with comma update", "let j = 0; for (let i = 0; i < 2; i++, j++) { console.log(i + j); }"],
  ["for with outer counter", "let i = 9; for (i = 0; i < 2; i++) { console.log(i); } console.log(i);"],
  ["loop body changes counter", "for (let i = 0; i < 6; i++) { if (i == 1) { i += 3; } console.log(i); }"],
  ["loop bound changes", "let n = 3; for (let i = 0; i < n; i++) { if (n < 5) { n++; } console.log(i); }"],
  ["break in for", "for (let i = 0; i < 5; i++) { if (i == 2) { break; } console.log(i); }"],
  ["nested function declaration", "function g() { return 1; } console.log(g());"],
  ["const reassigned", "const a = 1; a = 2; console.log(a);"],
  ["use before declaration", "console.log(a); const a = 1;"],
  ["self referencing declaration", "const a = a + 1; console.log(a);"],
  ["let type change", 'let a = 1; a = "x"; console.log(a);'],
  ["two declarators", "const a = 1, b = a + 1; console.log(b);"],
  ["early return from main", "console.log(1); if (1 == 1) { return; } console.log(2);"],
  // expressions
  ["sequence expression", "const a = (1, 2); console.log(a);"],
  ["chained assignment", "let a = 0; let b = 0; a = b = 2; console.log(a + b);"],
  ["assignment as value", "let a = 0; console.log(a = 5);"],
  ["increment as value", "let a = 0; console.log(a++); console.log(++a);"],
  ["increment in index", "let i = 0; const a = [1, 2]; console.log(a[i++]);"],
  ["prefix increment statement", "let a = 0; ++a; --a; ++a; console.log(a);"],
  ["ternary as argument", "const a = 1; console.log(a == 1 ? 2 : 3);"],
  ["ternary returned", "console.log(f(1));", fn("f(a)", "return a == 1 ? 2 : 3;", "@param {int} a")],
  ["ternary assigned later", "let b = 0; b = b == 0 ? 2 : 3; console.log(b);"],
  ["ternary self reference", "let b = 5; { const c = b > 1 ? b + 1 : b; console.log(c); }"],
  ["nested ternary", "const a = 2; const b = a == 1 ? 1 : a == 2 ? 2 : 3; console.log(b);"],
  ["ternary consequent with effect", "const log = [0]; const a = v(1); const t = a == 2 ? bump(log) : 7; console.log(t + log[0]); const u = a == 1 ? bump(log) : 7; console.log(u + log[0]);", fn("bump(xs)", "xs[0] += 1; return 1;", "@param {int[]} xs") + fn("v(n)", "return n;", "@param {int} n")],
  ["and or on numbers", "const a = 0 || 5; console.log(a);"],
  ["and or on strings", 'const a = "" || "d"; console.log(a);'],
  ["not on number", "console.log(!5);"],
  ["number as condition", "const a = 5; if (a) { console.log(1); }"],
  ["string as condition", 'const s = "x"; if (s) { console.log(1); }'],
  ["short circuit with effects", "const log = [0]; const a = v(1); console.log(a == 2 && yes(log)); console.log(a == 1 || yes(log)); console.log(log[0]); console.log(a == 1 && yes(log)); console.log(log[0]);", fn("yes(xs)", "xs[0] += 1; return true;", "@param {int[]} xs") + fn("v(n)", "return n;", "@param {int} n")],
  ["short circuit guards an index", "const a = [1]; const i = 5; if (i < a.length && a[i] == 1) { console.log(1); } console.log(2);"],
  ["short circuit guards a division", "const z = 0; if (z != 0 && Math.trunc(10 / z) > 1) { console.log(1); } console.log(2);"],
  ["while condition re-evaluated with guard", "const a = [1, 2]; let i = 0; while (i < a.length && a[i] < 5) { i++; } console.log(i);"],
  ["exponent operator", "console.log(2 ** 3);"],
  ["bit operators", "console.log(5 & 3); console.log(5 | 3); console.log(5 ^ 3); console.log(1 << 3); console.log(~5);"],
  ["unsigned shift", "console.log((0 - 1) >>> 0);"],
  ["logical assignment", "let a = 0; a ||= 3; console.log(a);"],
  ["unary plus", 'console.log(+"3");'],
  ["double negation", "const a = 3; console.log(- -a); console.log(-(-a)); console.log(!!(a > 1));"],
  ["minus negative", "const a = 3; console.log(a - -2); console.log(a - -a);"],
  ["void", "console.log(void 0);"],
  ["delete", "const a = [1, 2]; delete a[0]; console.log(a.length);"],
  ["in operator", "const a = [1]; console.log(0 in a);"],
  ["instanceof", "const a = [1]; console.log(a instanceof Array);"],
  ["optional chain", "const a = [1]; console.log(a?.length);"],
  ["optional call", "console.log(one?.());", ONE],
  ["spread in array", "const a = [1]; const b = [...a, 2]; console.log(b.length);"],
  ["spread in call", "const a = [1]; console.log(...a);"],
  ["object spread", "/** @type {T} */\n  const a = { n: 1 };\n  /** @type {T} */\n  const b = { ...a }; console.log(b.n);", "/** @typedef {{n: int}} T */"],
  ["computed key", '/** @type {T} */\n  const a = { ["n"]: 1 }; console.log(a.n);', "/** @typedef {{n: int}} T */"],
  ["quoted key", '/** @type {T} */\n  const a = { "n": 1 }; console.log(a.n);', "/** @typedef {{n: int}} T */"],
  ["proto key", "/** @type {T} */\n  const a = { __proto__: 1 }; console.log(a.__proto__);", "/** @typedef {{__proto__: int}} T */"],
  ["duplicate key", "/** @type {T} */\n  const a = { n: 1, n: 2 }; console.log(a.n);", "/** @typedef {{n: int}} T */"],
  ["object keys out of order with effects", "const log = [0]; const t = pair(log); console.log(`${t.a} ${t.b}`);", "/** @typedef {{a: int, b: int}} P */\n" + fn("next(xs)", "xs[0] += 1; return xs[0];", "@param {int[]} xs") + fn("pair(xs)", "return { b: next(xs), a: next(xs) };", "@param {int[]} xs\n * @returns {P}")],
  ["field named like a keyword", "/** @type {T} */\n  const a = { type: 1, map: 2, func: 3, range: 4, int: 5 }; console.log(a.type + a.map + a.func + a.range + a.int);", "/** @typedef {{type: int, map: int, func: int, range: int, int: int}} T */"],
  ["getter", "const a = { get n() { return 1; } }; console.log(a.n);"],
  ["method in object", "const a = { n() { return 1; } }; console.log(a.n());"],
  ["assign to length", "const a = [1, 2]; a.length = 0; console.log(a.length);"],
  ["array method map", "const a = [1].map((x) => x); console.log(a.length);"],
  ["array method indexOf", "console.log([1].indexOf(1));"],
  ["string method", 'console.log("a".toUpperCase());'],
  ["string char method", 'console.log("a".charAt(0));'],
  ["number method", "const a = 5; console.log(a.toString());"],
  ["Math.max", "console.log(Math.max(1, 2));"],
  ["Math.PI", "console.log(Math.PI);"],
  ["JSON.parse", 'console.log(JSON.parse("1"));'],
  ["JSON.stringify", "console.log(JSON.stringify([1]));"],
  ["Number()", 'console.log(Number("3"));'],
  ["Boolean()", 'console.log(Boolean(""));'],
  ["String() no args", "console.log(String());"],
  ["String() two args", "console.log(String(1, 2));"],
  ["console.log no args", "console.log();"],
  ["console.error", 'console.error("x");'],
  ["console shadowed", "const console = 1; process(console);", fn("process(a)", "return;", "@param {int} a")],
  ["Math shadowed", "const Math = [4]; console.log(Math.trunc(9 / 2));"],
  ["String shadowed", "const g = String; console.log(g(1));"],
  ["undefined", "console.log(undefined);"],
  ["NaN", "console.log(NaN);"],
  ["Infinity", "console.log(Infinity);"],
  ["globalThis", "console.log(globalThis);"],
  ["arguments object", "console.log(f(1));", fn("f(a)", "return arguments.length;", "@param {int} a")],
  ["this", "console.log(this);"],
  ["new array", "const a = new Array(3); console.log(a.length);"],
  ["function expression", "const g = function () { return 1; }; console.log(g());"],
  ["class expression", "const C = class {}; console.log(1);"],
  ["block arrow", "const g = () => { return 1; }; console.log(g());"],
  ["arrow returning object", "/** @type {() => T} */\n  const g = () => ({ n: 1 }); console.log(g().n);", "/** @typedef {{n: int}} T */"],
  ["immediately invoked arrow", "console.log((() => 1)());"],
  ["curried arrow", "/** @type {(a: int) => (b: int) => int} */\n  const add = (a) => (b) => a + b; console.log(add(1)(2));"],
  ["arrow with destructuring", "const g = ([a]) => a; console.log(g([1]));"],
  ["arrow as value in list", "const a = [() => 1]; console.log(a[0]());"],
  ["call of list element", "const a = [one]; console.log(a[0]());", ONE],
  ["call result called", "console.log(pick()());", ONE + fn("pick()", "return one;")],
  ["method style call of field", "/** @type {T} */\n  const t = { f: one }; console.log(t.f());", "/** @typedef {{f: () => number}} T */\n" + ONE],
  ["await", "await 1; console.log(1);"],
  ["yield outside", "const yield = 1; console.log(yield);"],
  ["dynamic import", 'const a = import("./x.js"); console.log(1);'],
  ["import meta", "console.log(import.meta.url);"],
  ["new target", "console.log(new.target);"],
  ["regex literal", 'console.log("a".match(/a/));'],
  ["bigint", "console.log(1n);"],
  ["numeric separator", "console.log(1_000);"],
  ["hex octal binary", "console.log(0xff); console.log(0o17); console.log(0b11);"],
  ["legacy leading zero", "console.log(010);"],
  ["exponent literal", "console.log(1e3);"],
  ["integer written as decimal", "console.log(2.0);"],
  ["negative zero literal", "const a = -0; console.log(String(a));"],
  ["big safe literal", "console.log(9007199254740991 - 1);"],
  ["single quotes and escapes", "console.log('it\\'s \"q\" \\\\ ok');"],
  ["unicode escape", 'console.log("\\u0041\\x42");'],
  ["escape control", 'console.log("a\\rb\\0c\\bd\\fe\\vf");'],
  ["line continuation", 'console.log("a\\\nb");'],
  ["multi line template", "console.log(`a\n  b`);"],
  ["template escapes", "console.log(`\\` \\${x} \\\\ \"`);"],
  ["template with CR", "console.log(`a\\r`);"],
  ["empty interpolations", 'const e = ""; console.log(`${e}${e}`);'],
  ["comparison chains", "console.log((1 < 2) == (2 < 3)); console.log(1 + 2 * 3 - 4 % 3);"],
  ["string comparison ordering", 'console.log("abc" < "abd"); console.log("Z" < "a"); console.log("a" < "aa"); console.log("10" < "9");'],
  ["mixed equality", 'console.log(1 == "1");'],
  ["boolean literals", "console.log(true); console.log(false, !true, true && false); const a = [true]; a[0] = false; console.log(String(a[0]), true == (v(1) == 1));", fn("v(n)", "return n;", "@param {int} n")],
  ["boolean literal arguments and returns", "console.log(f(true)); console.log(f(false));", fn("f(a)", "if (a) { return 1; } return 0;", "@param {boolean} a")],
  ["while true with break", "let i = 0; while (true) { i++; if (i == 3) { break; } } console.log(i);"],
  ["boolean equality", "const a = true; console.log(a == false); console.log(a != false);"],
  ["boolean ordering", "console.log(true < false);"],
  ["boolean arithmetic", "console.log(true + 1);"],
  ["printing booleans in templates", "console.log(`${1 == 1} ${String(1 != 1)}`);"],
  ["map in condition", MAP + "if (m) { console.log(1); }"],
  ["map spread", MAP + "console.log([...m].length);"],
  ["map forEach", MAP + "m.forEach((v) => v);"],
  ["map get on rhs of or", MAP + 'console.log(m.get("a") || 1);'],
  ["Set", "const s = new Set(); console.log(s.size);"],
  // nested lists
  ["nested list literal", "const g = [[1], [2, 3]]; console.log(g[1][1]);"],
  ["nested list store", "const g = [[1]]; g[0][0] = 5; g[0][0] += 2; console.log(g[0][0]);"],
  ["nested list of mixed depth", "const g = [[1], 2]; console.log(g.length);"],
  ["ragged and empty rows", "/** @type {int[][]} */\n  const g = [[], [1]]; console.log(g[0].length + g[1].length);"],
  ["push onto a stored row", "const g = [[1]]; g[0].push(2); console.log(g[0].length);"],
  // identifiers that might mean something to machin or C
  ["underscore name", "const _ = 5; console.log(_);"],
  ["two underscores", "const __x = 5; console.log(__x);"],
  ["dollar name", "const $a = 5; console.log($a);"],
  ["unicode name", "const é = 5; console.log(é);"],
  ["C keyword names", "const int = 1; const char = 2; const auto = 4; const register = 5; const double = 6; const sizeof = 7; const signed = 8; const unix = 9; const NULL = 10; console.log(int + char + auto + register + double + sizeof + signed + unix + NULL);"],
  ["C library names", "const errno = 1; const stdin = 2; const stdout = 3; const EOF = 4; const true_ = 5; console.log(errno + stdin + stdout + EOF + true_);"],
  ["function with C library name", "console.log(printf(1) + malloc(2) + strlen(3) + exit_(4));", fn("printf(a)", "return a;", "@param {int} a") + fn("malloc(a)", "return a;", "@param {int} a") + fn("strlen(a)", "return a;", "@param {int} a") + fn("exit_(a)", "return a;", "@param {int} a")],
  ["mfl prefix names", "const mfl_cat = 1; const mfl_x = 2; console.log(mfl_cat + mfl_x);"],
  ["main as variable", "const main_ = 1; console.log(main_);"],
  ["result-like names", "console.log(f(1, 2));", fn("f(r, r_)", "return r + r_;", "@param {int} r\n * @param {int} r_")],
  ["parameter same as function", "console.log(f(3));", fn("f(f2)", "return f2;", "@param {int} f2")],
  ["typedef named like builtin", "/** @type {len} */\n  const a = { n: 1 }; console.log(a.n);", "/** @typedef {{n: int}} len */"],
  ["recursion", "console.log(fact(5));", fn("fact(n)", "if (n < 2) { return 1; } return n * fact(n - 1);", "@param {int} n\n * @returns {int}")],
  ["mutual recursion", "console.log(even(10));", fn("even(n)", "if (n == 0) { return true; } return odd(n - 1);", "@param {int} n\n * @returns {boolean}") + fn("odd(n)", "if (n == 0) { return false; } return even(n - 1);", "@param {int} n\n * @returns {boolean}")],
  ["void result used", "console.log(nothing());", fn("nothing()", "return;")],
  ["extra argument", "console.log(one(5));", ONE],
  ["missing argument", "console.log(f());", fn("f(a)", "return 1;", "@param {int} [a]")],
  ["parameter reassigned", "const a = 1; console.log(f(a) + a);", fn("f(x)", "x = x + 1; return x;", "@param {int} x")],
  ["parameter list shared", "const a = [1]; set(a); console.log(a[0]);", fn("set(x)", "x[0] = 9;", "@param {int[]} x")],
  ["parameter list rebound", "const a = [1]; rebind(a); console.log(a[0]);", fn("rebind(x)", 'x = [2]; x[0] = 3;', "@param {int[]} x")],
  ["struct returned and read", "console.log(mk().n);", "/** @typedef {{n: int}} T */\n" + fn("mk()", "return { n: 4 };", "@returns {T}")],
  ["unused variable", "const unused = 1; console.log(2);"],
  ["unused parameter", "console.log(f(1, 2));", fn("f(a, b)", "return a;", "@param {int} a\n * @param {int} b")],
  ["unused function", "console.log(1);", fn("never(a)", "return a;", "@param {int} a")],
  ["generic helper used at two types", 'console.log(id(1)); console.log(id("x"));', fn("id(a)", "return a;", "@template T\n * @param {T} a\n * @returns {T}")],
  // top level and modules
  ["top level const", "console.log(K);", "const K = 1;"],
  ["top level expression", "console.log(1);", 'console.log("top");'],
  ["export const", "console.log(1);", "export const K = 1;"],
  ["export default", "console.log(1);", "export default 5;"],
  ["export list", "console.log(1);", ONE + "export { one };"],
  ["export star", "console.log(1);", 'export * from "./x.js";'],
  ["side effect import", "console.log(1);", "", 'import "./missing.js";\n'],
  ["use strict directive", "console.log(1);", "", '"use strict";\n'],
  ["class declaration", "console.log(1);", "class C {}"],
  ["top level var", "console.log(1);", "var K = 1;"],
  ["syntax error", "const = 1;"],
];

/** Run a command, returning exit code and output. */
async function run(cmd: string, args: string[]) {
  const r = await new Deno.Command(cmd, { args }).output();
  return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
}

/** "" if the snippet is handled soundly, otherwise what went wrong. */
export async function audit([, body, after = "", before = ""]: Snippet): Promise<{ problem: string; outcome: string }> {
  const d = await Deno.makeTempDir();
  const source = `${before}/** p */\nexport function main() {\n  //why: p.\n  ${body}\n}\n${after}`;
  await Deno.writeTextFile(`${d}/m.js`, source);
  let built;
  try {
    built = await buildGraph(`${d}/m.js`);
  } catch (e) {
    return { problem: `transpiler threw: ${(e as Error).message.slice(0, 200)}`, outcome: "refused" };
  }
  if (built.diags.length) {
    const bad = built.diags.filter((x) => !x.code.startsWith("JS-") || x.code === "JS-INTERNAL001");
    const codes = [...new Set(built.diags.map((x) => x.code))].sort().join(" ");
    return { problem: bad.length ? `internal: ${bad[0].msg}` : "", outcome: codes };
  }
  const sources = [...await Promise.all(built.native.map((f) => Deno.readTextFile(f))), ...built.order.map((o) => o.out)];
  await Deno.writeTextFile(`${d}/m.src`, sources.join("\n"));
  const enc = await run("machin", ["encode", `${d}/m.src`]);
  if (enc.code !== 0) return { problem: `accepted, but machin rejects it: ${enc.err.trim().slice(0, 160)}`, outcome: "same" };
  await Deno.writeTextFile(`${d}/m.mfl`, enc.out);
  await Deno.writeTextFile(`${d}/run.mjs`, 'import { main } from "./m.js";\nmain();\n');
  const js = await run("deno", ["run", "--no-config", `${d}/run.mjs`]);
  const native = await run("machin", ["run", `${d}/m.mfl`, "--safe"]);
  await Deno.remove(d, { recursive: true });
  if (js.code !== native.code || js.out !== native.out) {
    return { problem: `differs: deno=${JSON.stringify(js.out.slice(0, 80))} (exit ${js.code}) native=${JSON.stringify(native.out.slice(0, 80))} (exit ${native.code}) ${native.err.trim().slice(0, 120)}`, outcome: "same" };
  }
  return { problem: "", outcome: "same" };
}

/** The specification: what each construct does. Changing it changes the language. */
const spec: Record<string, string> = EXPECTED;

Deno.test("the specification and the audit list the same constructs", () => {
  assertEquals(Object.keys(spec).sort(), SNIPPETS.map((s) => s[0]).sort());
});

for (const snippet of SNIPPETS) {
  Deno.test(`syntax: ${snippet[0]}`, async () => {
    const r = await audit(snippet);
    assertEquals(r.problem, "");
    //why: not just "something sound happened" — a construct must not move between running and
    //     being refused (or change its code) without this file changing too.
    assertEquals(r.outcome, spec[snippet[0]]);
  });
}

if (import.meta.main) {
  //   deno run -A test/syntax_test.ts           report problems and differences from the spec
  //   deno run -A test/syntax_test.ts --write   rewrite the spec (then REVIEW the diff)
  const got: Record<string, string> = {};
  let problems = 0;
  for (let i = 0; i < SNIPPETS.length; i += 6) {
    const batch = SNIPPETS.slice(i, i + 6);
    const results = await Promise.all(batch.map(audit));
    results.forEach((r, j) => {
      const name = batch[j][0];
      got[name] = r.outcome;
      if (r.problem) {
        problems++;
        console.log(`✗ ${name}: ${r.problem}`);
      } else if (spec[name] !== r.outcome) console.log(`~ ${name}: spec ${spec[name]} now ${r.outcome}`);
    });
  }
  if (Deno.args.includes("--write") && !problems) {
    await Deno.writeTextFile(new URL("./syntax_expected.json", import.meta.url), JSON.stringify(got, null, 1) + "\n");
  }
  const same = Object.values(got).filter((x) => x === "same").length;
  console.log(`${SNIPPETS.length} constructs: ${same} behave the same, ${SNIPPETS.length - same - problems} refused, ${problems} problems`);
  Deno.exit(problems ? 1 : 0);
}

Deno.test("docs/specification.md is up to date (deno run -A tools/gen-spec.ts)", async () => {
  const { page } = await import("../tools/gen-spec.ts");
  assertEquals(await Deno.readTextFile(`${root}docs/specification.md`), page());
});
