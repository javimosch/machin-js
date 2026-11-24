// machin-js transpiler: JSDoc-typed JS subset -> machin loose .src
//why: one-directional on purpose; machin core is untouched, we only emit text
//     that `machin encode` already accepts.
import * as acorn from "npm:acorn@8.14.0";

export type Diag = { code: string; msg: string; file: string; line: number };
type Cmt = { block: boolean; text: string; start: number; end: number };
type Ctx = { file: string; src: string; cmts: Cmt[]; diags: Diag[]; retElem: string; fns: Set<string> };

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
  const m = c.cmts.find((x) => x.block && x.text.startsWith("*") && x.end <= fn.start
    && c.src.slice(x.end, fn.start).trim() === "");
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
      if (c.fns.has(e.name)) return diag(c, "JS-FNVAL001", `${e.name} is a function; pass an arrow: (x) => ${e.name}(x)`, e);
      return e.name;
    case "ArrowFunctionExpression":
      if (e.body.type === "BlockStatement") return diag(c, "JS-UNSUP001", "arrow with block body unsupported; use an expression body", e);
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

/** Emit a function declaration. */
function func(c: Ctx, fn: any): string[] {
  const doc = docOf(c, fn);
  lint(c, fn, doc);
  c.retElem = doc ? retElem(doc) : "";
  const res = returnsValue(fn.body) ? " (r)" : "";
  const ps = fn.params.map((p: any) => p.name).join(", ");
  return [`func ${fn.id.name}(${ps})${res} {`, ...block(c, fn.body), "}", ""];
}

/** Transpile one JS source file. */
export function transpile(file: string, src: string): { out: string; diags: Diag[] } {
  const cmts: Cmt[] = [];
  const ast: any = acorn.parse(src, { ecmaVersion: "latest", sourceType: "script", locations: true,
    onComment: (block: boolean, text: string, start: number, end: number) => cmts.push({ block, text, start, end }) });
  const fns = new Set<string>(ast.body.filter((n: any) => n.type === "FunctionDeclaration").map((n: any) => n.id.name));
  const c: Ctx = { file, src, cmts, diags: [], retElem: "", fns };
  const lines = [...typedefs(c)];
  for (const n of ast.body) {
    if (n.type === "FunctionDeclaration") lines.push(...func(c, n));
    else lines.push(diag(c, "JS-UNSUP001", `top-level ${n.type} unsupported`, n));
  }
  return { out: lines.join("\n").trimEnd() + "\n", diags: c.diags };
}

if (import.meta.main) {
  //why: CLI = `transpile out_dir file.js...`; any diagnostic fails the run (exit 1).
  const [outDir, ...files] = Deno.args;
  await Deno.mkdir(outDir, { recursive: true });
  let bad = 0;
  for (const f of files) {
    const r = transpile(f, await Deno.readTextFile(f));
    r.diags.forEach((d) => { bad++; console.error(`${d.file}:${d.line}: ${d.code} ${d.msg}`); });
    await Deno.writeTextFile(`${outDir}/${f.split("/").pop()!.replace(/\.js$/, ".src")}`, r.out);
  }
  Deno.exit(bad ? 1 : 0);
}
