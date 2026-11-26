// Approach B: the same adapter, under Deno with the real npm packages, and natively inside QuickJS.
//   deno run -A run.ts          (needs machin, cc, and qjs/libqjs.a)
const here = new URL("./", import.meta.url).pathname;
const cases: Record<string, [string, unknown[]][]> = JSON.parse(await Deno.readTextFile(`${here}cases.json`));
await Deno.mkdir(`${here}out`, { recursive: true });

/** The one line both sides share: call an exported function, answer with JSON. */
const DISPATCH = `
globalThis.__call = (name, args) => {
  try {
    const value = api[name](...JSON.parse(args));
    return JSON.stringify({ ok: true, value: value === undefined ? null : value });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String((e && e.name) || e) });
  }
};`;

const run = async (cmd: string, args: string[], cwd = here) => {
  const r = await new Deno.Command(cmd, { args, cwd }).output();
  return { ok: r.success, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
};
const b64 = (s: string) => {
  //why: spreading a whole bundle into one call overflows the stack.
  let bytes = "";
  for (const byte of new TextEncoder().encode(s)) bytes += String.fromCharCode(byte);
  return btoa(bytes);
};
const rows: string[] = [];
let total = 0, same = 0;

for (const [lib, list] of Object.entries(cases)) {
  // esbuild can't read "npm:" specifiers, so it gets the bare package name
  const src = (await Deno.readTextFile(`${here}adapters/${lib}.js`)).replace(/"npm:((?:@[^/"]+\/)?[^@"]+)@[^"]+"/g, '"$1"');
  await Deno.writeTextFile(`${here}out/${lib}.adapter.js`, src);
  await Deno.writeTextFile(`${here}out/${lib}.entry.js`, `import * as api from "./${lib}.adapter.js";${DISPATCH}`);
  const built = await run("deno", ["run", "-A", "npm:esbuild@0.24.2", `out/${lib}.entry.js`, "--bundle", "--format=iife", "--platform=neutral", "--conditions=browser", "--main-fields=module,main", "--target=es2022", "--charset=utf8", `--outfile=out/${lib}.bundle.js`]);
  if (!built.ok) { rows.push(`${lib}: BUNDLE FAILED ${built.err.slice(0, 300)}`); continue; }
  const bundle = await Deno.readTextFile(`${here}out/${lib}.bundle.js`);

  // the Deno side: the adapter as written, with the real npm: packages, no bundler
  const api = await import(`./adapters/${lib}.js`);
  const g: Record<string, unknown> = {};
  new Function("globalThis", "api", DISPATCH)(g, api);
  const want = list.map(([fn, args]) => (g.__call as (n: string, a: string) => string)(fn, JSON.stringify(args)));

  // the native side
  const calls = list.map(([fn, args]) => `    show(jsb_call("${fn}", text("${b64(JSON.stringify(args))}")))`).join("\n");
  await Deno.writeTextFile(`${here}out/${lib}.src`, `extern "jsbridge" {
    header "jsbridge.h"
    link "qjs" link "m" link "pthread"
    fn jsb_load(string) string
    fn jsb_call(string, string) string
}
func text(b) (s) { s = base64_decode(b) }
func show(s) { println(s) }
func main() {
    t0 := now_ms()
    problem := jsb_load(text("${b64(bundle)}"))
    if problem != "" { println("LOAD FAILED: " + problem)  exit(3) }
    eprintln("load_ms=" + str(now_ms() - t0))
${calls}
}
`);
  const enc = await run("machin", ["encode", `out/${lib}.src`]);
  if (!enc.ok) { rows.push(`${lib}: ENCODE FAILED ${enc.err.slice(0, 300)}`); continue; }
  await Deno.writeTextFile(`${here}out/${lib}.mfl`, enc.out);
  const nb = await run("machin", ["build", `out/${lib}.mfl`, "-o", `out/${lib}.bin`, "--cflags", `-I${here} -I${here}qjs`, "--ldflags", `-L${here}qjs`]);
  if (!nb.ok) { rows.push(`${lib}: BUILD FAILED ${nb.err.slice(0, 600)}`); continue; }
  const r = await run(`${here}out/${lib}.bin`, []);
  const got = r.out.trimEnd().split("\n");
  const size = (await Deno.stat(`${here}out/${lib}.bin`)).size;
  const diffs = list.map(([fn], i) => got[i] === want[i] ? null : `     ${fn}: deno   ${want[i].slice(0, 150)}\n     ${" ".repeat(fn.length)}  native ${(got[i] ?? r.err).slice(0, 150)}`).filter(Boolean);
  total += list.length;
  same += list.length - diffs.length;
  rows.push(`${lib.padEnd(9)} ${String(list.length - diffs.length).padStart(2)}/${list.length} same   bundle ${(bundle.length / 1024).toFixed(0).padStart(3)} kB   binary ${(size / 1048576).toFixed(2)} MB   ${/load_ms=\d+/.exec(r.err)?.[0] ?? ""}`, ...diffs as string[]);
}
console.log(rows.join("\n"));
console.log(`\n${same}/${total} calls gave identical results`);
