// Oracle: run src/*.js under Deno with the shim; print stdout for diffing with gold/expected.txt.
const dir = new URL("../", import.meta.url);
const order = ["store", "render", "main"];
let code = `import * as m from "${new URL("shim/machin.js", dir).href}";\n`;
code += "const {sqlite_open,sqlite_exec,sqlite_query,sqlite_close,parse,replace}=m;\n";
for (const f of order) code += await Deno.readTextFile(new URL(`src/${f}.js`, dir)) + "\n";
code += "main();\n";
const tmp = await Deno.makeTempFile({ suffix: ".mjs" });
await Deno.writeTextFile(tmp, code);
const out = await new Deno.Command("deno", { args: ["run", "-A", tmp] }).output();
await Deno.stdout.write(out.stdout);
Deno.exit(out.code);
