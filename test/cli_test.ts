// The machin-js command, run from source the way the compiled binary runs it.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import ts from "npm:typescript@5.7.3";
import { explain } from "../cli/machin-js.ts";

const root = new URL("../", import.meta.url).pathname;

/** Run the command in `cwd`. */
async function cli(cwd: string, ...args: string[]) {
  const r = await new Deno.Command("deno", { args: ["run", "-A", `--config=${root}deno.json`, `${root}cli/machin-js.ts`, ...args], cwd }).output();
  return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
}

/** A fresh project made by `new`. */
async function project() {
  const d = `${await Deno.makeTempDir()}/app`;
  assertEquals((await cli(".", "new", d)).code, 0);
  return d;
}

const ECHO = `import { args, exit, parse_int } from "machin";

/**
 * Print the arguments, then exit with the first one's number.
 * @returns {void}
 */
export function main() {
  //why: shows that arguments and exit codes pass through.
  for (const a of args()) {
    if (a != args()[0]) {
      console.log(a);
    }
  }
  if (args().length > 1) {
    exit(parse_int(args()[1]));
  }
}
`;

Deno.test("new, check, run and debug work in a fresh project", async () => {
  const d = await project();
  assertEquals((await cli(d, "check", "main.js")).out.trim(), "ok");
  assertEquals((await cli(d, "run", "main.js")).out.trim(), "hello world");
  assertEquals((await cli(d, "debug", "main.js")).out.trim(), "hello world");
});

for (const command of ["run", "debug"]) {
  Deno.test(`${command} passes arguments and the exit code through`, async () => {
    const d = await project();
    await Deno.writeTextFile(`${d}/main.js`, ECHO);
    const r = await cli(d, command, "main.js", "--", "7", "two words", "-o");
    assertEquals([r.code, r.out], [7, "7\ntwo words\n-o\n"], r.err);
  });
}

Deno.test("the jsconfig.json from `new` type-checks the project, as an editor would read it", async () => {
  const d = await project();
  const diagnose = () => {
    const read = ts.readConfigFile(`${d}/jsconfig.json`, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, d, undefined, `${d}/jsconfig.json`);
    const program = ts.createProgram(parsed.fileNames, parsed.options);
    return ts.getPreEmitDiagnostics(program).map((x) => ts.flattenDiagnosticMessageText(x.messageText, " "));
  };
  await Deno.writeTextFile(`${d}/web.js`, 'import { ok_text } from "machin/web";\nexport const r = ok_text("x");\n');
  assertEquals(diagnose(), []);
  await Deno.writeTextFile(`${d}/wrong.js`, 'import { len } from "machin";\n/** @type {string} */\nexport const s = len("x");\n');
  assert(diagnose().length === 1);
});

Deno.test("problems, bad usage and missing files have clear messages and exit codes", async () => {
  const d = await project();
  await Deno.writeTextFile(`${d}/bad.js`, "/** m */\nexport function main() {\n  //why: t.\n  console.log(7 / 2);\n}\n");
  const bad = await cli(d, "build", "bad.js");
  assertEquals(bad.code, 1);
  assertStringIncludes(bad.err, "bad.js:4: JS-NUM002");
  for (const args of [["nonsense"], ["check", "missing.js"], ["build", "main.js", "--typo"], ["new", d]]) {
    const r = await cli(d, ...args);
    assertEquals(r.code, 2, `${args.join(" ")}: ${r.err}`);
    assert(!r.err.includes("    at "), "no stack traces for user mistakes");
  }
});

Deno.test("a machin error is given the JavaScript location of the function it names", () => {
  const text = explain('error: typecheck: type mismatch in "total": num vs string', new Map([["total", "/p/sum.js:12"]]));
  assertStringIncludes(text, "total is defined at /p/sum.js:12");
  assertStringIncludes(text, "machin-js bug");
});

Deno.test("the bundled machweb.src is the one from the pinned machin version", async () => {
  const pinned = /MACHIN_VERSION: v([\d.]+)/.exec(await Deno.readTextFile(`${root}.github/workflows/test.yml`))![1];
  assertEquals((await Deno.readTextFile(`${root}bindings/machweb.version`)).trim(), pinned);
  const framework = Deno.env.get("MACHIN_FRAMEWORK");
  //why: in CI MACHIN_FRAMEWORK is the pinned tag's checkout, so the copy can be compared exactly.
  if (framework && Deno.env.get("CI") && !Deno.env.get("MACHIN_LATEST")) {
    assertEquals(await Deno.readTextFile(`${root}bindings/machweb.src`), await Deno.readTextFile(`${framework}/machweb.src`));
  }
});
