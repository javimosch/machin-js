// Conformance with cli-output-spec and cli-guide-spec, checked against the running program.
// Usage: deno run -A test/conform.ts <program...>     (the schemas in spec/ are the specs' own files)
//why: "follows the spec" should be a test result, not a claim in a README.
import Ajv from "npm:ajv@8.17.1/dist/2020.js";
import errorSchema from "./spec/error.schema.json" with { type: "json" };
import guideSchema from "./spec/guide.schema.json" with { type: "json" };

const program = Deno.args;
if (!program.length) throw new Error("usage: conform.ts <program...>");
const dir = await Deno.makeTempDir();
const failures: string[] = [];
let checks = 0;
const check = (ok: unknown, what: string) => {
  checks++;
  if (!ok) failures.push(what);
};

/** Run jot with closed stdin and a time limit: a prompt would hang and fail. */
async function jot(args: string[], db = "main.db") {
  const r = await new Deno.Command(program[0], {
    args: [...program.slice(1), ...args], env: { JOT_DB: `${dir}/${db}` }, stdin: "null",
    stdout: "piped", stderr: "piped", signal: AbortSignal.timeout(30_000),
  }).output();
  return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
}
const parse = (text: string) => {
  try { return JSON.parse(text); } catch { return null; }
};
const oneLine = (text: string) => text.endsWith("\n") && !text.slice(0, -1).includes("\n");

// the guide's schema names its tool-name key literally "<tool>"; PROTOCOL.md §1 says it is the tool's name
const ajv = new Ajv({ strict: false });
const validError = ajv.compile(errorSchema);
const validGuide = ajv.compile(JSON.parse(JSON.stringify(guideSchema).replaceAll('"<tool>"', '"jot"')));
const seen = new Set<number>([0]);

/** output §1 and §5: success is exit 0, one JSON object on stdout, nothing on stderr. */
async function success(args: string[]) {
  const r = await jot(args), body = parse(r.out), name = `jot ${args.join(" ")}`;
  check(r.code === 0, `${name}: exit ${r.code} ${r.err}`);
  check(r.err === "", `${name}: wrote to stderr: ${r.err}`);
  check(body && oneLine(r.out), `${name}: stdout is not one line of JSON: ${r.out.slice(0, 200)}`);
  check(!(r.out + r.err).includes("\x1b"), `${name}: ANSI escape`);
  return body;
}

/** output §2 and §3: typed errors, matching exit codes, empty stdout. */
async function failure(args: string[], code: number, type: string) {
  const r = await jot(args), body = parse(r.err), name = `jot ${JSON.stringify(args)}`;
  seen.add(r.code);
  check(r.code === code, `${name}: exit ${r.code}, want ${code}: ${r.err}`);
  check(r.out === "", `${name}: wrote to stdout on failure: ${r.out}`);
  check(body && oneLine(r.err), `${name}: stderr is not one JSON object: ${r.err}`);
  check(body && validError(body), `${name}: not the error schema: ${JSON.stringify(validError.errors)}`);
  check(body?.error.code === r.code && body?.error.type === type, `${name}: code/type ${body?.error.code}/${body?.error.type}`);
  check(body?.error.recoverable === (r.code >= 100 && r.code < 110), `${name}: recoverable doesn't match its range`);
}

for (const args of [["add", "first"], ["add", "second", "--tag", "x", "--json", "--yes"], ["list"], ["list", "--all", "-y", "--no-interactive"], ["show", "1"], ["done", "1"], ["rm", "2"], ["version"]]) {
  const body = await success(args);
  check(body?.ok === true && body?.version === "1.0", `jot ${args[0]}: no ok/version envelope`);
}
await failure([], 80, "invalid_arguments");
await failure(["frobnicate"], 80, "invalid_arguments");
await failure(["list", "--bogus"], 80, "invalid_arguments");
await failure(["add", "a", "b"], 80, "invalid_arguments");
await failure(["add"], 82, "missing_argument");
await failure(["add", ""], 82, "missing_argument");
await failure(["add", "x", "--tag"], 82, "missing_argument");
await failure(["show", "3abc"], 85, "invalid_value");
await failure(["show", "99999999999999999999"], 85, "invalid_value");
await failure(["add", "two\nlines"], 85, "invalid_value");
await failure(["add", "tab\there"], 85, "invalid_value");
await failure(["add", "x".repeat(201)], 85, "invalid_value");
await failure(["add", "ok", "--tag", "x".repeat(51)], 85, "invalid_value");
await failure(["show", "999"], 92, "not_found");
await failure(["rm", "999"], 92, "not_found");
await failure(["done", "999"], 92, "not_found");
await failure(["done", "1"], 95, "already_done");

// hostile text is data: it comes back unchanged and deletes nothing
for (const title of ["x'); DROP TABLE tasks;--", 'quotes " and \\ backslash', "café ☃ 100% <b>&", "-dash"]) {
  const added = await success(["add", "--", title]);
  check(added?.task.title === title, `title changed: ${JSON.stringify(title)} -> ${JSON.stringify(added?.task.title)}`);
}
check((await success(["list", "--all"]))?.count === 5, "count after hostile titles");
const text = await jot(["list", "--all", "--text"]);
check(text.code === 0 && text.out.trimEnd().split("\n").every((l) => l.split("\t").length === 4), `--text isn't 4 columns: ${text.out}`);
check((await jot(["list", "--tag", "nothing", "--text"])).out === "", "an empty list in text mode should print nothing");

// output §4: help-json lists every command, each one is accepted, and every exit code is named
const help = await success(["help-json"]);
check(help?.output === "json" && help?.commands?.guide, "help-json: output/guide missing");
for (const [name, spec] of Object.entries<{ args: string[]; flags: string[]; auth: boolean }>(help?.commands ?? {})) {
  const flags = spec.flags.flatMap((f) => f.includes(" ") ? [f.split(" ")[0], "v"] : [f]);
  const r = await jot([name, ...spec.args.map(() => "1"), ...flags], `catalog-${name}.db`);
  check(![80, 82].includes(r.code), `help-json lists ${name} ${flags.join(" ")}, but it is refused: ${r.err}`);
  check(spec.auth === false, `${name}: auth`);
}
for (const code of seen) check(help?.exit_codes?.[String(code)], `exit code ${code} is not in help-json`);
check(JSON.stringify(await success(["--help-json"])) === JSON.stringify(help), "--help-json differs from help-json");

// cli-guide-spec: schema, version, advertised, embedded, --human, and examples that really run
const reply = await success(["guide"]);
const guide = reply?.guide;
check(guide && validGuide(guide), `guide: not the guide schema: ${JSON.stringify(validGuide.errors)}`);
const version = (await success(["version"]))?.build;
check(guide?.version === version && help?.version === version, "guide, help-json and version disagree");
const usages: string[] = Object.values<string[]>(guide?.commands ?? {}).flat();
for (const name of Object.keys(help?.commands ?? {})) check(usages.some((u) => u.startsWith(`jot ${name}`)), `guide doesn't list ${name}`);
const human = await jot(["guide", "--human"]);
check(human.code === 0 && human.err === "" && human.out.startsWith("# jot"), "guide --human");
for (const needle of [...usages, ...(guide?.gotchas ?? []), ...(guide?.loop ?? [])]) check(human.out.includes(needle), `--human lacks: ${needle}`);
for (const example of guide?.examples ?? []) {
  for (const line of example.do as string[]) {
    // a fresh database for the whole guide, so the ids the examples mention are the ids they get
    const script = line.replace(/^jot /, `${program.map((p) => `'${p}'`).join(" ")} `);
    const r = await new Deno.Command("sh", { args: ["-c", script], env: { JOT_DB: `${dir}/examples.db` }, stdin: "null" }).output();
    check(r.code === 0, `guide example fails: ${line}: ${new TextDecoder().decode(r.stderr)}`);
  }
}

await Deno.remove(dir, { recursive: true });
console.log(failures.length ? failures.join("\n") + `\nFAILED: ${failures.length} of ${checks} checks` : `conforms: ${checks} checks passed`);
Deno.exit(failures.length ? 1 : 0);
