// Approach A: how far is real library source from the machin-js subset?
//why: counts what the transpiler says about each library's own published code, unchanged.
import { transpile } from "../../transpile/transpile.ts";

const nm = new URL("./node_modules/.deno/", import.meta.url).pathname;
const files: [string, string][] = [
  ["escape-string-regexp (11 lines)", "escape-string-regexp@5.0.0/node_modules/escape-string-regexp/index.js"],
  ["lodash-es chunk", "lodash-es@4.17.21/node_modules/lodash-es/chunk.js"],
  ["ms", "ms@2.1.3/node_modules/ms/index.js"],
  ["slugify", "slugify@1.6.6/node_modules/slugify/slugify.js"],
  ["marked", "marked@15.0.6/node_modules/marked/lib/marked.esm.js"],
];
const READABILITY = new Set(["JS-DOC001", "JS-WHY001", "JS-SIZE001"]);
for (const [name, path] of files) {
  const src = await Deno.readTextFile(nm + path);
  let diags: { code: string; msg: string }[];
  try {
    diags = transpile(path.split("/").pop()!, src).diags;
  } catch (e) {
    console.log(`${name}: transpiler threw: ${(e as Error).message.slice(0, 120)}`);
    continue;
  }
  const lang = diags.filter((d) => !READABILITY.has(d.code));
  const top = Object.entries(lang.reduce((m, d) => (m[`${d.code} ${d.msg.slice(0, 55)}`] = (m[`${d.code} ${d.msg.slice(0, 55)}`] ?? 0) + 1, m), {} as Record<string, number>))
    .sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log(`${name}: ${src.split("\n").length} lines -> ${lang.length} language problems, ${diags.length - lang.length} readability`);
  for (const [what, n] of top) console.log(`     ${n}x ${what}`);
}
