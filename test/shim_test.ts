// Every Deno stand-in must give the same results as the real machin builtin on awkward inputs.
//why: a human debugs under Deno; a stand-in that behaves "about right" sends them after bugs
//     that don't exist natively, or hides ones that do. A new stand-in needs a case here.
import { assertEquals } from "jsr:@std/assert@1";
import { buildGraph } from "../transpile/transpile.ts";

const root = new URL("../", import.meta.url).pathname;

/** A JS string literal that machin-js accepts, or url_decode for bytes it won't allow in source. */
const q = (s: string) => /^[\x20-\x7e\n\t]*$/.test(s) ? JSON.stringify(s) : `url_decode("${encodeURIComponent(s)}")`;

const SPACES = ["", " ", "  a b  ", "\t\na\n\t", "\r\n x \r\n", "\v\fx\f\v", " x ", " x"];
const NUMBERS = ["12", "-7", "+5", " 12", "\t\n12", "12 ", "12abc", "abc", "", "007", "-", "+", "--1", "- 1", "1.5", ".5", "0x10", "1e3", "-0"];
const TEXTS = ["", "a", "abcabc", "a,,b,", ",a", "héllo", "a+b%20c", "%", "%zz", "%C3%A9", "%2", "100%"];
const PAIRS = [["abcabc", "b"], ["abcabc", "zz"], ["a,,b,", ","], ["aaaa", "aa"], ["abc", "abc"], ["", "a"], ["héllo", "l"], ["abc", ""]];

/** Print every element of a list, so lists compare as text. */
const SHOW = '/**\n * show\n * @param {string[]} xs\n */\nfunction show(xs) {\n  //why: t.\n  console.log("n=" + String(xs.length));\n  for (const x of xs) { console.log("<" + x + ">"); }\n}\n';

const CASES: Record<string, { imports: string; lines: string[] }> = {
  trim: { imports: "trim", lines: SPACES.map((s) => `console.log("<" + trim(${q(s)}) + ">");`) },
  parse_int: { imports: "parse_int", lines: NUMBERS.map((s) => `console.log(String(parse_int(${q(s)})));`) },
  len: { imports: "len", lines: TEXTS.map((s) => `console.log(String(len(${q(s)})));`) },
  split: { imports: "split", lines: [...PAIRS, ["", ""], ["ab", ""], ["", ","]].map(([a, b]) => `show(split(${q(a)}, ${q(b)}));`) },
  index: { imports: "index", lines: PAIRS.map(([a, b]) => `console.log(String(index(${q(a)}, ${q(b)})));`) },
  has_prefix: { imports: "has_prefix", lines: PAIRS.map(([a, b]) => `console.log(has_prefix(${q(a)}, ${q(b)}));`) },
  replace: { imports: "replace", lines: PAIRS.map(([a, b]) => `console.log("<" + replace(${q(a)}, ${q(b)}, "-") + ">");`) },
  substr: { imports: "substr", lines: [[0, 3], [2, 99], [3, 3], [4, 2], [99, 100], [-2, 3], [0, -1]].map(([a, b]) => `console.log("<" + substr("abcdef", ${a < 0 ? `0 - ${-a}` : a}, ${b < 0 ? `0 - ${-b}` : b}) + ">");`) },
  url_decode: { imports: "url_decode", lines: TEXTS.map((s) => `console.log("<" + url_decode(${JSON.stringify(/^[\x20-\x7e]*$/.test(s) ? s : "x")}) + ">");`) },
  //why: JSON output is what an API's clients see, so escaping must agree too.
  json: { imports: "json, url_decode", lines: [...["", "plain", 'q"uote', "back\\slash", "<a>&'", "line\nbreak\ttab", "h\u00e9llo \u2603", "\u0001\u001f\r\f\b", "\u2028\u2029", "/"].map((s) => `console.log(json(url_decode("${encodeURIComponent(s)}")));`), "console.log(json([1, 2]));", "console.log(json([true]));", 'console.log(json(["a"]));', "console.log(json(7));"] },
  contains: { imports: "contains", lines: PAIRS.map(([a, b]) => `console.log(contains(${q(a)}, ${q(b)}));`) },
  url_encode: { imports: "url_encode, url_decode", lines: ["", "aZ09-._~", " !'()*", "a+b&c=d/e?f#g", "100%", "h\u00e9llo \u2603", "\u0000x", "\t\n\u001f\u007f", '"<>\\^`{|}[]@:;,$'].map((s) => `console.log(url_encode(url_decode("${encodeURIComponent(s)}")));`) },
  sort_by: { imports: "sort_by", lines: ['show(sort_by(["b", "a", "c", "a"], (x, y) => x < y));', 'show(sort_by(["bb", "a", "cc", "d"], (x, y) => x > y));'] },
};

/** Run a command, returning exit code and stdout. */
async function run(cmd: string, args: string[]) {
  const r = await new Deno.Command(cmd, { args }).output();
  return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
}

for (const [name, k] of Object.entries(CASES)) {
  Deno.test(`stand-in matches machin: ${name}`, async () => {
    const d = await Deno.makeTempDir();
    const imports = [...new Set([...k.imports.split(", "), ...(k.lines.join().includes("url_decode") ? ["url_decode"] : [])])];
    //why: one small function per input keeps every function inside the size rule.
    const fns = k.lines.map((l, i) => `/** c */\nfunction c${i}() {\n  //why: t.\n  ${l}\n}\n`);
    const calls = k.lines.map((_, i) => `c${i}();`);
    const groups = Array.from({ length: Math.ceil(calls.length / 8) }, (_, g) => `/** g */\nfunction g${g}() {\n  //why: t.\n  ${calls.slice(g * 8, g * 8 + 8).join("\n  ")}\n}\n`);
    const src = `import { ${imports.join(", ")} } from "machin";\n${k.lines.join().includes("show(") ? SHOW : ""}${fns.join("")}${groups.join("")}/** m */\nexport function main() {\n  //why: t.\n  ${groups.map((_, g) => `g${g}();`).join(" ")}\n}\n`;
    await Deno.writeTextFile(`${d}/m.js`, src);
    const built = await buildGraph(`${d}/m.js`);
    assertEquals(built.diags, [], src);
    await Deno.writeTextFile(`${d}/m.src`, built.order[0].out);
    await Deno.writeTextFile(`${d}/run.mjs`, 'import { main } from "./m.js";\nmain();\n');
    await Deno.writeTextFile(`${d}/map.json`, JSON.stringify({ imports: { machin: `${root}shim/machin.js` } }));
    const js = await run("deno", ["run", "-A", "--no-config", `--import-map=${d}/map.json`, `${d}/run.mjs`]);
    const enc = await run("machin", ["encode", `${d}/m.src`]);
    assertEquals(enc.code, 0, enc.err);
    await Deno.writeTextFile(`${d}/m.mfl`, enc.out);
    const native = await run("machin", ["run", `${d}/m.mfl`, "--safe"]);
    assertEquals([js.code, js.out.split("\n")], [native.code, native.out.split("\n")], js.err + native.err);
  });
}
