// Random differential testing: generate well-typed programs in the subset, run each under Deno
// and as a native binary, and compare. Usage: deno run -A tools/fuzz.ts [count] [firstSeed]
//why: parity cases only cover what someone thought of; this looks where nobody did. Every program
//     is reproducible from its seed.
import { buildGraph } from "../transpile/transpile.ts";

const root = new URL("../", import.meta.url).pathname;

/** Seeded generator (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return { int, pick: <T>(xs: T[]) => xs[int(xs.length)], chance: (p: number) => next() < p };
}

/** Fixed helpers the random statements call. */
const HELPERS = `/** @typedef {{n: int, ok: boolean}} Row */
/**
 * A row decoded from JSON text.
 * @param {int} n
 * @param {boolean} ok
 * @returns {Row}
 */
function makeRow(n, ok) {
  //why: random.
  return parse("{\\"n\\":" + String(n) + ",\\"ok\\":" + String(ok) + "}", []);
}
/**
 * Add three.
 * @param {int} n
 * @returns {int}
 */
function bump(n) {
  //why: random.
  return n + 3;
}
/**
 * Call f twice.
 * @param {(n: int) => int} f
 * @param {int} n
 * @returns {int}
 */
function applyTwice(f, n) {
  //why: random.
  return f(f(n));
}`;

/** One random program. All values stay far below 2^53, where the two runtimes are defined to agree. */
export function generate(seed: number): string {
  const r = rng(seed);
  const ints = ["a", "b"], strs = ["s"], bools = ["p"], arrays = ["xs"];
  let fresh = 0;

  const word = () => r.pick(["", "x", "ab", "hello", "a b", "q\\n", "\\t", "100%", "{}"]);
  const leaf = (vars: string[]) => r.chance(0.55) ? r.pick(vars) : String(r.int(50));
  const num = (d: number, v: string[]): string => {
    if (d <= 0) return leaf(v);
    switch (r.int(9)) {
      //why: only leaves are multiplied, so products can't grow past the safe range.
      case 0: return `${leaf(v)} * ${leaf(v)}`;
      case 1: return `${num(d - 1, v)} + ${num(d - 1, v)}`;
      case 2: return `${num(d - 1, v)} - ${num(d - 1, v)}`;
      case 3: return `(${num(d - 1, v)}) % ${1 + r.int(13)}`;
      case 4: return `Math.trunc((${num(d - 1, v)}) / ${r.chance(0.5) ? 1 + r.int(9) : `(0 - ${1 + r.int(9)})`})`;
      case 5: return `-(${num(d - 1, v)})`;
      case 6: return `len(${text(d - 1, v)})`;
      case 7: return `${r.pick(arrays)}[${r.int(3)}]`;
      default: return `(${num(d - 1, v)})`;
    }
  };
  const text = (d: number, v: string[]): string => {
    if (d <= 0) return r.chance(0.5) ? r.pick(strs) : `"${word()}"`;
    switch (r.int(4)) {
      case 0: return `${text(d - 1, v)} + ${text(d - 1, v)}`;
      case 1: return `String(${num(d - 1, v)})`;
      case 2: return `substr(${r.pick(strs)} + "0123456789", ${r.int(4)}, ${4 + r.int(6)})`;
      default: return text(0, v);
    }
  };
  const cond = (d: number, v: string[]): string => {
    //why: a variable on the left — the checker (rightly) rejects comparing two constants.
    if (d <= 0) return r.chance(0.3) ? r.pick(bools) : `${r.pick(v)} ${r.pick(["<", ">", "<=", ">=", "==", "!="])} ${leaf(v)}`;
    switch (r.int(6)) {
      case 0: return `${cond(d - 1, v)} && ${cond(d - 1, v)}`;
      case 1: return `${cond(d - 1, v)} || ${cond(d - 1, v)}`;
      case 2: return `!(${cond(d - 1, v)})`;
      case 3: return `${r.pick(v)} + ${num(d - 1, v)} ${r.pick(["<", ">=", "==", "!="])} ${num(d - 1, v)}`;
      case 4: return `${r.pick(strs)} + ${text(d - 1, v)} ${r.pick(["==", "!="])} ${text(d - 1, v)}`;
      default: return `(${cond(d - 1, v)}) ${r.pick(["==", "!="])} (${cond(d - 1, v)})`;
    }
  };
  /** Keep a variable small, so repeated updates in loops can't leave the safe range. */
  const clamp = (name: string) => `${name} %= 1009;`;
  const statement = (depth: number, v: string[]): string => {
    const target = r.pick(ints);
    switch (r.int(depth > 0 ? 22 : 7)) {
      //why: a map read, written, deleted and shared through an alias, with colliding and odd keys.
      case 19: {
        const m = `map${fresh++}`, n = `alias${fresh++}`, i = `i${fresh++}`;
        const key = () => r.pick(['"a"', '"b"', '""', '"__proto__"', `String(${num(1, v)} % 5)`, text(1, v)]);
        return `\n    /** @type {Map<string, int>} */\n    const ${m} = new Map(); const ${n} = ${m}; for (let ${i} = 0; ${i} < ${r.int(6)}; ${i}++) { ${m}.set(String(${i} % 3), (${m}.get(String(${i} % 3)) ?? 0) + ${num(1, v)} % 1009); } ${n}.set(${key()}, ${r.int(99)}); ${m}.delete(${key()}); ${target} = (${n}.get(${key()}) ?? ${r.int(9)}) % 1009; console.log(String(${m}.size), String(${m}.has(${key()})), ${n}.get(${key()}) ?? ${r.int(9)});`;
      }
      case 20: {
        const rows = `byId${fresh++}`, none = `none${fresh++}`, got = `got${fresh++}`;
        return `\n    /** @type {Map<int, Row>} */\n    const ${rows} = new Map(); ${rows}.set(${r.int(3)}, { n: ${num(1, v)} % 1009, ok: ${cond(1, v)} }); ${rows}.set(${r.int(3)}, makeRow(${r.int(9)}, true));\n    /** @type {Row} */\n    const ${none} = { n: 0, ok: false }; const ${got} = ${rows}.get(${r.int(3)}) ?? ${none}; console.log(String(${got}.n), ${got}.ok, ${rows}.size);`;
      }
      case 21: return `console.log(pad_end(${text(1, v)}, ${r.int(12)}) + "|" + pad_start(${text(1, v)}, ${r.int(12)}) + "|" + String(text_length(${text(1, v)})));`;
      //why: a list built with push, then shared, read by for…of and changed through an alias.
      case 14: {
        const l = `list${fresh++}`, i = `i${fresh++}`, x = `x${fresh++}`, y = `y${fresh++}`;
        return `\n    /** @type {int[]} */\n    const ${l} = []; ${l}.push(${num(1, v)} % 1009); for (let ${i} = 0; ${i} < ${r.int(5)}; ${i}++) { if (${cond(1, v)}) { ${l}.push(${i} + ${num(1, v)} % 1009); } ${l}.push(${i}); } ${l}[0] = ${num(1, v)} % 1009; const ${y} = ${l}; ${y}[0] += 1; for (const ${x} of ${l}) { console.log(String(${x})); } console.log(String(${l}.length), ${l}[0]);`;
      }
      case 15: return `console.log(\`n=\${${num(2, v)}} s=\${${text(1, v)}} c=\${${cond(1, v)}}|\`); console.log(String(len(\`\${s}-\${${num(1, v)}}\`)));`;
      //why: object literals, alone and inside a list next to decoded rows.
      case 16: {
        const o = `obj${fresh++}`, all = `all${fresh++}`, x = `x${fresh++}`;
        return `\n    /** @type {Row} */\n    const ${o} = { ok: ${cond(1, v)}, n: ${num(1, v)} % 1009 }; const ${all} = [${o}, makeRow(${num(1, v)} % 1009, true), { n: ${r.int(9)}, ok: false }]; for (const ${x} of ${all}) { console.log(\`\${${x}.n}:\${${x}.ok}\`); }`;
      }
      case 17: {
        const so = `sorted${fresh++}`;
        return `const ${so} = sort_by([${num(1, v)}, ${num(1, v)}, ${num(1, v)}, xs[0]], (m, k) => m ${r.pick(["<", ">"])} k); console.log(\`\${${so}[0]},\${${so}[1]},\${${so}[2]},\${${so}[3]},\${xs[0]}\`);`;
      }
      //why: an arrow capturing a parameter, which changes after the arrow is made.
      case 18: {
        const g = `fn${fresh++}`;
        return `\n    /** @type {(n: int) => int} */\n    const ${g} = (m) => m + a; a = ${num(1, v)} % 1009; console.log(String(applyTwice(${g}, ${r.int(9)})));`;
      }
      case 9: {
        const w = `w${fresh++}`;
        return `let ${w} = 0; while (${w} < ${r.int(4)}) { ${w}++; ${body(depth - 1, [...v, w])} if (${cond(1, v)}) { break; } }`;
      }
      case 10: {
        const ws = `ws${fresh++}`;
        return `const ${ws} = [${text(1, v)}, "${word()}", s]; ${ws}[${r.int(3)}] = ${text(1, v)}; console.log(${ws}[${r.int(3)}] + ${ws}[${r.int(3)}]); console.log(String(len(${ws})));`;
      }
      case 11: {
        const row = `row${fresh++}`;
        return `const ${row} = makeRow(${num(1, v)} % 1009, ${cond(1, v)}); ${target} = ${row}.n; console.log(String(${row}.ok), ${row}.n);`;
      }
      //why: a function passed as a value, and called through the parameter.
      case 12: return `${target} = applyTwice(bump, ${num(2, v)} % 1009) % 1009;`;
      //why: one argument keeps % codes literally; strings also order the same way for ASCII.
      case 13: return `console.log(s + ${text(1, v)}); console.log(s < ${text(1, v)}); console.log(s >= "${word()}");`;
      case 0: return `${target} = ${num(3, v)}; ${clamp(target)}`;
      case 1: return `${target} ${r.pick(["+=", "-=", "*="])} ${num(2, v)}; ${clamp(target)}`;
      //why: String() so that -0 (a documented difference of console.log) prints as 0.
      case 2: return `console.log(String(${num(3, v)}), ${text(2, v)});`;
      case 3: return `console.log(${cond(3, v)});`;
      case 4: return `${r.pick(bools)} = ${cond(2, v)};`;
      case 5: return `s = ${text(2, v)}; s = substr(s + "          ", 0, 10);`;
      case 6: return `xs[${r.int(3)}] = ${num(2, v)}; ${target} = xs[${r.int(3)}] % 1009;`;
      case 7: return `if (${cond(2, v)}) { ${body(depth - 1, v)} }${r.chance(0.5) ? ` else { ${body(depth - 1, v)} }` : ""}`;
      case 8: {
        const i = `i${fresh++}`;
        return `for (let ${i} = 0; ${i} < ${r.int(4)}; ${i}++) { ${body(depth - 1, [...v, i])} }`;
      }
      default: {
        const k = `k${fresh++}`;
        return `{K} const ${k} = ${cond(1, v)} ? ${num(2, v)} : ${r.int(9)}; console.log(String(${k}));`.replace("{K} ", "");
      }
    }
  };
  const body = (depth: number, v: string[]) => Array.from({ length: 1 + r.int(3) }, () => statement(depth, v)).join("\n    ");

  /** Several small functions, because every function must stay short. */
  const funcs = Array.from({ length: 4 }, (_, n) =>
    `/**\n * Step ${n}.\n * @param {int} a\n * @param {int} b\n * @param {int[]} xs\n * @returns {int}\n */\nfunction step${n}(a, b, xs) {\n  //why: random.\n  let s = "${word()}"; let p = ${r.chance(0.5)};\n  ${statement(2, ["a", "b"])}\n  ${statement(2, ["a", "b"])}\n  console.log(String(a), s, p);\n  return (a + b) % 1009;\n}`);
  const calls = funcs.map((_, n) => `  console.log(String(step${n}(${r.int(100)}, ${r.int(100)}, xs)));`).join("\n");
  return `import { len, substr, parse, sort_by } from "machin";\nimport { pad_end, pad_start, text_length } from "machin/text";\n${HELPERS}\n${funcs.join("\n")}\n/** Run the steps. */\nexport function main() {\n  //why: random.\n  const xs = [${r.int(9)}, ${r.int(9)}, ${r.int(9)}];\n${calls}\n  console.log(String(xs[0]), String(xs[1]), String(xs[2]));\n}\n`;
}

/** Run a command, returning exit code and output. */
async function run(cmd: string, args: string[]) {
  const r = await new Deno.Command(cmd, { args }).output();
  return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
}

export type Result = { seed: number; outcome: "same" | "rejected" | "different"; detail: string; source: string };

/** Build and run one seed both ways. */
export async function check(seed: number): Promise<Result> {
  //why: the size rule is about human readability; random programs are exempt, nothing else is.
  const source = generate(seed);
  const d = await Deno.makeTempDir();
  const done = async (outcome: Result["outcome"], detail = "") => {
    await Deno.remove(d, { recursive: true });
    return { seed, outcome, detail, source };
  };
  await Deno.writeTextFile(`${d}/m.js`, source);
  const built = await buildGraph(`${d}/m.js`);
  const diags = built.diags.filter((x) => x.code !== "JS-SIZE001");
  if (diags.length) return done("rejected", diags.map((x) => `${x.line}: ${x.code} ${x.msg}`).join("\n"));
  await Deno.writeTextFile(`${d}/run.mjs`, 'import { main } from "./m.js";\nmain();\n');
  await Deno.writeTextFile(`${d}/map.json`, JSON.stringify({ imports: { machin: `${root}shim/machin.js`, "machin/text": `${root}shim/text.js` } }));
  const js = await run("deno", ["run", "--no-config", `--import-map=${d}/map.json`, `${d}/run.mjs`]);
  if (js.code !== 0) return done("rejected", `generator made invalid JavaScript: ${js.err.slice(0, 300)}`);
  const sources = [...await Promise.all(built.native.map((f) => Deno.readTextFile(f))), ...built.order.map((o) => o.out)];
  await Deno.writeTextFile(`${d}/m.src`, sources.join("\n"));
  const enc = await run("machin", ["encode", `${d}/m.src`]);
  if (enc.code !== 0) return done("different", `machin rejects the output: ${enc.err.slice(0, 300)}`);
  await Deno.writeTextFile(`${d}/m.mfl`, enc.out);
  const native = await run("machin", ["run", `${d}/m.mfl`, "--safe"]);
  if (native.code === 0 && native.out === js.out) return done("same");
  const a = js.out.split("\n"), b = native.out.split("\n");
  const at = a.findIndex((line, i) => line !== b[i]);
  return done("different", `exit ${native.code}; output line ${at + 1}: deno=${JSON.stringify(a[at])} native=${JSON.stringify(b[at])} ${native.err.slice(0, 200)}`);
}

if (import.meta.main) {
  const count = Number(Deno.args[0] ?? 100), first = Number(Deno.args[1] ?? 1);
  const tally = { same: 0, rejected: 0, different: 0 };
  const samples: Result[] = [];
  for (let seed = first; seed < first + count; seed += 6) {
    const batch = Array.from({ length: Math.min(6, first + count - seed) }, (_, i) => check(seed + i));
    for (const res of await Promise.all(batch)) {
      tally[res.outcome]++;
      if (res.outcome !== "same" && samples.length < 6) samples.push(res);
    }
  }
  console.log(tally);
  for (const s of samples) console.log(`--- seed ${s.seed}: ${s.outcome}\n${s.detail}`);
  Deno.exit(tally.different || tally.rejected ? 1 : 0);
}
