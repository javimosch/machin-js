// Run the todo server under Deno (the oracle for the HTTP layer).
const dir = new URL("../", import.meta.url);
const names = ["store", "render", "routes", "server"];
let code = `import * as m from "${new URL("shim/machin.js", dir).href}";\nconst {${[
  "sqlite_open", "sqlite_exec", "sqlite_query", "sqlite_close", "parse", "replace", "len", "index", "substr",
  "has_prefix", "parse_int", "split", "url_decode", "json", "ok_html", "ok_json", "not_found", "redirect", "serve",
].join(",")}}=m;\n`;
for (const f of names) code += await Deno.readTextFile(new URL(`src/${f}.js`, dir)) + "\n";
code += "main();\n";
const f = (await Deno.makeTempFile({ suffix: ".mjs" }));
await Deno.writeTextFile(f, code);
await import(f);
