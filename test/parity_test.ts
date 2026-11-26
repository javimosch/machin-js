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
  { name: "arrow captures a for variable", body: "let g = () => 0; for (let i = 0; i < 3; i++) { if (i == 0) { g = () => i; } } console.log(g());", expect: "JS-CLOSURE001" },
  { name: "arrow captures a const made in a loop", body: "let g = () => 0; for (let i = 0; i < 3; i++) { const k = i * 10; if (i == 0) { g = () => k; } } console.log(g());", expect: "JS-CLOSURE001" },
  { name: "arrow captures a name a later block reuses", body: "let g = () => 0; if (1 == 1) { const k = 1; g = () => k; } if (1 == 1) { const k = 2; console.log(k); } console.log(g());", expect: "JS-CLOSURE001" },
  { name: "arrow calls a function made in a loop", body: "let g = () => 0; for (let i = 0; i < 3; i++) { const h = () => 1; g = () => h(); } console.log(g());", expect: "JS-CLOSURE001" },
  { name: "arrow captures a parameter and a later-changed let", body: "let k = 1;\n  /** @type {(x: int) => int} */\n  const g = (x) => x + k; k = 5; console.log(g(1)); console.log(add(2));", extra: fn("add(n)", "const h = () => n + 1; return h();", "@param {int} n"), expect: "same" },
  { name: "push builds a list", body: "/** @type {int[]} */\n  const xs = []; for (let i = 0; i < 5; i++) { xs.push(i * i); } xs[0] = 7; console.log(xs.length + xs[0] + xs[4]); const ys = xs; ys[1] = 100; console.log(xs[1]);", expect: "same" },
  { name: "push then return from inside the loop", body: "console.log(upTo(3).length); console.log(upTo(9)[2]);", extra: fn("upTo(n)", "/** @type {int[]} */\n  const out = []; for (let i = 0; i < n; i++) { out.push(i); if (i == 4) { return out; } } return out;", "@param {int} n"), expect: "same" },
  { name: "push after an alias", body: 'const a = ["x"]; const b = a; a.push("y"); console.log(b.length);', expect: "JS-PUSH001" },
  { name: "push to a parameter", body: "const a = [1]; grow(a); console.log(a.length);", extra: fn("grow(xs)", "xs.push(2);", "@param {int[]} xs"), expect: "JS-PUSH001" },
  { name: "push after passing the list on", body: "const a = [1]; console.log(first(a)); a.push(2); console.log(a.length);", extra: fn("first(xs)", "return xs[0];", "@param {int[]} xs"), expect: "JS-PUSH001" },
  { name: "push in a loop that also shares", body: "const a = [1]; for (let i = 0; i < 3; i++) { a.push(i); console.log(first(a)); }", extra: fn("first(xs)", "return xs[0];", "@param {int[]} xs"), expect: "JS-PUSH001" },
  { name: "push to a reassigned list", body: "let a = [1]; a.push(2); console.log(a.length);", expect: "JS-PUSH001" },
  { name: "push while iterating the same list", body: "const a = [1]; for (const v of a) { if (v < 3) { a.push(v + 1); } } console.log(a.length);", expect: "JS-PUSH001" },
  { name: "push inside an arrow", body: "const a = [1]; const g = () => a.push(2); g(); console.log(a.length);", expect: "JS-UNSUP001" },
  { name: "push result used", body: "const a = [1]; const n = a.push(2); console.log(n);", expect: "JS-UNSUP001" },
  { name: "for of over numbers and strings", body: 'let t = 0; for (const v of [1, 2, 3]) { t += v; } console.log(t); for (const w of split("a,b", ",")) { console.log(w); } for (const w of ["z"]) { console.log(w); }', imports: "split", expect: "same" },
  { name: "for of sees element writes", body: "const a = [1, 2, 3]; for (const v of a) { a[2] = 9; console.log(v); }", expect: "same" },
  { name: "for of over a string", body: 'for (const ch of "abc") { console.log(ch); }', expect: "JS-STR002" },
  { name: "template literal", body: 'const n = 4; const s = "x"; console.log(`n=${n} s=${s} ok=${n > 3} sum=${n + 1}\nline2 ${`in ${n}`}`); console.log(len(`ab${n}`) * 2); console.log(``);', imports: "len", expect: "same" },
  { name: "template of an array", body: "const a = [1]; console.log(`${a}`);", expect: "JS-VAL001" },
  { name: "tagged template", body: "console.log(f`x`);", extra: fn("f(s)", 'return "y";', "@param {TemplateStringsArray} s"), expect: "JS-UNSUP001" },
  { name: "object literal makes a struct", body: 'const name = "bo"; const p = person(name, 3); const all = [p, { name: "al", n: 1, tags: ["a"] }]; console.log(`${all[0].name} ${all[0].n + all[1].n} ${all[1].tags[0]}`);', extra: "/** @typedef {{name: string, n: int, tags: string[]}} P */\n" + fn("person(name, n)", "return { name, n: n, tags: [] };", "@param {string} name @param {int} n @returns {P}"), expect: "same" },
  { name: "object literal without a named type", body: "const p = { a: 1 }; console.log(p.a);", expect: "JS-OBJ001" },
  { name: "sort_by with an arrow", body: 'const a = [3, 1, 2]; const b = sort_by(a, (x, y) => x < y); console.log(`${b[0]}${b[1]}${b[2]} ${a[0]}`);', imports: "sort_by", expect: "same" },
  { name: "function named like a machin builtin", body: 'console.log(trim("x"));', extra: fn("trim(s)", 'return s + "!";', "@param {string} s"), expect: "JS-NAME001" },
  { name: "function named like a machin keyword", body: "console.log(make(1));", extra: fn("make(n)", "return n;", "@param {int} n"), expect: "JS-NAME001" },
  { name: "variable named like a machin keyword", body: "const range = 3; console.log(range);", expect: "JS-NAME001" },
  { name: "variable that would hide an emitted builtin", body: "const str = 3; console.log(`${str}`);", expect: "JS-NAME001" },
  { name: "parameter and local named r in a valued function", body: "console.log(f(4)); console.log(g(2));", extra: fn("f(r)", "return r + 1;", "@param {int} r") + fn("g(a)", 'const r = "s"; return r + String(a);', "@param {int} a"), expect: "same" },
  { name: "list made fresh on each loop pass, kept and shared", body: "/** @type {int[]} */\n  let kept = []; for (let i = 0; i < 4; i++) {\n    /** @type {int[]} */\n    const row = []; for (let j = 0; j <= i; j++) { row.push(i * 10 + j); } if (i == 1) { kept = row; } console.log(first(row) + row.length); } console.log(`${kept.length} ${kept[1]}`);", extra: fn("first(xs)", "return xs[0];", "@param {int[]} xs"), expect: "same" },
  { name: "list from outside the loop shared then pushed on the next pass", body: "const row = [0]; let other = row; for (let i = 0; i < 4; i++) { row.push(i); other = row; } console.log(other.length);", expect: "JS-PUSH001" },
  { name: "parse of text from outside", body: 'console.log(decode(url_decode("%7B%7D")).n);', imports: "parse, url_decode", extra: "/** @typedef {{n: int}} T */\n" + fn("decode(text)", "return parse(text, []);", "@param {string} text @returns {T}"), expect: "JS-JSON001" },
  { name: "parse of a string variable inside a concatenation", body: 'console.log(decode("1").n);', imports: "parse", extra: "/** @typedef {{n: int}} T */\n" + fn("decode(v)", 'return parse("{\\"n\\":" + v + "}", []);', "@param {string} v @returns {T}"), expect: "JS-JSON001" },
  { name: "+= on an index with a side effect", body: "const log = [0]; const a = [10, 20, 30]; a[next(log)] += 5; console.log(a[1] + log[0]);", extra: fn("next(log)", "log[0] += 1; return log[0];", "@param {int[]} log"), expect: "JS-ORDER001" },
  { name: "++ on an index with a side effect", body: "const log = [0]; const a = [10, 20, 30]; a[next(log)]++; console.log(a[1] + log[0]);", extra: fn("next(log)", "log[0] += 1; return log[0];", "@param {int[]} log"), expect: "JS-ORDER001" },
  { name: "+= on a list that comes from a call", body: "const a = [1]; same(a)[0] += 1; console.log(a[0]);", extra: fn("same(xs)", "return xs;", "@param {int[]} xs"), expect: "JS-ORDER001" },
  { name: "+= on an index read from a list", body: "const a = [0, 1]; a[a[0]] += 1; console.log(a[0] + a[1]);", expect: "JS-ORDER001" },
  { name: "store index read before a value that changes it", body: "const a = [5, 6]; a[a[0] - 5] = bump(a) + 7; console.log(`${a[0]} ${a[1]}`);", extra: fn("bump(xs)", "xs[0] = 100; return 0;", "@param {int[]} xs"), expect: "JS-ORDER001" },
  { name: "store with a simple index and a call as value", body: "const a = [5, 6]; const i = 1; a[i + 0] = bump(a) + 7; console.log(`${a[0]} ${a[1]}`);", extra: fn("bump(xs)", "xs[0] = 100; return 0;", "@param {int[]} xs"), expect: "same" },
  { name: "store with a computed index and a plain value", body: "const a = [1, 0]; a[a[0]] = 9; console.log(a[0] + a[1]);", expect: "same" },
  { name: "element add where the value changes the element", body: "const a = [5]; a[0] += bump(a) + 1; const b = [5]; console.log(`${a[0]} ${b[0] + bump(b)} ${b[0]}`);", extra: fn("bump(xs)", "xs[0] = 100; return 0;", "@param {int[]} xs"), expect: "same" },
  { name: "name reserved for generated checks", body: "const js_at = 1; console.log(js_at);", expect: "JS-NAME001" },
  { name: "store whose index call changes what the value reads", body: "const log = [0]; const a = [10, 20, 30]; a[next(log)] = log[0]; console.log(a[1]);", extra: fn("next(log)", "log[0] += 1; return log[0];", "@param {int[]} log"), expect: "JS-ORDER001" },
  { name: "map basics", body: "/** @type {Map<string, int>} */\n  const m = new Map(); m.set(\"a\", 1); m.set(\"b\", 2); m.set(\"a\", 7); console.log(m.get(\"a\") ?? 0); console.log(m.get(\"zz\") ?? 99); console.log(m.has(\"b\")); console.log(m.size); m.delete(\"b\"); m.delete(\"never\"); console.log(m.has(\"b\")); console.log(m.size);", expect: "same" },
  { name: "map is shared by aliases and callees", body: "/** @type {Map<string, int>} */\n  const m = new Map(); const n = m; grow(n, 3000); console.log(m.size); console.log(m.get(\"k2999\") ?? 0);", extra: fn("grow(t, count)", "for (let i = 0; i < count; i++) { t.set(`k${i}`, i); }", "@param {Map<string, int>} t @param {int} count"), expect: "same" },
  { name: "odd map keys", body: "/** @type {Map<string, int>} */\n  const m = new Map(); console.log(m.has(\"__proto__\")); console.log(m.has(\"constructor\")); m.set(\"__proto__\", 1); m.set(\"\", 2); console.log(m.size + (m.get(\"__proto__\") ?? 0) * 10 + (m.get(\"\") ?? 0) * 100);", expect: "same" },
  { name: "maps with int keys and struct, string and bool values", body: "/** @type {Map<int, P>} */\n  const a = new Map(); a.set(0 - 5, { s: \"x\", n: 1 });\n  /** @type {P} */\n  const none = { s: \"-\", n: 0 };\n  /** @type {Map<string, boolean>} */\n  const b = new Map(); b.set(\"t\", true); const p = a.get(0 - 5) ?? none; console.log(`${p.s}${p.n} ${(a.get(9) ?? none).s} ${b.get(\"t\") ?? false} ${b.get(\"f\") ?? false}`);", extra: "/** @typedef {{s: string, n: int}} P */", expect: "same" },
  { name: "map returned from a function", body: "const m = make2(); console.log((m.get(\"z\") ?? \"?\") + String(m.size));", extra: fn("make2()", "/** @type {Map<string, string>} */\n  const r = new Map(); r.set(\"z\", \"ok\"); return r;", ""), expect: "same" },
  { name: "map get without a default", body: "/** @type {Map<string, int>} */\n  const m = new Map(); const v = m.get(\"a\"); console.log(v);", expect: "JS-MAP001" },
  { name: "map default that does something", body: "/** @type {Map<string, int>} */\n  const m = new Map(); const log = [0]; console.log(m.get(\"a\") ?? next(log)); console.log(log[0]);", extra: fn("next(log)", "log[0] += 1; return log[0];", "@param {int[]} log"), expect: "JS-MAP001" },
  { name: "?? on something that isn't a map get", body: "const a = [1]; console.log(a[0] ?? 2);", expect: "JS-UNSUP001" },
  { name: "iterating a map", body: "/** @type {Map<string, int>} */\n  const m = new Map(); for (const e of m) { console.log(1); }", expect: "JS-MAP001" },
  { name: "listing map keys", body: "/** @type {Map<string, int>} */\n  const m = new Map(); for (const k of m.keys()) { console.log(k); }", expect: "JS-MAP001" },
  { name: "chained ??", body: "/** @type {Map<string, int>} */\n  const m = new Map(); console.log(m.get(\"a\") ?? m.get(\"b\") ?? 0);", expect: "JS-UNSUP001" },
  { name: "map without a declared type", body: "const m = new Map(); console.log(m.size);", expect: "JS-MAP001" },
  { name: "map filled at construction", body: "const m = new Map([[\"a\", 1]]); console.log(m.size);", expect: "JS-UNSUP001" },
  { name: "map index syntax", body: "/** @type {Map<string, int>} */\n  const m = new Map(); console.log(m[\"a\"]);", expect: "JS-MAP001" },
  { name: "map set result used", body: "/** @type {Map<string, int>} */\n  const m = new Map(); console.log(m.set(\"a\", 1).size);", expect: "JS-MAP001" },
  { name: "map store: key and value both call", body: "/** @type {Map<string, int>} */\n  const m = new Map(); const log = [0]; m.set(String(next(log)), next(log)); console.log(m.size);", extra: fn("next(log)", "log[0] += 1; return log[0];", "@param {int[]} log"), expect: "JS-ORDER001" },
  { name: "map store: simple key, calling value", body: "/** @type {Map<string, int>} */\n  const m = new Map(); const log = [0]; const key = \"k\"; m.set(key, next(log)); console.log((m.get(key) ?? 0) + log[0]);", extra: fn("next(log)", "log[0] += 1; return log[0];", "@param {int[]} log"), expect: "same" },
  { name: "character-counting padding", body: "const s = url_decode(\"h%C3%A9%E2%98%83%F0%9F%98%80\"); console.log(text_length(s)); console.log(pad_end(s, 6) + \"|\"); console.log(pad_start(s, 6) + \"|\"); console.log(pad_end(\"abc\", 2) + \"|\"); console.log(pad_start(\"\", 3) + \"|\");", imports: "url_decode", extra: 'import { text_length, pad_end, pad_start } from "machin/text";', expect: "same" },
  { name: "counting with computed keys and pure calls", body: "/** @type {Map<string, int>} */\n  const m = new Map(); for (let i = 0; i < 7; i++) { m.set(String(i % 3), (m.get(String(i % 3)) ?? 0) + len(String(i * 100))); } console.log(`${m.get(\"0\") ?? 0} ${m.get(\"1\") ?? 0} ${m.size}`);", imports: "len", expect: "same" },
  { name: "store: pure key call but an effectful value that changes what it reads", body: "/** @type {Map<string, int>} */\n  const m = new Map(); const log = [0]; m.set(String(log[0]), next(log)); console.log(m.has(\"0\"));", extra: fn("next(log)", "log[0] += 1; return log[0];", "@param {int[]} log"), expect: "JS-ORDER001" },
  { name: "store: effectful key through a callback", body: "const log = [0]; const g = next; const a = [1, 2, 3]; a[g(log)] = log[0]; console.log(a[1]);", extra: fn("next(log)", "log[0] += 1; return log[0];", "@param {int[]} log"), expect: "JS-ORDER001" },
  { name: "store: a function of yours that only looks pure", body: "/** @type {Map<string, int>} */\n  const m = new Map(); const log = [0]; m.set(String(next(log)), log[0]); console.log(m.has(\"1\"));", extra: fn("next(log)", "log[0] += 1; return log[0];", "@param {int[]} log"), expect: "JS-ORDER001" },
  { name: "text widths over many non-ASCII strings", body: "for (const e of [\"\", \"a\", \"caf%C3%A9\", \"%E6%97%A5%E6%9C%AC%E8%AA%9E\", \"%F0%9F%98%80%F0%9F%98%80\", \"%C3%A9%CC%82\", \"a%C2%A0b\", \"%25\", \"%2580\", \"100%25%20%C3%A9\", \"%09%0A\", \"%7F%C2%80%DF%BF%E0%A0%80%EF%BF%BF\", \"xxxxxxxxxxxxxxxxxxxx\"]) { const s = url_decode(e); console.log(`${text_length(s)} [${pad_end(s, 5)}] [${pad_start(s, 5)}]`); }", imports: "url_decode", extra: 'import { text_length, pad_end, pad_start } from "machin/text";', expect: "same" },
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
    await Deno.writeTextFile(`${d}/map.json`, JSON.stringify({ imports: { machin: `${root}shim/machin.js`, "machin/text": `${root}shim/text.js` } }));
    const sources = [...await Promise.all(built.native.map((f) => Deno.readTextFile(f))), ...built.order.map((o) => o.out)];
    await Deno.writeTextFile(`${d}/m.src`, sources.join("\n"));
    const js = await run("deno", ["run", "--no-config", `--import-map=${d}/map.json`, `${d}/run.mjs`]);
    assertEquals(js.code, 0, js.err);
    const enc = await run("machin", ["encode", `${d}/m.src`]);
    assertEquals(enc.code, 0, enc.err);
    await Deno.writeTextFile(`${d}/m.mfl`, enc.out);
    const native = await run("machin", ["run", `${d}/m.mfl`, "--safe"]);
    assertEquals([native.code, native.out], [js.code, js.out], native.err);
  });
}

// A crash must say where in the .js it happened — with or without --safe.
const CRASHES: [string, string, string][] = [
  ["read past the end", "const a = [1];\n  console.log(a[5]);", "m.js:5:15: reading a[5]: index 5 is outside the list (length 1)"],
  ["negative index", "const a = [1]; const i = 0 - 1;\n  console.log(a[i]);", "m.js:5:15: reading a[i]: index -1 is outside the list (length 1)"],
  ["store past the end", "const a = [1];\n\n  a[3] = 2;", "m.js:6:3: writing a[3]: index 3 is outside the list (length 1)"],
  ["add past the end", "const a = [1];\n  a[1] += 2;", "m.js:5:3: reading a[1]: index 1 is outside the list (length 1)"],
  ["increment past the end", "const a = [1];\n  a[2]++;", "m.js:5:3: reading a[2]: index 2 is outside the list (length 1)"],
  ["the second of two reads on one line", "const a = [1];\n  console.log(a[0] + a[4]);", "m.js:5:22: reading a[4]: index 4 is outside the list (length 1)"],
  ["divide by zero", "const z = 0;\n  console.log(Math.trunc(1 / z));", "m.js:5:30: division by zero"],
  ["modulo by zero", "const z = 0;\n  console.log(1 % z);", "m.js:5:19: division by zero"],
  ["modulo-assign by literal zero", "let x = 1;\n  x %= 0;\n  console.log(x);", "m.js:5:8: division by zero"],
];

for (const [name, body, message] of CRASHES) {
  for (const flags of [["--safe"], []]) {
    Deno.test(`crash names the JavaScript line: ${name} ${flags.join("")}`, async () => {
      const d = await Deno.makeTempDir();
      await Deno.writeTextFile(`${d}/m.js`, `/** p */\nexport function main() {\n  //why: p.\n  ${body}\n}\n`);
      const built = await buildGraph(`${d}/m.js`);
      assertEquals(built.diags, []);
      await Deno.writeTextFile(`${d}/m.src`, built.order.map((o) => o.out).join("\n"));
      const enc = await run("machin", ["encode", `${d}/m.src`]);
      assertEquals(enc.code, 0, enc.err);
      await Deno.writeTextFile(`${d}/m.mfl`, enc.out);
      const native = await run("machin", ["run", `${d}/m.mfl`, ...flags]);
      assertEquals([native.code, native.err.trim()], [1, message]);
    });
  }
}
