// Temporary files must not pile up: every script that makes a temporary directory removes it.
import { assert, assertEquals } from "jsr:@std/assert@1";

const root = new URL("../", import.meta.url).pathname;

async function scripts(dir: string): Promise<string[]> {
  const found: string[] = [];
  for await (const e of Deno.readDir(`${root}${dir}`)) {
    if (e.isDirectory) found.push(...await scripts(`${dir}/${e.name}`));
    else if (e.name.endsWith(".sh")) found.push(`${dir}/${e.name}`);
  }
  return found;
}

Deno.test("every script that makes a temporary directory removes it on exit", async () => {
  const all = [...await scripts("tools"), ...await scripts("examples")];
  const leaking = [];
  for (const file of all) {
    const text = await Deno.readTextFile(`${root}${file}`);
    if (text.includes("mktemp -d") && !/^trap .*rm -rf "\$T".* EXIT/m.test(text)) leaking.push(file);
  }
  assert(all.length > 5);
  assertEquals(leaking, []);
});

Deno.test("clean-tmp.sh removes what the command left, and keeps its exit code", async () => {
  const outer = await Deno.makeTempDir();
  const r = await new Deno.Command(`${root}tools/clean-tmp.sh`, { args: ["sh", "-c", 'mktemp -d >/dev/null; echo "$TMPDIR"; exit 7'], env: { TMPDIR: outer, KEEP_TMP: "" } }).output();
  assertEquals(r.code, 7);
  assert(new TextDecoder().decode(r.stdout).startsWith(`${outer}/machin-js-work.`));
  assertEquals([...Deno.readDirSync(outer)], []);
  await Deno.remove(outer);
});
