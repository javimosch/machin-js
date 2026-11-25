// Parity: each program must either behave natively exactly as under Deno, or be rejected with
// the expected JS- code. Add a case here for every divergence found, before fixing it.
//why: this is the exit test of roadmap Phase 0 — "no known silent differences".
import { assertEquals } from "jsr:@std/assert@1";
import { transpile } from "../transpile/transpile.ts";
import { program, typeErrors } from "../transpile/typecheck.ts";

type Case = { name: string; body: string; extra?: string; expect: "same" | string };
const fn = (name: string, body: string, doc = "p") => `/** ${doc} */\nfunction ${name} {\n  //why: p.\n  ${body}\n}\n`;

const CASES: Case[] = [
  { name: "integer division", body: "console.log(7 / 2);", expect: "JS-NUM002" },
  { name: "float literal", body: "console.log(0.1 + 0.2);", expect: "JS-NUM001" },
  { name: "unsafe integer", body: "console.log(9007199254740993);", expect: "JS-NUM001" },
  { name: "non-ASCII string", body: 'const s = "héllo"; console.log(s.length);', expect: "JS-STR001" },
  { name: "tab and newline", body: 'console.log("a\\tb\\nc".length);', expect: "same" },
  { name: "typeof", body: "const a = 1; console.log(typeof a);", expect: "JS-UNSUP001" },
  { name: "null", body: "const a = null; console.log(a);", expect: "JS-UNSUP001" },
  { name: "number array", body: "const a = [1, 2]; console.log(a.length);", expect: "JS-UNSUP001" },
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
  { name: "ternary", body: 'const a = 1; const m = a == 1 ? "y" : "n"; console.log(m);', expect: "same" },
];

/** Run a command, returning exit code and stdout. */
async function run(cmd: string, args: string[]) {
  const r = await new Deno.Command(cmd, { args }).output();
  return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
}

for (const k of CASES) {
  Deno.test(`parity: ${k.name} -> ${k.expect}`, async () => {
    const src = `/** p */\nexport function main() {\n  //why: p.\n  ${k.body}\n}\n${k.extra ?? ""}`;
    const m = transpile("m.js", src);
    if (k.expect !== "same") {
      assertEquals([...new Set(m.diags.map((d) => d.code))], [k.expect]);
      return;
    }
    assertEquals(m.diags, []);
    const d = await Deno.makeTempDir();
    await Deno.writeTextFile(`${d}/m.js`, src);
    await Deno.writeTextFile(`${d}/run.mjs`, 'import { main } from "./m.js";\nmain();\n');
    //why: the checker must not reject a program that behaves correctly.
    assertEquals(typeErrors(program([`${d}/m.js`])), []);
    await Deno.writeTextFile(`${d}/m.src`, m.out);
    const js = await run("deno", ["run", `${d}/run.mjs`]);
    const enc = await run("machin", ["encode", `${d}/m.src`]);
    assertEquals(enc.code, 0, enc.err);
    await Deno.writeTextFile(`${d}/m.mfl`, enc.out);
    const native = await run("machin", ["run", `${d}/m.mfl`, "--safe"]);
    assertEquals([native.code, native.out], [js.code, js.out], native.err);
  });
}
