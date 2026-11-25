// Parity: each program must either behave natively exactly as under Deno, or be rejected with
// the expected JS- code. Add a case here for every divergence found, before fixing it.
//why: this is the exit test of roadmap Phase 0 — "no known silent differences".
import { assertEquals } from "jsr:@std/assert@1";
import { buildGraph } from "../transpile/transpile.ts";

type Case = { name: string; body: string; extra?: string; imports?: string; expect: "same" | string };
const fn = (name: string, body: string, doc = "p") => `/** ${doc} */\nfunction ${name} {\n  //why: p.\n  ${body}\n}\n`;

const CASES: Case[] = [
  { name: "plain division", body: "console.log(7 / 2);", expect: "JS-NUM002" },
  { name: "truncated division", body: "console.log(Math.trunc(7 / 2)); console.log(Math.trunc((0 - 7) / 2)); console.log(Math.trunc((10 + 5) / (1 + 1)) * 3);", expect: "same" },
  { name: "Math.trunc of something else", body: "console.log(Math.trunc(7));", expect: "JS-UNSUP001" },
  { name: "other Math function", body: "console.log(Math.abs(0 - 7));", expect: "JS-UNSUP001" },
  { name: "string plus number", body: 'console.log("a" + 1);', expect: "JS-ADD001" },
  { name: "number plus-assign onto string", body: 'let s = "a"; s += 1; console.log(s);', expect: "JS-ADD001" },
  { name: "string and number concatenation", body: 'let s = "a"; s += String(1) + "b"; console.log(s + String(2 + 3));', expect: "same" },
  { name: "float literal", body: "console.log(0.1 + 0.2);", expect: "JS-NUM001" },
  { name: "unsafe integer", body: "console.log(9007199254740993);", expect: "JS-NUM001" },
  { name: "non-ASCII string", body: 'const s = "héllo"; console.log(s.length);', expect: "JS-STR001" },
  { name: "tab and newline", body: 'console.log(len("a\\tb\\nc"));', imports: "len", expect: "same" },
  { name: "typeof", body: "const a = 1; console.log(typeof a);", expect: "JS-UNSUP001" },
  { name: "null", body: "const a = null; console.log(a);", expect: "JS-UNSUP001" },
  { name: "number array", body: "const a = [1, 2, 3]; a[1] = a[0] + a[2]; console.log(a[1] + a.length);", expect: "same" },
  { name: "boolean array", body: "const a = [true, false]; console.log(a[0]); console.log(a.length);", expect: "same" },
  { name: "nested array literal", body: 'const a = [["x"], ["y", "z"]]; console.log(a[1][1]);', expect: "JS-ARR001" },
  { name: "empty typed array", body: "/** @type {int[]} */\n  const a = []; console.log(a.length);", expect: "same" },
  { name: "array of structs", body: "const a = [one(), one()]; console.log(a[1].n + a.length);", imports: "parse", extra: "/** @typedef {{n: int, ok: boolean, tags: string[]}} T */\n" + fn("one()", 'return parse("{\\"n\\":1,\\"ok\\":true,\\"tags\\":[]}", []);', "@returns {T}"), expect: "same" },
  { name: "mixed array", body: 'const a = ["x", 1]; console.log(a.length);', expect: "JS-ARR001" },
  { name: "arrays compared", body: "const a = [1]; const b = [1]; console.log(a == b);", expect: "JS-CMP001" },
  { name: "printing an array", body: "const a = [1]; console.log(a);", expect: "JS-VAL001" },
  { name: "string length property", body: 'const s = "abc"; console.log(s.length);', expect: "JS-STR002" },
  { name: "string indexing", body: 'const s = "abc"; console.log(s[1]);', expect: "JS-STR002" },
  { name: "run-time non-ASCII text counts bytes in both", body: 'const s = url_decode("h%C3%A9llo"); console.log(len(s)); console.log(index(s, "llo")); console.log(substr(s, 0, 3)); console.log(substr(s, index(s, "llo"), len(s))); console.log(s);', imports: "len, index, substr, url_decode", expect: "same" },
  { name: "no initial value", body: "let a; a = 1; console.log(a);", expect: "JS-UNSUP001" },
  { name: "var", body: "var a = 1; console.log(a);", expect: "JS-UNSUP001" },
  { name: "destructuring", body: 'const [a] = ["x"]; console.log(a);', expect: "JS-UNSUP001" },
  { name: "shadowing", body: "let x = 1; if (x == 1) { let x = 2; console.log(x); } console.log(x);", expect: "JS-SCOPE001" },
  { name: "use outside block", body: "if (1 == 1) { const y = 1; console.log(y); } console.log(y);", expect: "JS-UNDEF001" },
  { name: "sibling loops reuse i", body: "for (let i = 0; i < 2; i++) { console.log(i); } for (let i = 5; i < 7; i++) { console.log(i); }", expect: "same" },
  { name: "power assign", body: "let a = 2; a **= 3; console.log(a);", expect: "JS-UNSUP001" },
  { name: "compound precedence", body: "let x = 2; x *= 3 + 4; console.log(x); x -= 10 - 3; console.log(x);", expect: "same" },
  { name: "grouping", body: "console.log((2 + 3) * 4 - (10 - (4 - 1))); console.log((1 < 2) == (3 < 4));", expect: "same" },
  { name: "negative modulo", body: "console.log((0 - 7) % 3);", expect: "same" },
  { name: "field mutation", body: "const t = mk(); t.n = 9;", extra: fn("mk()", "return 1;"), expect: "JS-UNSUP001" },
  { name: "missing return", body: "console.log(f(0));", extra: fn("f(a)", "if (a == 1) { return 5; }"), expect: "JS-RET001" },
  { name: "bare return in valued fn", body: "console.log(f(0));", extra: fn("f(a)", "if (a == 1) { return; }\n  return 2;"), expect: "JS-RET001" },
  { name: "both branches return", body: "console.log(f(0));", extra: fn("f(a)", "if (a == 1) { return 5; } else { return 6; }", "@param {int} a"), expect: "same" },
  { name: "async", body: "console.log(f());", extra: `/** p */\nasync function f() {\n  //why: p.\n  return 1;\n}\n`, expect: "JS-UNSUP001" },
  { name: "default parameter", body: "console.log(f());", extra: fn("f(a = 1)", "return a;"), expect: "JS-UNSUP001" },
  { name: "function name as a callback", body: "console.log(apply(double, 4));", extra: fn("apply(f, x)", "return f(x);", "@param {(n: int) => int} f @param {int} x") + fn("double(n)", "return n + n;", "@param {int} n"), expect: "same" },
  { name: "function stored in a const", body: "const g = double; console.log(g(21));", extra: fn("double(n)", "return n + n;", "@param {int} n"), expect: "same" },
  { name: "builtin used as a value", body: "console.log(apply(parse_int));", extra: 'import { parse_int } from "machin";\n' + fn("apply(f)", 'return f("1");'), expect: "JS-FNVAL001" },
  { name: "local named like a visible function", body: "if (1 == 1) { const double = 2; console.log(double); } console.log(double(1));", extra: fn("double(n)", "return n + n;", "@param {int} n"), expect: "JS-SCOPE001" },
  { name: "single struct from parse", body: "const t = one(); console.log(t.n + 1); console.log(t.ok);", imports: "parse", extra: "/** @typedef {{n: int, ok: boolean}} T */\n" + fn("one()", 'return parse("{\\"n\\":1,\\"ok\\":true}", []);', "@returns {T}"), expect: "same" },
  { name: "structs compared", body: "console.log(one() == one());", imports: "parse", extra: "/** @typedef {{n: int}} T */\n" + fn("one()", 'return parse("{}", []);', "@returns {T}"), expect: "JS-CMP001" },
  { name: "adding any", body: "console.log(f(1));", extra: fn("f(a)", "return a + 1;", "@param {any} a"), expect: "JS-ANY001" },
  { name: "type narrowed to never in unreachable code", body: "const a = 27; const p = a > 1; console.log(!p || (p && a == 27 && p == (a == a)));", expect: "same" },
  { name: "unreachable comparison of a narrowed flag", body: "let p = 1 > 0; p = 2 > 1; console.log(!!p || (p && p == (1 > 0)));", expect: "same" },
  { name: "unreachable && expression", body: "const p = 2 > 1; const b = 5; console.log(!(p == p) && (p && p) == (p && b < 9));", expect: "same" },
  { name: "console.log format codes with several arguments", body: 'const s = "100%%"; console.log(s, true);', expect: "JS-LOG001" },
  { name: "console.log literal %s with several arguments", body: 'console.log("sub %s|", "X");', expect: "JS-LOG001" },
  { name: "console.log one argument keeps %", body: 'const s = "100%% %s %d"; console.log(s); console.log("a%%b");', expect: "same" },
  { name: "console.log safe first arguments", body: 'const s = "%s%%"; console.log("label:", s); console.log(5, s); console.log(String(1 > 0), s, s);', expect: "same" },
  { name: "ternary", body: 'const a = 1; const m = a == 1 ? "y" : "n"; console.log(m);', expect: "same" },
];

/** Run a command, returning exit code and stdout. */
async function run(cmd: string, args: string[]) {
  const r = await new Deno.Command(cmd, { args }).output();
  return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
}

const root = new URL("../", import.meta.url).pathname;

for (const k of CASES) {
  Deno.test(`parity: ${k.name} -> ${k.expect}`, async () => {
    const head = k.imports ? `import { ${k.imports} } from "machin";\n` : "";
    const src = `${head}/** p */\nexport function main() {\n  //why: p.\n  ${k.body}\n}\n${k.extra ?? ""}`;
    const d = await Deno.makeTempDir();
    await Deno.writeTextFile(`${d}/m.js`, src);
    //why: a real build, so the type checker sees exactly what a user's build would.
    const built = await buildGraph(`${d}/m.js`);
    if (k.expect !== "same") {
      assertEquals([...new Set(built.diags.map((x) => x.code))], [k.expect], JSON.stringify(built.diags));
      return;
    }
    assertEquals(built.diags, []);
    await Deno.writeTextFile(`${d}/run.mjs`, 'import { main } from "./m.js";\nmain();\n');
    //why: under Deno, "machin" is the shim — the same stand-ins a user debugs with.
    await Deno.writeTextFile(`${d}/map.json`, JSON.stringify({ imports: { machin: `${root}shim/machin.js` } }));
    await Deno.writeTextFile(`${d}/m.src`, built.order[0].out);
    const js = await run("deno", ["run", "--no-config", `--import-map=${d}/map.json`, `${d}/run.mjs`]);
    assertEquals(js.code, 0, js.err);
    const enc = await run("machin", ["encode", `${d}/m.src`]);
    assertEquals(enc.code, 0, enc.err);
    await Deno.writeTextFile(`${d}/m.mfl`, enc.out);
    const native = await run("machin", ["run", `${d}/m.mfl`, "--safe"]);
    assertEquals([native.code, native.out], [js.code, js.out], native.err);
  });
}
