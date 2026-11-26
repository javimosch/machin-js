// Cost of approach B: the same calls repeated, natively in QuickJS and under Deno. Run run.ts first.
const here = new URL("./", import.meta.url).pathname;
const md = "# Title\n\n" + "- item with **bold** and [a link](http://x.dev)\n".repeat(40);
const jobs: [string, string, unknown[], number][] = [
  ["ms", "toMs", ["2 days"], 200000],
  ["marked", "html", [md], 3000],
  ["zod", "check", [{ name: "Ada", age: 36, email: "ada@x.dev" }], 50000],
];
const sh = async (cmd: string, args: string[]) => {
  const r = await new Deno.Command(cmd, { args, cwd: here }).output();
  if (!r.success) throw new Error(new TextDecoder().decode(r.stderr).slice(0, 800));
  return new TextDecoder().decode(r.stdout);
};
for (const [lib, fn, args, n] of jobs) {
  const api = await import(`./adapters/${lib}.js`);
  const input = JSON.stringify(args);
  let t = performance.now();
  for (let i = 0; i < n; i++) JSON.stringify({ ok: true, value: api[fn](...JSON.parse(input)) });
  const deno = performance.now() - t;
  const base = await Deno.readTextFile(`${here}out/${lib}.src`);
  for (const arena of [false, true]) {
    const body = `n := 0\n    t := now_ms()\n    i := 0\n    for i < ${n} {\n        ${arena ? "arena { " : ""}n = n + len(jsb_call("${fn}", args))${arena ? " }" : ""}\n        i = i + 1\n    }\n    println(str(now_ms() - t) + " " + str(n))\n}\n`;
    const src = base.replace(/\n    show\(jsb_call[\s\S]*$/, `\n    args := text("${btoa(String.fromCharCode(...new TextEncoder().encode(input)))}")\n    ${body}`);
    await Deno.writeTextFile(`${here}out/bench.src`, src);
    await Deno.writeTextFile(`${here}out/bench.mfl`, await sh("machin", ["encode", "out/bench.src"]));
    await sh("machin", ["build", "out/bench.mfl", "-o", "out/bench.bin", "--cflags", `-I${here} -I${here}qjs`, "--ldflags", `-L${here}qjs`]);
    const r = await new Deno.Command("/usr/bin/time", { args: ["-f", "%M", `${here}out/bench.bin`], stdout: "piped", stderr: "piped" }).output();
    const ms = Number(new TextDecoder().decode(r.stdout).split(" ")[0]);
    const rss = Number(new TextDecoder().decode(r.stderr).trim().split("\n").pop()) / 1024;
    console.log(`${lib.padEnd(7)} ${String(n).padStart(6)} calls ${arena ? "with arena" : "no arena  "}  native ${(ms * 1000 / n).toFixed(1).padStart(6)} us/call  deno ${(deno * 1000 / n).toFixed(1).padStart(5)} us/call  (${(ms / deno).toFixed(0)}x)  peak ${rss.toFixed(0)} MB`);
  }
}
