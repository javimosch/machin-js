// A name may be imported only if it runs in both places: it needs a Deno stand-in.
//why: typings come from `machin guide`, so they list far more than the stand-ins provide. Such an
//     import used to pass `check`, then fail under Deno, or even fail to build.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildGraph } from "../transpile/transpile.ts";

const root = new URL("../", import.meta.url).pathname;

/** The diagnostic codes for a program that only imports `names` from `source`. */
async function codes(source: string, names: string) {
  const d = await Deno.makeTempDir();
  await Deno.writeTextFile(`${d}/m.js`, `import { ${names} } from "${source}";\n/** m */\nexport function main() {\n  //why: t.\n}\n`);
  return (await buildGraph(`${d}/m.js`)).diags.map((x) => x.code);
}

for (const [source, name] of [["machin", "sha256"], ["machin", "http_get"], ["machin", "ws_open"], ["machin", "has"], ["machin/web", "sse"], ["machin/web", "set_cookie"]]) {
  Deno.test(`no Deno stand-in, so refused: ${name} from ${source}`, async () => {
    assertEquals(await codes(source, name), ["JS-IMPORT003"]);
  });
}

Deno.test("a name the module doesn't have stays JS-IMPORT001", async () => {
  assertEquals(await codes("machin", "no_such_thing"), ["JS-IMPORT001"]);
});

for (const [source, file] of [["machin", "machin"], ["machin/web", "web"], ["machin/json", "json"], ["machin/text", "text"]]) {
  Deno.test(`every stand-in export of ${source} is accepted`, async () => {
    const names = Object.keys(await import(`${root}shim/${file}.js`));
    assert(names.length > 0);
    assertEquals(await codes(source, names.join(", ")), []);
  });
}

Deno.test("the modules page lists exactly the builtins that have a stand-in", async () => {
  const page = await Deno.readTextFile(`${root}docs/modules.md`);
  const list = /<!-- builtins -->\n([\s\S]*?)\n<!-- \/builtins -->/.exec(page)?.[1] ?? "";
  const listed = [...list.matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1]).sort();
  assertEquals(listed, Object.keys(await import(`${root}shim/machin.js`)).sort());
});

/** Build `body` as main() and run it natively and under Deno, in a folder holding `files`. */
async function both(imports: string, body: string, files: Record<string, Uint8Array> = {}) {
  const d = await Deno.makeTempDir();
  for (const [name, bytes] of Object.entries(files)) await Deno.writeFile(`${d}/${name}`, bytes);
  await Deno.writeTextFile(`${d}/m.js`, `import { ${imports} } from "machin";\n/** m */\nexport function main() {\n  //why: t.\n  ${body}\n}\n`);
  const built = await buildGraph(`${d}/m.js`);
  assertEquals(built.diags, []);
  await Deno.writeTextFile(`${d}/m.src`, built.order.map((o) => o.out).join("\n"));
  await Deno.writeTextFile(`${d}/run.mjs`, 'import { main } from "./m.js";\nmain();\n');
  await Deno.writeTextFile(`${d}/map.json`, JSON.stringify({ imports: { machin: `${root}shim/machin.js` } }));
  const run = async (cmd: string, args: string[]) => {
    const r = await new Deno.Command(cmd, { args, cwd: d }).output();
    return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
  };
  const enc = await run("machin", ["encode", "m.src"]);
  assertEquals(enc.code, 0, enc.err);
  await Deno.writeTextFile(`${d}/m.mfl`, enc.out);
  return { native: await run("machin", ["run", "m.mfl", "--safe"]), deno: await run("deno", ["run", "-A", "--no-config", "--import-map=map.json", "run.mjs"]) };
}

const ascii = (s: string) => new TextEncoder().encode(s);

Deno.test("read_file stops at the first zero byte, as natively", async () => {
  const r = await both("read_file, json", 'console.log(json(read_file("a"))); console.log(json(read_file("missing")));', { a: ascii("ab\0cd") });
  assertEquals([r.deno.code, r.deno.out], [r.native.code, r.native.out], r.deno.err + r.native.err);
});

Deno.test("read_file keeps a byte order mark, as natively", async () => {
  const r = await both("read_file, len", 'console.log(len(read_file("a")));', { a: ascii("\ufeffx") });
  assertEquals(r.deno.out, r.native.out, r.deno.err + r.native.err);
});

//why: machin keeps the raw bytes, which a JavaScript string can't hold, so say so.
Deno.test("read_file of invalid UTF-8 stops under Deno instead of changing the text", async () => {
  const r = await both("read_file, len", 'console.log(len(read_file("a")));', { a: new Uint8Array([120, 255, 121]) });
  assert(r.deno.code !== 0 && r.deno.err.includes("not valid UTF-8"), r.deno.out + r.deno.err);
});

Deno.test("env of a name no variable can have is empty in both", async () => {
  const r = await both("env", 'console.log(`<${env("")}> <${env("A=B")}>`);');
  assertEquals([r.deno.code, r.deno.out], [r.native.code, r.native.out], r.deno.err);
});

Deno.test("eprintln writes % codes as they are in both", async () => {
  const r = await both("eprintln", 'eprintln("100%s %d %%", 5, 1 > 2);');
  assertEquals(r.deno.err, r.native.err);
});

for (const [what, body] of [["a list", "const a = [1, 2]; eprintln(a);"], ["a list literal", "eprintln([1]);"]]) {
  Deno.test(`eprintln of ${what} is refused by check`, async () => {
    const d = await Deno.makeTempDir();
    await Deno.writeTextFile(`${d}/m.js`, `import { eprintln } from "machin";\n/** m */\nexport function main() {\n  //why: t.\n  ${body}\n}\n`);
    assertEquals((await buildGraph(`${d}/m.js`)).diags.map((x) => x.code), ["JS-VAL001"]);
  });
}
