// Docs honesty test: every ```js block preceded by <!-- check: ok|CODE --> must behave as stated.
import { assertEquals } from "jsr:@std/assert@1";
import { transpile } from "../transpile/transpile.ts";

const docs = new URL("../docs/", import.meta.url);
for await (const f of Deno.readDir(docs)) {
  if (!f.name.endsWith(".md")) continue;
  const text = await Deno.readTextFile(new URL(f.name, docs));
  const blocks = [...text.matchAll(/<!-- check: (\S+) -->\n```js\n([\s\S]*?)```/g)];
  blocks.forEach(([, want, code], i) => {
    Deno.test(`${f.name} example ${i + 1}: ${want}`, () => {
      const codes = [...new Set(transpile(f.name, code).diags.map((d) => d.code))];
      assertEquals(codes, want === "ok" ? [] : [want]);
    });
  });
}
