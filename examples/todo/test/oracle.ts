// Oracle: run the demo (src/main.js) under Deno, as real ES modules, against the shim.
//why: "machin" resolves to shim/machin.js via deno.json's import map — the same import
//     lines the transpiler checks, so source files need no test-only edits.
import { main } from "../src/main.js";
main();
