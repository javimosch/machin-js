// The machin-js command: new, check, build, run, debug, version.
//why: one command a user can install as a single binary (deno compile), so they need no
//     checkout of this repo or of machin — only `machin` and a C compiler.
import { basename, dirname, join, resolve, toFileUrl } from "jsr:@std/path@1";
import { buildGraph } from "../transpile/transpile.ts";

export const VERSION = "0.8.0-dev";
const MIN_MACHIN = [0, 143, 0];
const USAGE = `machin-js ${VERSION} — native machin apps from JSDoc-typed JavaScript

  machin-js new <dir>                          start a project
  machin-js check <main.js>                    report every problem
  machin-js build <main.js> [-o <program>]     build a native program
  machin-js run   <main.js> [-- args...]       build, then run it
  machin-js debug <main.js> [--inspect-brk] [-- args...]
                                               run as plain JavaScript under Deno
  machin-js version

Needs machin ${MIN_MACHIN.join(".")}+ and a C compiler (debug needs deno instead).
The desktop module also needs RAYLIB_DIR: a raylib 5.0 directory with lib/libraylib.a.`;

/** A problem the user can act on: print it without a stack trace. */
class Stop extends Error {
  constructor(message: string, readonly code = 1) {
    super(message);
  }
}

/** Read a file shipped inside machin-js (works from source and from the compiled binary). */
const shipped = (path: string) => Deno.readTextFile(new URL(`../${path}`, import.meta.url));

/** Run a program and capture its output; a missing program is explained. */
async function capture(cmd: string, args: string[]) {
  try {
    const r = await new Deno.Command(cmd, { args }).output();
    return { ok: r.success, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) throw new Stop(`${cmd} is not installed or not on your PATH`);
    throw e;
  }
}

/** Stop early, with a reason, if machin is too old to build what we emit. */
async function checkMachin() {
  const r = await capture("machin", ["guide"]);
  const found = /"version":\s*"(\d+)\.(\d+)\.(\d+)"/.exec(r.out)?.slice(1).map(Number);
  const old = !found || MIN_MACHIN.some((n, i) => found[i] < n && MIN_MACHIN.slice(0, i).every((m, j) => found[j] === m));
  if (old) throw new Stop(`machin ${MIN_MACHIN.join(".")} or newer is required (found ${found?.join(".") ?? "an unknown version"})`);
}

/** Transpile and check; print diagnostics and stop if there are any. */
async function analyse(entry: string) {
  if (!entry) throw new Stop(USAGE, 2);
  await Deno.stat(entry).catch(() => { throw new Stop(`no such file: ${entry}`, 2); });
  const graph = await buildGraph(entry);
  for (const d of graph.diags) console.error(`${d.file}:${d.line}: ${d.code} ${d.msg}`);
  if (graph.diags.length) throw new Stop(`${graph.diags.length} problem(s)`);
  return graph;
}

/** Add the JavaScript location of any function a machin error names. */
export function explain(message: string, where: Map<string, string>): string {
  const names = [...message.matchAll(/\bin "(\w+)"|\b(\w+)\$\d+|function "(\w+)"/g)].map((m) => m[1] ?? m[2] ?? m[3]);
  const places = [...new Set(names)].filter((n) => where.has(n)).map((n) => `  ${n} is defined at ${where.get(n)}`);
  return `${message.trim()}\n${places.join("\n")}\nmachin rejected the generated code. That is a machin-js bug: please report it.`;
}

/** Build `entry` into the native program `output`. */
async function build(entry: string, output: string) {
  await checkMachin();
  const graph = await analyse(entry);
  const dir = await Deno.makeTempDir({ prefix: "machin-js-" });
  try {
    //why: machin is a separate program and can't read files inside our binary, so copy them out.
    const files: string[] = [];
    const sources = [...await Promise.all(graph.native.map((f) => Deno.readTextFile(f))), ...graph.order.map((o) => o.out)];
    for (const [i, text] of sources.entries()) {
      files.push(join(dir, `${i}.src`));
      await Deno.writeTextFile(files[i], text);
    }
    const encoded = await capture("machin", ["encode", ...files]);
    if (!encoded.ok) throw new Stop(explain(encoded.err, graph.where));
    await Deno.writeTextFile(join(dir, "app.mfl"), encoded.out);
    //why: --safe adds machin's own overflow and bounds checks on top of ours.
    const flags = ["build", join(dir, "app.mfl"), "-o", resolve(output), "--safe", ...desktopFlags(graph.native)];
    const built = await capture("machin", flags);
    if (!built.ok) throw new Stop(explain(built.err, graph.where));
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

/** The raylib flags, only for programs that use the desktop module. */
function desktopFlags(native: string[]): string[] {
  if (!native.some((f) => f.endsWith("desktop.src"))) return [];
  const dir = Deno.env.get("RAYLIB_DIR");
  if (!dir) throw new Stop("this program uses machin/desktop: set RAYLIB_DIR to a raylib 5.0 directory with lib/libraylib.a");
  return ["--cflags", `-I${dir}/include`, "--ldflags", `-L${dir}/lib`, "--static-link", "raylib"];
}

/** Run a program with the terminal attached and return its exit code. */
async function attach(cmd: string, args: string[]): Promise<number> {
  try {
    return (await new Deno.Command(cmd, { args, stdin: "inherit", stdout: "inherit", stderr: "inherit" }).spawn().status).code;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) throw new Stop(`${cmd} is not installed or not on your PATH`);
    throw e;
  }
}

/** Build into a temporary program, run it, and pass its exit code on. */
async function run(entry: string, args: string[]): Promise<number> {
  const dir = await Deno.makeTempDir({ prefix: "machin-js-run-" });
  try {
    await build(entry, join(dir, "app"));
    return await attach(join(dir, "app"), args);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

/** Run the same .js under Deno, with the stand-ins for machin's modules. */
async function debug(entry: string, args: string[], inspect: boolean): Promise<number> {
  const graph = await analyse(entry);
  if (graph.native.some((f) => f.endsWith("desktop.src"))) throw new Stop("machin/desktop has no Deno version to debug under");
  const dir = await Deno.makeTempDir({ prefix: "machin-js-debug-" });
  try {
    for (const name of ["machin.js", "web.js"]) await Deno.writeTextFile(join(dir, name), await shipped(`shim/${name}`));
    await Deno.writeTextFile(join(dir, "map.json"), JSON.stringify({ imports: { machin: "./machin.js", "machin/web": "./web.js" } }));
    //why: your real files are imported, so breakpoints and stack traces point at them.
    await Deno.writeTextFile(join(dir, "start.mjs"), `import { main } from ${JSON.stringify(toFileUrl(resolve(entry)).href)};\nmain();\n`);
    const flags = ["run", "-A", "--no-config", `--import-map=${join(dir, "map.json")}`, ...(inspect ? ["--inspect-brk"] : [])];
    return await attach("deno", [...flags, join(dir, "start.mjs"), ...args]);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

const STARTER = `/**
 * Greet someone.
 * @param {string} name
 * @returns {string}
 */
function greet(name) {
  //why: kept apart from main so it can be read and reused on its own.
  return \`hello \${name}\`;
}

/**
 * The program starts here.
 * @returns {void}
 */
export function main() {
  //why: every machin-js program exports main().
  console.log(greet("world"));
}
`;

/** Start a project: a first program, and typings so your editor knows machin's modules. */
async function create(dir: string) {
  if (!dir) throw new Stop(USAGE, 2);
  const entries = await Array.fromAsync(Deno.readDir(dir)).catch(() => []);
  if (entries.length) throw new Stop(`${dir} is not empty`, 2);
  await Deno.mkdir(join(dir, ".machin-js", "types"), { recursive: true });
  for (const f of ["machin.d.ts", "machweb.d.ts", "desktop.d.ts", "globals.d.ts"]) {
    await Deno.writeTextFile(join(dir, ".machin-js", "types", f), await shipped(`types/${f}`));
  }
  const config = {
    compilerOptions: {
      checkJs: true, strict: true, noEmit: true, target: "ES2022", module: "ESNext", moduleResolution: "bundler",
      lib: ["ES2022"], types: [], baseUrl: ".machin-js/types",
      paths: { machin: ["machin.d.ts"], "machin/web": ["machweb.d.ts"], "machin/desktop": ["desktop.d.ts"] },
    },
    include: ["**/*.js", ".machin-js/types/globals.d.ts"],
  };
  await Deno.writeTextFile(join(dir, "jsconfig.json"), JSON.stringify(config, null, 2) + "\n");
  await Deno.writeTextFile(join(dir, "main.js"), STARTER);
  await Deno.writeTextFile(join(dir, ".gitignore"), `${basename(resolve(dir))}\n`);
  console.log(`created ${dir}\n  cd ${dir}\n  machin-js run main.js`);
}

/** Dispatch one command line; returns the exit code. */
export async function cli(argv: string[]): Promise<number> {
  const dashes = argv.indexOf("--");
  const own = dashes < 0 ? argv : argv.slice(0, dashes);
  const rest = dashes < 0 ? [] : argv.slice(dashes + 1);
  const [command, target, ...options] = own;
  const known = command === "build" ? options.length === 0 || (options.length === 2 && options[0] === "-o")
    : command === "debug" ? options.every((o) => o === "--inspect-brk") : options.length === 0;
  if (!known) throw new Stop(`unknown option for ${command}: ${options.join(" ")}\n\n${USAGE}`, 2);
  switch (command) {
    case "new": await create(target); return 0;
    case "check": await analyse(target); console.log("ok"); return 0;
    case "build": {
      const output = options[1] ?? basename(dirname(resolve(target ?? "main.js")));
      await build(target, output);
      console.log(`built ${output}`);
      return 0;
    }
    case "run": return await run(target, rest);
    case "debug": return await debug(target, rest, options.includes("--inspect-brk"));
    case "version": case "--version": console.log(VERSION); return 0;
    case "help": case "--help": case undefined: console.log(USAGE); return 0;
    default: throw new Stop(`unknown command: ${command}\n\n${USAGE}`, 2);
  }
}

if (import.meta.main) {
  try {
    Deno.exit(await cli(Deno.args));
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    console.error(e.message);
    Deno.exit(e.code);
  }
}
