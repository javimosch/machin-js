// machin-js transpiler: JSDoc-typed JS subset -> machin loose .src
//why: one-directional on purpose; machin core is untouched, we only emit text
//     that `machin encode` already accepts.
import * as acorn from "npm:acorn@8.14.0";
import { dirname, basename, resolve } from "jsr:@std/path@1";

export type Diag = { code: string; msg: string; file: string; line: number };
type Cmt = { block: boolean; text: string; start: number; end: number };
type Ctx = { file: string; src: string; cmts: Cmt[]; diags: Diag[]; retElem: string; fns: Set<string>; imported: Set<string>; scope: Set<string> };
type Imp = { source: string; names: string[]; line: number };
const GLOBALS = new Set(["String", "console"]);

const MAX_LINES = 20;
const PREC: Record<string, number> = { "||": 1, "&&": 2, "==": 3, "===": 3, "!=": 3, "!==": 3,
  "<": 4, ">": 4, "<=": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6 };

/** Record a diagnostic at a node's line. */
function diag(c: Ctx, code: string, msg: string, n: any): string {
  //why: emit a placeholder and keep going, so one run reports every problem.
  c.diags.push({ code, msg, file: c.file, line: n?.loc?.start.line ?? 0 });
  return "/*error*/";
}

/** MFL string literal for a JS string value. */
function str(v: string): string {
  //why: built from the value, not the raw source, so JS escapes can't leak through.
  return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
}

/** Emit `{a: int, b: string}` typedefs found in any block comment as structs. */
function typedefs(c: Ctx): string[] {
  const out: string[] = [];
  for (const m of c.cmts.filter((x) => x.block)) {
    const t = /@typedef\s+\{\{(.*?)\}\}\s*(\w+)/s.exec(m.text);
    if (!t) continue;
    const fields = t[1].split(",").map((f) => f.trim().split(/\s*:\s*/)).map(([n, ty]) => `${n} ${ty}`);
    out.push(`type ${t[2]} struct { ${fields.join("  ")} }`);
  }
  return out;
}

/** The JSDoc block directly above a function, or null. */
function docOf(c: Ctx, fn: any): string | null {
  //why: for `export function`, the doc sits above the `export` keyword, not the `function` one.
  const at = fn.docStart ?? fn.start;
  const m = c.cmts.find((x) => x.block && x.text.startsWith("*") && x.end <= at
    && c.src.slice(x.end, at).trim() === "");
  return m ? m.text : null;
}

/** Element type of `@returns {T[]}`, else "". */
function retElem(doc: string): string {
  const m = /@returns\s+\{([^}]*)\}/.exec(doc);
  return m && m[1].endsWith("[]") ? m[1].slice(0, -2) : "";
}

/** Check the human-readability rules for one function. */
function lint(c: Ctx, fn: any, doc: string | null) {
  //why: the rules are the product — they keep agent-written code readable by a human.
  if (!doc) diag(c, "JS-DOC001", `function ${fn.id.name} has no JSDoc block`, fn);
  const why = c.cmts.some((x) => !x.block && x.start > fn.body.start && x.end < fn.body.end
    && x.text.trim().startsWith("why:"));
  if (!why) diag(c, "JS-WHY001", `function ${fn.id.name} has no //why: comment`, fn);
  const n = fn.loc.end.line - fn.loc.start.line + 1;
  if (n > MAX_LINES) diag(c, "JS-SIZE001", `function ${fn.id.name} is ${n} lines (max ${MAX_LINES})`, fn);
}

/** Emit an expression; `p` is the parent's precedence, for minimal parens. */
function expr(c: Ctx, e: any, p = 0): string {
  switch (e.type) {
    case "Literal": return typeof e.value === "string" ? str(e.value) : String(e.value);
    case "Identifier":
      //why: machin functions are not values; the typecheck error for this is cryptic, so catch it here.
      if (!c.scope.has(e.name)) return diag(c, "JS-UNDEF001", `${e.name} is not defined or imported`, e);
      if (c.fns.has(e.name) || c.imported.has(e.name)) return diag(c, "JS-FNVAL001", `${e.name} is a function; pass an arrow: (x) => ${e.name}(x)`, e);
      return e.name;
    case "ArrowFunctionExpression":
      if (e.body.type === "BlockStatement") return diag(c, "JS-UNSUP001", "arrow with block body unsupported; use an expression body", e);
      e.params.forEach((x: any) => c.scope.add(x.name));
      return `func(${e.params.map((x: any) => x.name).join(", ")}) { return ${expr(c, e.body)} }`;
    case "MemberExpression":
      if (!e.computed && e.property.name === "length") return `len(${expr(c, e.object)})`;
      return e.computed ? `${expr(c, e.object)}[${expr(c, e.property)}]` : `${expr(c, e.object)}.${e.property.name}`;
    case "UnaryExpression": return `${e.operator}${expr(c, e.argument, 9)}`;
    case "BinaryExpression": case "LogicalExpression": {
      const q = PREC[e.operator];
      if (!q) return diag(c, "JS-UNSUP001", `operator ${e.operator} unsupported`, e);
      const op = e.operator === "===" ? "==" : e.operator === "!==" ? "!=" : e.operator;
      const s = `${expr(c, e.left, q)} ${op} ${expr(c, e.right, q + 1)}`;
      return q < p ? `(${s})` : s;
    }
    case "ArrayExpression": {
      const t = e.elements[0]?.type === "Literal" ? "string" : e.elements[0] ? "string" : "string";
      return `[]${t}{${e.elements.map((x: any) => expr(c, x)).join(", ")}}`;
    }
    case "CallExpression": return call(c, e);
    default: return diag(c, "JS-UNSUP001", `${e.type} unsupported`, e);
  }
}

/** Emit a call, mapping JS builtins to machin ones. */
function call(c: Ctx, e: any): string {
  const f = e.callee;
  let name = f.type === "Identifier" ? f.name : "";
  if (f.type === "MemberExpression" && f.object.name === "console" && f.property.name === "log") name = "println";
  if (!name) return diag(c, "JS-UNSUP001", "only plain function calls are supported", e);
  if (!c.scope.has(name) && !GLOBALS.has(name) && name !== "println")
    return diag(c, "JS-UNDEF001", `${name} is not defined or imported`, e);
  if (name === "String") name = "str";
  const args = e.arguments.map((a: any) => expr(c, a));
  //why: `parse(x, [])` needs a typed witness; it comes from the function's @returns.
  if (name === "parse" && e.arguments[1]?.type === "ArrayExpression" && c.retElem) args[1] = `[]${c.retElem}{}`;
  return `${name}(${args.join(", ")})`;
}

/** Emit one statement as lines. */
function stmt(c: Ctx, s: any): string[] {
  switch (s.type) {
    case "VariableDeclaration": return s.declarations.flatMap((d: any) => decl(c, d));
    case "ExpressionStatement": return [assignOrExpr(c, s.expression)];
    case "ReturnStatement": return [s.argument ? `return ${expr(c, s.argument)}` : "return"];
    case "IfStatement": return ifs(c, s);
    case "WhileStatement": return [`while ${expr(c, s.test)} {`, ...block(c, s.body), "}"];
    case "ForStatement": return forLoop(c, s);
    case "BreakStatement": return ["break"];
    default: return [diag(c, "JS-UNSUP001", `${s.type} unsupported`, s)];
  }
}

/** `const x = v`, with `c ? a : b` lowered to init-else-then-override. */
function decl(c: Ctx, d: any): string[] {
  const name = d.id.name;
  if (d.init?.type !== "ConditionalExpression") return [`${name} := ${expr(c, d.init)}`];
  const k = d.init;
  //why: else-branch is evaluated eagerly, so it must be a literal or identifier.
  if (k.alternate.type !== "Literal" && k.alternate.type !== "Identifier")
    return [diag(c, "JS-UNSUP001", "ternary else-branch must be a literal or identifier", k)];
  return [`${name} := ${expr(c, k.alternate)}`, `if ${expr(c, k.test)} { ${name} = ${expr(c, k.consequent)} }`];
}

/** Assignments (`=`, `+=`, `++`) or a bare call. */
function assignOrExpr(c: Ctx, e: any): string {
  if (e.type === "AssignmentExpression") {
    const t = expr(c, e.left);
    return e.operator === "=" ? `${t} = ${expr(c, e.right)}` : `${t} = ${t} ${e.operator[0]} ${expr(c, e.right, 5)}`;
  }
  if (e.type === "UpdateExpression") return `${expr(c, e.argument)} = ${expr(c, e.argument)} ${e.operator[0]} 1`;
  return expr(c, e);
}

/** if / else if / else. */
function ifs(c: Ctx, s: any): string[] {
  const out = [`if ${expr(c, s.test)} {`, ...block(c, s.consequent)];
  if (s.alternate) out.push("} else {", ...block(c, s.alternate));
  return [...out, "}"];
}

/** `for(init;test;update)` -> init + while with the update appended. */
function forLoop(c: Ctx, s: any): string[] {
  //why: machin has only `while`; `continue` is rejected since it would skip the update.
  const body = block(c, s.body);
  if (body.some((l) => l.trim() === "continue")) return [diag(c, "JS-UNSUP001", "continue inside for", s)];
  return [...stmt(c, s.init), `while ${expr(c, s.test)} {`, ...body, assignOrExpr(c, s.update), "}"];
}

/** Statements of a block or single statement, indented. */
function block(c: Ctx, b: any): string[] {
  const list = b.type === "BlockStatement" ? b.body : [b];
  return list.flatMap((x: any) => stmt(c, x)).map((l: string) => "    " + l);
}

/** Does the function return a value anywhere? */
function returnsValue(n: any): boolean {
  if (!n || typeof n !== "object") return false;
  if (n.type === "ReturnStatement") return !!n.argument;
  return Object.values(n).some((v) => Array.isArray(v) ? v.some(returnsValue) : returnsValue(v));
}

/** Collect every `const`/`let` name declared anywhere inside n. */
function locals(n: any, out: Set<string>): Set<string> {
  if (!n || typeof n !== "object") return out;
  if (n.type === "VariableDeclarator") out.add(n.id.name);
  for (const v of Object.values(n)) Array.isArray(v) ? v.forEach((x) => locals(x, out)) : locals(v, out);
  return out;
}

/** Emit a function declaration. */
function func(c: Ctx, fn: any): string[] {
  //why: a name is visible only if declared here, in this module, or imported — no ambient globals.
  c.scope = new Set([...c.fns, ...c.imported, ...fn.params.map((p: any) => p.name), ...locals(fn.body, new Set())]);
  const doc = docOf(c, fn);
  lint(c, fn, doc);
  c.retElem = doc ? retElem(doc) : "";
  const res = returnsValue(fn.body) ? " (r)" : "";
  const ps = fn.params.map((p: any) => p.name).join(", ");
  return [`func ${fn.id.name}(${ps})${res} {`, ...block(c, fn.body), "}", ""];
}

export type Mod = { out: string; diags: Diag[]; imports: Imp[]; exports: Set<string>; fns: Set<string>; deps: string[] };

/** Transpile one JS source file (an ES module). */
export function transpile(file: string, src: string): Mod {
  const cmts: Cmt[] = [];
  const ast: any = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true,
    onComment: (block: boolean, text: string, start: number, end: number) => cmts.push({ block, text, start, end }) });
  const imports: Imp[] = [], exports = new Set<string>(), decls: any[] = [], imported = new Set<string>();
  for (const n of ast.body) {
    if (n.type === "ImportDeclaration") {
      imports.push({ source: n.source.value, names: n.specifiers.map((x: any) => x.imported.name), line: n.loc.start.line });
      n.specifiers.forEach((x: any) => imported.add(x.local.name));
    } else if (n.type === "ExportNamedDeclaration" && n.declaration?.type === "FunctionDeclaration") {
      exports.add(n.declaration.id.name); n.declaration.docStart = n.start; decls.push(n.declaration);
    } else decls.push(n);
  }
  const fns = new Set<string>(decls.filter((n) => n.type === "FunctionDeclaration").map((n) => n.id.name));
  const c: Ctx = { file, src, cmts, diags: [], retElem: "", fns, imported, scope: new Set() };
  const lines = [...typedefs(c)];
  for (const n of decls) {
    if (n.type === "FunctionDeclaration") lines.push(...func(c, n));
    else lines.push(diag(c, "JS-UNSUP001", `top-level ${n.type} unsupported`, n));
  }
  //why: `@typedef {import("./model.js").Todo} Todo` is the JS way to name a type from another file;
  //     it also tells us the dependency, so type-only modules (model.js) still get emitted.
  const deps = cmts.filter((x) => x.block).flatMap((x) => [...x.text.matchAll(/import\(["'](\.[^"']+)["']\)/g)].map((m) => m[1]));
  return { out: lines.join("\n").trimEnd() + "\n", diags: c.diags, imports, exports, fns, deps };
}

/** Names exported by a hand-kept typings file in types/. */
async function dtsNames(file: string): Promise<Set<string>> {
  const t = await Deno.readTextFile(new URL(`../types/${file}`, import.meta.url));
  return new Set([...t.matchAll(/export (?:function|type) (\w+)/g)].map((m) => m[1]));
}

/** Bridge modules: JS import name -> its typings and the machin .src it needs in the build. */
function bridges(): Record<string, { dts: string; src: string }> {
  const fw = Deno.env.get("MACHIN_FRAMEWORK") ?? `${Deno.env.get("HOME")}/ai/machin/framework`;
  return {
    "machin/web": { dts: "machweb.d.ts", src: `${fw}/machweb.src` },
    "machin/desktop": { dts: "desktop.d.ts", src: new URL("../bindings/desktop.src", import.meta.url).pathname },
  };
}

/** Follow imports from `entry`; return modules in dependency order, plus every diagnostic. */
export async function buildGraph(entry: string): Promise<{ order: { path: string; out: string }[]; native: string[]; diags: Diag[] }> {
  const builtins = new Set<string>(JSON.parse(await Deno.readTextFile(new URL("../types/machin-builtins.json", import.meta.url))));
  const br = bridges();
  const bnames = new Map<string, Set<string>>();
  for (const [k, v] of Object.entries(br)) bnames.set(k, await dtsNames(v.dts));
  const native = new Set<string>();
  const mods = new Map<string, Mod>(), order: { path: string; out: string }[] = [], diags: Diag[] = [];
  const stack: string[] = [];
  const add = (file: string, line: number, code: string, msg: string) => diags.push({ code, msg, file, line });

  async function visit(path: string, from?: string) {
    if (mods.has(path)) return;
    if (stack.includes(path)) return add(from ?? path, 1, "JS-CYCLE001", `import cycle: ${[...stack, path].map((p) => basename(p)).join(" -> ")}`);
    stack.push(path);
    const m = transpile(path, await Deno.readTextFile(path));
    diags.push(...m.diags);
    const rel = (src: string) => resolve(dirname(path), src);
    const relative = [...m.imports.filter((i) => i.source.startsWith(".")).map((i) => i.source), ...m.deps];
    for (const src of relative) await visit(rel(src), path);
    for (const i of m.imports) check(path, i, m);
    mods.set(path, m); order.push({ path, out: m.out });
    stack.pop();
  }
  /** Validate one import: the module exists and exports every name asked for. */
  function check(path: string, i: Imp, _m: Mod) {
    if (br[i.source]) native.add(br[i.source].src);
    const known = i.source === "machin" ? builtins : bnames.get(i.source)
      ?? (i.source.startsWith(".") ? mods.get(resolve(dirname(path), i.source))?.exports : null);
    if (!known) return add(path, i.line, "JS-IMPORT002", `unknown module "${i.source}"`);
    for (const n of i.names) if (!known.has(n)) add(path, i.line, "JS-IMPORT001", `"${i.source}" has no export ${n}`);
  }
  await visit(resolve(entry));
  //why: machin has one flat namespace, so two modules defining the same function name would clash.
  const seen = new Map<string, string>();
  for (const [p, m] of mods) for (const f of m.fns) {
    if (seen.has(f)) add(p, 1, "JS-DUP001", `function ${f} is also defined in ${basename(seen.get(f)!)} (machin has one namespace)`);
    seen.set(f, p);
  }
  return { order, native: [...native], diags };
}

if (import.meta.main) {
  //why: CLI = `transpile out_dir entry.js`; writes one .src per module in dependency order
  //     plus order.txt; any diagnostic fails the run (exit 1).
  const [outDir, entry] = Deno.args;
  await Deno.mkdir(outDir, { recursive: true });
  const { order, native, diags } = await buildGraph(entry);
  diags.forEach((d) => console.error(`${d.file}:${d.line}: ${d.code} ${d.msg}`));
  const names = order.map((o) => basename(o.path).replace(/\.js$/, ""));
  for (const [i, o] of order.entries()) await Deno.writeTextFile(`${outDir}/${names[i]}.src`, o.out);
  await Deno.writeTextFile(`${outDir}/order.txt`, names.join("\n") + "\n");
  //why: native.txt = binding/framework .src files this program needs, to be encoded before the modules.
  await Deno.writeTextFile(`${outDir}/native.txt`, native.join("\n") + (native.length ? "\n" : ""));
  Deno.exit(diags.length ? 1 : 0);
}
