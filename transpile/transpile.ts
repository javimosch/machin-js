// machin-js transpiler: JSDoc-typed JS subset -> machin loose .src
//why: one-directional on purpose; machin core is untouched, we only emit text
//     that `machin encode` already accepts.
import * as acorn from "npm:acorn@8.14.0";
import { program, typeErrors } from "./typecheck.ts";
import { Types } from "./types.ts";
import { pushProblems } from "./ownership.ts";
import { GUARD_MODULE, guardModule } from "./guards.ts";
import { dirname, basename, resolve } from "jsr:@std/path@1";

export type Diag = { code: string; msg: string; file: string; line: number };
type Cmt = { block: boolean; text: string; start: number; end: number };
type Ctx = { file: string; src: string; cmts: Cmt[]; diags: Diag[]; typed: Diag[]; types: Types; guards: Set<string>; stable: Set<string>; arrow: Set<string> | null; fns: Set<string>; imported: Set<string>; builtins: Set<string>; scope: Set<string> };
type Imp = { source: string; names: string[]; line: number };
const GLOBALS = new Set(["String", "console"]);

const MAX_LINES = 20;
//why: allow-list — only operators proven to mean the same in both languages. `/` is absent
//     because machin divides integers (7 / 2 == 3). All comparisons share one level so that
//     parentheses survive: machin ranks == and < equally, JavaScript does not.
const PREC: Record<string, number> = { "||": 1, "&&": 2, "==": 4, "===": 4, "!=": 4, "!==": 4,
  "<": 4, ">": 4, "<=": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "%": 6 };
const ASSIGN = new Set(["=", "+=", "-=", "*=", "%="]);

/** Record a diagnostic at a node's line. */
function diag(c: Ctx, code: string, msg: string, n: any): string {
  //why: emit a placeholder and keep going, so one run reports every problem.
  c.diags.push({ code, msg, file: c.file, line: n?.loc?.start.line ?? 0 });
  return "/*error*/";
}

/** MFL string literal for a JS string value. */
function str(v: string): string {
  //why: built from the value, not the raw source, so JS escapes can't leak through.
  return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
}

/** A JSDoc field type in machin's spelling: `boolean` -> `bool`, `string[]` -> `[]string`. */
function fieldType(t: string): string {
  //why: a map inside a struct isn't covered; leave it to be reported by the type spelling.
  if (t.endsWith("[]")) return `[]${fieldType(t.slice(0, -2))}`;
  return t === "boolean" ? "bool" : t === "number" ? "int" : t;
}

/** Emit `{a: int, b: string}` typedefs found in any block comment as structs. */
function typedefs(c: Ctx): string[] {
  const out: string[] = [];
  for (const m of c.cmts.filter((x) => x.block)) {
    const t = /@typedef\s+\{\{(.*?)\}\}\s*(\w+)/s.exec(m.text);
    if (!t) continue;
    const fields = t[1].split(",").map((f) => f.trim().split(/\s*:\s*/)).map(([n, ty]) => `${n} ${fieldType(ty)}`);
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

const SCALARS = new Set(["int", "string", "bool"]);
const BUILTINS = new Set<string>(JSON.parse(Deno.readTextFileSync(new URL("../types/machin-builtins.json", import.meta.url))));

/** Record a diagnostic that rests on type information. */
function typeDiag(c: Ctx, code: string, msg: string, n: any): string {
  //why: kept apart: on code already rejected, types are unreliable and would only add noise.
  c.typed.push({ code, msg, file: c.file, line: n?.loc?.start.line ?? 0 });
  return "/*error*/";
}

/** Report `code` unless the type is acceptable; an unknown type gets its own message. */
function require(c: Ctx, ok: boolean, kinds: string[], code: string, msg: string, n: any): boolean {
  if (ok) return true;
  //why: when the type is unknown we cannot prove the translation safe, so we refuse.
  if (kinds.includes("any")) typeDiag(c, "JS-ANY001", "the type here is unknown; add a JSDoc type", n);
  else typeDiag(c, code, msg, n);
  return false;
}

/** `+` must be number+number or string+string: machin has no implicit conversion. */
function checkAdd(c: Ctx, left: any, right: any, n: any) {
  const a = c.types.kind(left), b = c.types.kind(right);
  require(c, a === b && (a === "int" || a === "string"), [a, b], "JS-ADD001",
    `cannot add ${a} and ${b}; convert with String(x)`, n);
}

/** Only numbers, strings and booleans may be compared with == or printed. */
function checkScalar(c: Ctx, x: any, code: string, what: string) {
  const k = c.types.kind(x);
  require(c, SCALARS.has(k), [k], code, `${what} an ${k} does not behave the same natively`, x);
}

/** Is this JSON text written by the program itself: constants plus String(number | boolean)? */
function authored(c: Ctx, x: any): boolean {
  if (x.type === "Literal") return typeof x.value === "string";
  if (x.type === "BinaryExpression") return x.operator === "+" && authored(c, x.left) && authored(c, x.right);
  const plain = (a: any) => a && ["int", "bool"].includes(c.types.kind(a));
  if (x.type === "TemplateLiteral") return x.expressions.every(plain);
  return x.type === "CallExpression" && x.callee.name === "String" && plain(x.arguments[0]);
}

/** `parse` is only the same in both runtimes on JSON whose shape the program controls. */
function checkParseInput(c: Ctx, x: any) {
  const rows = x.type === "CallExpression" && x.callee.name === "sqlite_query" && c.builtins.has("sqlite_query");
  //why: machin's parse never fails (bad or mistyped input silently becomes empty values), while
  //     JSON.parse throws or keeps the wrong types — so outside input is refused.
  if (!rows && !authored(c, x))
    typeDiag(c, "JS-JSON001", `parse only accepts sqlite_query(...) or JSON your code builds; read outside JSON field by field with "machin/json"`, x);
}

/** Reading it twice, or at another moment, can't change anything: no calls, no list reads. */
function steady(x: any): boolean {
  if (x.type === "Literal" || x.type === "Identifier") return true;
  if (x.type === "MemberExpression") return !x.computed && steady(x.object);
  if (x.type === "UnaryExpression") return steady(x.argument);
  return x.type === "BinaryExpression" && steady(x.left) && steady(x.right);
}

//why: builtins that only compute a value from their arguments. Everything else that is called —
//     your functions, callbacks, other builtins — is assumed to change things.
const PURE = new Set(["len", "substr", "index", "contains", "has_prefix", "parse_int", "trim", "split", "replace",
  "url_decode", "url_encode", "json_valid", "json_has", "json_is_string", "json_string", "json_is_int", "json_int",
  "json_is_bool", "json_bool", "text_length", "pad_end", "pad_start"]);

/** Could evaluating this change anything? */
function calls(c: Ctx, x: any): boolean {
  if (!x || typeof x !== "object") return false;
  if (x.type === "CallExpression" && !isPure(c, x)) return true;
  return Object.values(x).some((v) => Array.isArray(v) ? v.some((y) => calls(c, y)) : calls(c, v));
}

/** String(x), Math.trunc(a / b), reading a Map, or an imported builtin from the list above. */
function isPure(c: Ctx, x: any): boolean {
  const f = x.callee;
  //why: a name counts only if it is the import itself; a local variable of that name is not.
  if (f.type === "Identifier") return (f.name === "String" && !c.scope.has("String")) || (PURE.has(f.name) && c.imported.has(f.name));
  return f.object?.name === "Math" || ["get", "has"].includes(mapMethod(c, x));
}

/** A store `a[key] = value` or `m.set(key, value)`: neither side may be able to affect the other. */
function checkStoreOrder(c: Ctx, key: any, value: any, n: any) {
  //why: machin doesn't promise JavaScript's order (key, then value). It can't matter if one side
  //     is made of plain variables, or if neither side calls anything.
  if (steady(key) || steady(value) || (!calls(c, key) && !calls(c, value))) return;
  diag(c, "JS-ORDER001", "put the key or index in a variable first, then use it in the store", n);
}

/** Element updates: refuse the shapes where the two runtimes evaluate in a different way. */
function checkElementOrder(c: Ctx, target: any, value: any, twice: boolean) {
  if (target.type !== "MemberExpression" || !target.computed) return;
  if (steady(target.object) && steady(target.property)) return;
  //why: `a[i] += x` and `a[i]++` are written as `a[i] = a[i] + x`, which evaluates i twice.
  if (twice) diag(c, "JS-ORDER001", "put the index in a variable first: const i = ...; then use a[i]", target);
  else checkStoreOrder(c, target.property, value, target);
}

/** With two or more arguments, console.log reads a string first argument as a format string. */
function checkLogFormat(c: Ctx, args: any[]) {
  if (args.length < 2) return;
  const first = args[0], kind = c.types.kind(first);
  if (kind === "int" || kind === "bool") return;
  if (first.type === "Literal" && typeof first.value === "string" && !first.value.includes("%")) return;
  //why: String(number | boolean) can never contain %.
  const stringified = first.type === "CallExpression" && first.callee.name === "String"
    && ["int", "bool"].includes(c.types.kind(first.arguments[0] ?? first));
  if (!stringified)
    typeDiag(c, "JS-LOG001", "console.log would read % codes in this first argument; join into one string, or start with a fixed label", first);
}

/** An arrow may capture only parameters and variables declared directly in the function body. */
function checkCapture(c: Ctx, name: string, n: any) {
  if (!c.arrow || c.arrow.has(name) || c.fns.has(name) || c.imported.has(name) || c.stable.has(name)) return;
  //why: JS gives each block and loop pass its own variable; machin has one per function, so a
  //     captured inner variable would show whatever was stored in it last.
  diag(c, "JS-CLOSURE001", `an arrow can't capture ${name}, declared inside a block or loop; pass it to a function that returns the arrow`, n);
}

/** `(a, b) => expr`. */
function arrow(c: Ctx, e: any): string {
  return scoped(c, () => {
    const ps = e.params.map((x: any) => declare(c, x));
    const outer = c.arrow;
    c.arrow = new Set([...(outer ?? []), ...ps]);
    const body = expr(c, e.body);
    c.arrow = outer;
    return `func(${ps.join(", ")}) { return ${body} }`;
  });
}

/** A template literal becomes string concatenation, with str() around non-strings. */
function template(c: Ctx, e: any, p: number): string {
  const parts: string[] = [];
  e.quasis.forEach((q: any, i: number) => {
    if (q.value.cooked) parts.push(literal(c, { ...q, type: "Literal", value: q.value.cooked, raw: q.value.raw }));
    const x = e.expressions[i];
    if (!x) return;
    checkScalar(c, x, "JS-VAL001", "interpolating");
    parts.push(c.types.kind(x) === "string" ? expr(c, x, PREC["+"] + 1) : `str(${expr(c, x)})`);
  });
  const s = parts.join(" + ") || '""';
  return parts.length > 1 && PREC["+"] < p ? `(${s})` : s;
}

/** `{a: 1, b}` builds the named struct its context expects. */
function object(c: Ctx, e: any, expected?: string): string {
  const odd = e.properties.find((x: any) => x.type !== "Property" || x.computed || x.method || x.kind !== "init" || x.key.type !== "Identifier");
  if (odd) return diag(c, "JS-UNSUP001", "only plain `name: value` properties are supported", odd);
  const fields = e.properties.map((x: any) => `${x.key.name}: ${expr(c, x.value)}`).join(", ");
  const type = expected ?? c.types.spell(e);
  if (!type || type.startsWith("[]") || SCALARS.has(type))
    return typeDiag(c, "JS-OBJ001", "an object literal needs a named @typedef type here, e.g. from @returns {Todo}", e);
  return `${type}{${fields}}`;
}

/** `xs.push(v)` as a statement. Whether it is allowed is decided per function (ownership.ts). */
function push(c: Ctx, e: any): string | null {
  const f = e.callee;
  if (e.type !== "CallExpression" || f.type !== "MemberExpression" || f.computed || f.property.name !== "push") return null;
  if (f.object.type !== "Identifier" || e.arguments.length !== 1) return diag(c, "JS-UNSUP001", "only list.push(oneValue) is supported", e);
  const k = c.types.kind(f.object);
  if (k !== "array") return typeDiag(c, k === "any" ? "JS-ANY001" : "JS-UNSUP001", "push is only supported on a list with a known type", e);
  const list = expr(c, f.object);
  return `${list} = append(${list}, ${expr(c, e.arguments[0])})`;
}

/** The method name when `e` is a call on a Map, else "". */
function mapMethod(c: Ctx, e: any): string {
  const f = e?.type === "CallExpression" ? e.callee : null;
  if (!f || f.type !== "MemberExpression" || f.computed || c.types.kind(f.object) !== "map") return "";
  return f.property.name;
}

const MAP_RULE = "a Map supports m.get(k) ?? fallback, m.has(k), m.size, and m.set(k, v) / m.delete(k) on their own line";

/** `new Map()`: an empty map whose key and value types come from its annotation or context. */
function newMap(c: Ctx, e: any, declared?: any): string {
  if (e.callee.name !== "Map" || e.arguments.length) return diag(c, "JS-UNSUP001", "only `new Map()` with no arguments is supported", e);
  const type = (declared && c.types.spell(declared)) || c.types.spell(e);
  if (!type?.startsWith("map["))
    return typeDiag(c, "JS-MAP001", "declare the Map's types, e.g. /** @type {Map<string, int>} */ on its own line", e);
  return `make(${type})`;
}

/** `m.get(k) ?? fallback`: the one way to read a map that means the same in both. */
function mapGet(c: Ctx, e: any): string {
  if (mapMethod(c, e.left) !== "get" || e.left.arguments.length !== 1)
    return diag(c, "JS-UNSUP001", "?? is only supported as m.get(key) ?? fallback", e);
  const key = e.left.arguments[0];
  //why: JS runs the fallback only when the key is missing; ours is always evaluated, so it
  //     must be something that can't do anything.
  if (!steady(e.right) && calls(c, e.right)) typeDiag(c, "JS-MAP001", "the fallback must be a constant or a variable, not a call", e.right);
  c.guards.add("js_get");
  return `js_get(${expr(c, e.left.callee.object)}, ${expr(c, key)}, ${expr(c, e.right)})`;
}

/** `m.set(k, v)` and `m.delete(k)` as statements. */
function mapStatement(c: Ctx, e: any): string | null {
  const method = mapMethod(c, e);
  if (method !== "set" && method !== "delete") return null;
  const map = expr(c, e.callee.object);
  const [key, value] = e.arguments;
  if (e.arguments.length !== (method === "set" ? 2 : 1)) return typeDiag(c, "JS-MAP001", MAP_RULE, e);
  if (method === "delete") return `delete(${map}, ${expr(c, key)})`;
  checkStoreOrder(c, key, value, e);
  //why: an object literal stored in a map takes its struct name from the map's value type.
  const type = c.types.spell(e.callee.object)?.replace(/^map\[\w+\]/, "");
  const stored = value.type === "ObjectExpression" ? object(c, value, type) : expr(c, value);
  return `${map}[${expr(c, key)}] = ${stored}`;
}

/** `for (const x of list)`. */
function forOf(c: Ctx, s: any): string[] {
  const d = s.left.type === "VariableDeclaration" && (s.left.kind === "const" || s.left.kind === "let") ? s.left.declarations[0] : null;
  if (!d || s.await) return [diag(c, "JS-UNSUP001", "use for (const x of list)", s)];
  return scoped(c, () => {
    const over = expr(c, s.right);
    const k = c.types.kind(s.right);
    if (k !== "array") typeDiag(c, k === "string" ? "JS-STR002" : k === "any" ? "JS-ANY001" : k === "map" ? "JS-MAP001" : "JS-UNSUP001", "for…of is only supported on a list", s);
    const name = declare(c, d.id);
    return [`for _, ${name} := range ${over} {`, ...block(c, s.body), "}"];
  });
}

/** `.length` and `a[i]` on arrays; strings are refused (UTF-16 units natively become bytes). */
function member(c: Ctx, e: any): string {
  const k = c.types.kind(e.object);
  if (k === "map") {
    if (!e.computed && e.property.name === "size") return `len(${expr(c, e.object)})`;
    return typeDiag(c, "JS-MAP001", MAP_RULE, e);
  }
  const length = !e.computed && e.property.name === "length";
  if (e.computed || length) {
    if (k === "string") return typeDiag(c, "JS-STR002", `use len(s) or substr(s, a, b) from "machin" on strings: they count bytes in both`, e);
    if (k === "any") return typeDiag(c, "JS-ANY001", "the type here is unknown; add a JSDoc type", e);
  }
  if (e.computed) {
    const list = expr(c, e.object), i = expr(c, e.property);
    if (k !== "array") return `${list}[${i}]`;
    c.guards.add("js_at");
    return `js_at(${list}, ${i}, ${where(c, e)})`;
  }
  return length && k === "array" ? `len(${expr(c, e.object)})` : `${expr(c, e.object)}.${e.property.name}`;
}

/** `"file.js:12"`, as a machin string. */
function where(c: Ctx, n: any): string {
  return str(`${c.file.split("/").pop()}:${n.loc.start.line}`);
}

/** An assignment target: an element is checked on its index, since it isn't read here. */
function place(c: Ctx, e: any): string {
  if (e.type !== "MemberExpression" || !e.computed || c.types.kind(e.object) !== "array") return expr(c, e);
  const list = expr(c, e.object), i = expr(c, e.property);
  c.guards.add("js_idx");
  return `${list}[js_idx(${list}, ${i}, ${where(c, e)})]`;
}

/** The right side of `/` or `%`: checked unless it is a constant that can't be zero. */
function divisor(c: Ctx, x: any, precedence: number): string {
  if (x.type === "Literal" && typeof x.value === "number" && x.value !== 0) return expr(c, x, precedence);
  c.guards.add("js_divisor");
  return `js_divisor(${expr(c, x)}, ${where(c, x)})`;
}

/** An array literal; machin needs its element type spelled out. */
function array(c: Ctx, e: any, declared?: any): string {
  if (e.elements.some((x: any) => !x)) return diag(c, "JS-UNSUP001", "holes in arrays are not supported", e);
  const type = (declared && c.types.spell(declared)) || c.types.spell(e);
  //why: an object literal inside a list takes its struct name from the list's element type.
  const element = type?.startsWith("[]") ? type.slice(2) : undefined;
  const items = e.elements.map((x: any) => x.type === "ObjectExpression" ? object(c, x, element) : expr(c, x)).join(", ");
  if (!type?.startsWith("[]"))
    return typeDiag(c, "JS-ARR001", "the element type is unclear or mixed; use one type, or annotate with /** @type {int[]} */", e);
  //why: machin cannot write a literal of arrays (`[][]string{...}` does not parse).
  if (type.startsWith("[][]")) return typeDiag(c, "JS-ARR001", "nested array literals are not supported", e);
  return `${type}{${items}}`;
}

/** `Math.trunc(a / b)`: integer division, the only division allowed. */
function truncDiv(c: Ctx, e: any, p: number): string {
  const d = e.arguments[0];
  if (e.arguments.length !== 1 || d?.type !== "BinaryExpression" || d.operator !== "/")
    return diag(c, "JS-UNSUP001", "Math.trunc is only supported as Math.trunc(a / b)", e);
  //why: machin's integer division truncates toward zero, exactly like Math.trunc.
  const s = `${expr(c, d.left, PREC["*"])} / ${divisor(c, d.right, PREC["*"] + 1)}`;
  return PREC["*"] < p ? `(${s})` : s;
}

/** Emit a literal, rejecting the kinds that would behave differently natively. */
function literal(c: Ctx, e: any): string {
  if (typeof e.value === "boolean") return String(e.value);
  if (typeof e.value === "number") {
    //why: machin integers are exact int64; floats print differently and huge values round in JS.
    return Number.isSafeInteger(e.value) && /^\d+$/.test(e.raw) ? String(e.value)
      : diag(c, "JS-NUM001", `only plain whole numbers up to 2^53-1 are supported, not ${e.raw}`, e);
  }
  if (typeof e.value !== "string") return diag(c, "JS-UNSUP001", `literal ${e.raw} unsupported`, e);
  //why: machin strings are bytes, JS strings are UTF-16: length and slicing differ beyond ASCII.
  if (!/^[\x20-\x7e\n\t]*$/.test(e.value))
    return diag(c, "JS-STR001", "string literals must be printable ASCII (plus \\n and \\t)", e);
  return str(e.value);
}

/** Emit an expression; `p` is the parent's precedence, for minimal parens. */
function expr(c: Ctx, e: any, p = 0): string {
  switch (e.type) {
    case "Literal": return literal(c, e);
    case "Identifier":
      if (!c.scope.has(e.name)) return diag(c, "JS-UNDEF001", `${e.name} is not defined or imported`, e);
      //why: your own and bridge functions are values in machin; builtins are not.
      if (c.builtins.has(e.name)) return diag(c, "JS-FNVAL001", `${e.name} is a machin builtin; pass an arrow: (x) => ${e.name}(x)`, e);
      checkCapture(c, e.name, e);
      return e.name;
    case "ArrowFunctionExpression":
      if (e.body.type === "BlockStatement") return diag(c, "JS-UNSUP001", "arrow with block body unsupported; use an expression body", e);
      if (e.async) return diag(c, "JS-UNSUP001", "async is not supported", e);
      return arrow(c, e);
    case "MemberExpression": return member(c, e);
    case "UnaryExpression":
      if (e.operator !== "!" && e.operator !== "-") return diag(c, "JS-UNSUP001", `operator ${e.operator} unsupported`, e);
      return `${e.operator}${expr(c, e.argument, 9)}`;
    case "BinaryExpression": case "LogicalExpression": {
      if (e.operator === "??") return mapGet(c, e);
      const q = PREC[e.operator];
      if (e.operator === "/") return diag(c, "JS-NUM002", "/ is not supported yet: machin integer division drops the fraction", e);
      if (!q) return diag(c, "JS-UNSUP001", `operator ${e.operator} unsupported`, e);
      const op = e.operator === "===" ? "==" : e.operator === "!==" ? "!=" : e.operator;
      if (op === "+") checkAdd(c, e.left, e.right, e);
      if (op === "==" || op === "!=") [e.left, e.right].forEach((x) => checkScalar(c, x, "JS-CMP001", "comparing"));
      const left = expr(c, e.left, q);
      const s = `${left} ${op} ${op === "%" ? divisor(c, e.right, q + 1) : expr(c, e.right, q + 1)}`;
      return q < p ? `(${s})` : s;
    }
    case "ArrayExpression": return array(c, e);
    case "CallExpression": return call(c, e, p);
    case "TemplateLiteral": return template(c, e, p);
    case "NewExpression": return newMap(c, e);
    case "ObjectExpression": return object(c, e);
    default: return diag(c, "JS-UNSUP001", `${e.type} unsupported`, e);
  }
}

/** Emit a call, mapping JS builtins to machin ones. */
function call(c: Ctx, e: any, p = 0): string {
  const f = e.callee;
  const method = mapMethod(c, e);
  if (method === "has" && e.arguments.length === 1) return `has(${expr(c, f.object)}, ${expr(c, e.arguments[0])})`;
  if (method) return typeDiag(c, "JS-MAP001", MAP_RULE, e);
  const dotted = f.type === "MemberExpression" && !f.computed ? `${f.object.name}.${f.property.name}` : "";
  if (dotted === "Math.trunc") return truncDiv(c, e, p);
  const name = dotted === "console.log" ? "println" : f.type === "Identifier" ? f.name : "";
  if (!name) return diag(c, "JS-UNSUP001", "only plain function calls are supported", e);
  if (!c.scope.has(name) && !GLOBALS.has(name) && name !== "println")
    return diag(c, "JS-UNDEF001", `${name} is not defined or imported`, e);
  if (c.scope.has(name)) checkCapture(c, name, e);
  const converts = name === "String" && !c.scope.has(name);
  if (converts || dotted === "console.log") e.arguments.forEach((x: any) => checkScalar(c, x, "JS-VAL001", "printing or converting"));
  if (name === "parse" && c.builtins.has(name)) checkParseInput(c, e.arguments[0] ?? e);
  //why: `parse(x, [])` needs a typed witness: the type the surrounding code expects back.
  if (name === "parse" && c.builtins.has(name) && e.arguments[1]?.type === "ArrayExpression") {
    const type = c.types.spell(e);
    if (!type) return typeDiag(c, "JS-ANY001", "parse needs a known result type, e.g. from @returns {Todo[]}", e);
    return `parse(${expr(c, e.arguments[0])}, ${type}{})`;
  }
  if (dotted === "console.log") checkLogFormat(c, e.arguments);
  const args = e.arguments.map((a: any) => expr(c, a));
  return `${converts ? "str" : name}(${args.join(", ")})`;
}

/** Emit one statement as lines. */
function stmt(c: Ctx, s: any): string[] {
  switch (s.type) {
    case "VariableDeclaration":
      if (s.kind !== "const" && s.kind !== "let") {
        s.declarations.forEach((d: any) => names(d.id).forEach((n) => c.scope.add(n)));
        return [diag(c, "JS-UNSUP001", `use const or let, not ${s.kind}`, s)];
      }
      return s.declarations.flatMap((d: any) => decl(c, d));
    case "ExpressionStatement": return [push(c, s.expression) ?? mapStatement(c, s.expression) ?? assignOrExpr(c, s.expression)];
    case "ReturnStatement": return [s.argument ? `return ${expr(c, s.argument)}` : "return"];
    case "IfStatement": return ifs(c, s);
    case "WhileStatement": return [`while ${expr(c, s.test)} {`, ...block(c, s.body), "}"];
    case "ForStatement": return forLoop(c, s);
    case "ForOfStatement": return forOf(c, s);
    case "BreakStatement": return s.label ? [diag(c, "JS-UNSUP001", "labels are not supported", s)] : ["break"];
    default: return [diag(c, "JS-UNSUP001", `${s.type} unsupported`, s)];
  }
}

/** Run `fn` in a nested lexical scope: names it declares vanish afterwards. */
function scoped<T>(c: Ctx, fn: () => T): T {
  const outer = c.scope;
  c.scope = new Set(outer);
  try {
    return fn();
  } finally {
    c.scope = outer;
  }
}

/** Every identifier in a binding pattern — used so one rejection doesn't cascade into more. */
function names(n: any): string[] {
  if (!n || typeof n !== "object") return [];
  if (n.type === "Identifier") return [n.name];
  return Object.values(n).flatMap((v) => Array.isArray(v) ? v.flatMap(names) : names(v));
}

//why: machin parses its keywords wherever they appear, and the emitter itself calls these
//     builtins, so a variable with one of these names would break or hijack the output.
const KEYWORDS = new Set(["func", "range", "chan", "make", "map", "struct", "type", "go", "select", "arena", "extern",
  "export", "nil", "fn", "cstruct", "header", "link", "cflags", "defer", "var"]);
const EMITTED = new Set(["len", "str", "println", "append", "parse", "has"]);

/** Refuse a declared name that means something to machin. */
function checkName(c: Ctx, name: string, n: any, taken: Set<string>) {
  //why: js_ is the prefix of the runtime checks the transpiler generates.
  if (KEYWORDS.has(name) || taken.has(name) || name.startsWith("js_")) diag(c, "JS-NAME001", `${name} already means something in machin; choose another name`, n);
}

/** Declare a plain name in the current scope. */
function declare(c: Ctx, id: any): string {
  if (id.type !== "Identifier") {
    names(id).forEach((n) => c.scope.add(n));
    return diag(c, "JS-UNSUP001", "destructuring, defaults and rest are not supported", id);
  }
  //why: machin has one scope per function, so a shadowing name would overwrite the outer one.
  checkName(c, id.name, id, EMITTED);
  if (c.scope.has(id.name)) diag(c, "JS-SCOPE001", `${id.name} is already visible here; use another name`, id);
  c.scope.add(id.name);
  return id.name;
}

/** `const x = v`, with `c ? a : b` lowered to init-else-then-override. */
function decl(c: Ctx, d: any): string[] {
  if (!d.init) {
    declare(c, d.id);
    return [diag(c, "JS-UNSUP001", "a variable needs an initial value", d)];
  }
  if (d.id.type !== "Identifier") return [declare(c, d.id)];
  const out = declValue(c, d, d.id.name);
  declare(c, d.id);
  return out;
}

/** The lines that give `name` its initial value (emitted before the name becomes visible). */
function declValue(c: Ctx, d: any, name: string): string[] {
  if (d.init.type === "ArrayExpression") return [`${name} := ${array(c, d.init, d.id)}`];
  if (d.init.type === "NewExpression") return [`${name} := ${newMap(c, d.init, d.id)}`];
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
    if (!ASSIGN.has(e.operator)) return diag(c, "JS-UNSUP001", `operator ${e.operator} unsupported`, e);
    //why: machin copies structs where JS shares them, so changing a field would silently diverge.
    if (e.left.type === "MemberExpression" && !e.left.computed)
      return diag(c, "JS-UNSUP001", "assigning to an object field is not supported", e);
    checkElementOrder(c, e.left, e.right, e.operator !== "=");
    const t = place(c, e.left);
    const op = e.operator[0];
    if (op === "+") checkAdd(c, e.left, e.right, e);
    //why: `x *= a + b` must become `x = x * (a + b)`, so the right side binds tighter than op.
    if (e.operator === "=") return `${t} = ${expr(c, e.right)}`;
    const value = op === "%" ? divisor(c, e.right, PREC[op] + 1) : expr(c, e.right, PREC[op] + 1);
    //why: the read on the right is checked too — native code may run it before the store's check.
    return `${t} = ${expr(c, e.left)} ${op} ${value}`;
  }
  if (e.type === "UpdateExpression") checkElementOrder(c, e.argument, null, true);
  if (e.type === "UpdateExpression") return `${place(c, e.argument)} = ${expr(c, e.argument)} ${e.operator[0]} 1`;
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
  if (!s.init || !s.test || !s.update) return [diag(c, "JS-UNSUP001", "for needs init, test and update", s)];
  return scoped(c, () => {
    const init = s.init.type === "VariableDeclaration" ? stmt(c, s.init) : [assignOrExpr(c, s.init)];
    const test = expr(c, s.test);
    return [...init, `while ${test} {`, ...block(c, s.body), "    " + assignOrExpr(c, s.update), "}"];
  });
}

/** Statements of a block or single statement, indented. */
function block(c: Ctx, b: any): string[] {
  const list = b.type === "BlockStatement" ? b.body : [b];
  return scoped(c, () => list.flatMap((x: any) => stmt(c, x)).map((l: string) => "    " + l));
}

/** Does the function return a value anywhere? */
function returnsValue(n: any): boolean {
  if (!n || typeof n !== "object") return false;
  if (n.type === "ReturnStatement") return !!n.argument;
  return Object.values(n).some((v) => Array.isArray(v) ? v.some(returnsValue) : returnsValue(v));
}

/** Does every path through this statement end in `return`? */
function alwaysReturns(n: any): boolean {
  if (!n) return false;
  if (n.type === "ReturnStatement") return true;
  if (n.type === "BlockStatement") return n.body.some(alwaysReturns);
  return n.type === "IfStatement" && alwaysReturns(n.consequent) && alwaysReturns(n.alternate);
}

/** Is there a `return;` without a value anywhere inside n? */
function bareReturn(n: any): boolean {
  if (!n || typeof n !== "object") return false;
  if (n.type === "ReturnStatement") return !n.argument;
  return Object.values(n).some((v) => Array.isArray(v) ? v.some(bareReturn) : bareReturn(v));
}

/** Emit a function declaration. */
function func(c: Ctx, fn: any): string[] {
  //why: a name is visible only if declared here, in this module, or imported — no ambient globals.
  c.scope = new Set([...c.fns, ...c.imported]);
  if (fn.async || fn.generator) diag(c, "JS-UNSUP001", "async functions and generators are not supported", fn);
  const params = fn.params.map((p: any) => declare(c, p));
  const direct = fn.body.body.filter((n: any) => n.type === "VariableDeclaration").flatMap((n: any) => n.declarations.flatMap((d: any) => names(d.id)));
  c.stable = new Set([...params, ...direct]);
  for (const p of pushProblems(fn)) diag(c, "JS-PUSH001", p.msg, p.node);
  const doc = docOf(c, fn);
  lint(c, fn, doc);
  //why: a function with a builtin's name would clash with it.
  checkName(c, fn.id.name, fn, BUILTINS);
  const valued = returnsValue(fn.body);
  //why: a missing return is `undefined` in JS but a silent zero value in machin.
  if (valued && (bareReturn(fn.body) || !alwaysReturns(fn.body)))
    diag(c, "JS-RET001", `${fn.id.name} returns a value, so every path must return one`, fn);
  //why: the named result must not collide with any of the function's own names.
  const used = JSON.stringify(fn, (k, v) => (k === "loc" ? undefined : v));
  let result = "r";
  while (used.includes(`"name":"${result}"`)) result += "_";
  const res = valued ? ` (${result})` : "";
  return [`func ${fn.id.name}(${params.join(", ")})${res} {`, ...block(c, fn.body), "}", ""];
}

/** Emit a function; a transpiler bug becomes a diagnostic instead of a stack trace. */
function guarded(c: Ctx, fn: any): string[] {
  try {
    return func(c, fn);
  } catch (err) {
    return [diag(c, "JS-INTERNAL001", `transpiler bug, please report it: ${(err as Error).message}`, fn)];
  }
}

export type Mod = { out: string; diags: Diag[]; imports: Imp[]; exports: Set<string>; fns: Set<string>; deps: string[]; defines: Map<string, number>; guards: Set<string> };

/** Transpile one JS source file (an ES module). */
export function transpile(file: string, src: string, types?: Types): Mod {
  const cmts: Cmt[] = [];
  const ast: any = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true,
    onComment: (block: boolean, text: string, start: number, end: number) => cmts.push({ block, text, start, end }) });
  const imports: Imp[] = [], exports = new Set<string>(), decls: any[] = [], imported = new Set<string>();
  for (const n of ast.body) {
    if (n.type === "ImportDeclaration" && n.specifiers.some((x: any) => x.type !== "ImportSpecifier" || x.imported.name !== x.local.name)) {
      decls.push({ type: "default, namespace or renamed import", loc: n.loc });
    } else if (n.type === "ImportDeclaration") {
      imports.push({ source: n.source.value, names: n.specifiers.map((x: any) => x.imported.name), line: n.loc.start.line });
      n.specifiers.forEach((x: any) => imported.add(x.local.name));
    } else if (n.type === "ExportNamedDeclaration" && !n.declaration && !n.source && n.specifiers.length === 0) {
      continue; // `export {}` only marks a type-only file as a module
    } else if (n.type === "ExportNamedDeclaration" && n.declaration?.type === "FunctionDeclaration") {
      exports.add(n.declaration.id.name); n.declaration.docStart = n.start; decls.push(n.declaration);
    } else decls.push(n);
  }
  const fns = new Set<string>(decls.filter((n) => n.type === "FunctionDeclaration").map((n) => n.id.name));
  const builtins = new Set<string>(imports.filter((i) => i.source === "machin").flatMap((i) => i.names));
  if (!types) {
    //why: a lone snippet is checked on its own, under a path that need not exist.
    const path = "/__snippet__/snippet.js";
    types = new Types(program([path], { path, text: src }), path);
  }
  const c: Ctx = { file, src, cmts, diags: [], typed: [], types, guards: new Set(), stable: new Set(), arrow: null, fns, imported, builtins, scope: new Set() };
  const lines = [...typedefs(c)];
  for (const n of decls) {
    if (n.type === "FunctionDeclaration") lines.push(...guarded(c, n));
    else lines.push(diag(c, "JS-UNSUP001", `top-level ${n.type} unsupported`, n));
  }
  //why: `@typedef {import("./model.js").Todo} Todo` is the JS way to name a type from another file;
  //     it also tells us the dependency, so type-only modules (model.js) still get emitted.
  const deps = cmts.filter((x) => x.block).flatMap((x) => [...x.text.matchAll(/import\(["'](\.[^"']+)["']\)/g)].map((m) => m[1]));
  //why: once a Map operation is refused, other complaints about the same line are just its echo.
  const mapLines = new Set(c.typed.filter((d) => d.code === "JS-MAP001").map((d) => d.line));
  const typed = c.typed.filter((d) => d.code === "JS-MAP001" || !mapLines.has(d.line));
  const diags = c.diags.length ? c.diags.filter((d) => !mapLines.has(d.line)).concat(typed.filter((d) => mapLines.has(d.line))) : typed;
  //why: every function and struct this module adds to the one namespace, with its line.
  const line = (at: number) => src.slice(0, at).split("\n").length;
  const defines = new Map<string, number>(decls.filter((n) => n.type === "FunctionDeclaration").map((n) => [n.id.name, n.loc.start.line]));
  for (const x of cmts.filter((x) => x.block)) {
    const t = /@typedef\s+\{\{.*?\}\}\s*(\w+)/s.exec(x.text);
    if (t) defines.set(t[1], line(x.start));
  }
  return { out: lines.join("\n").trimEnd() + "\n", diags, imports, exports, fns, deps, defines, guards: c.guards };
}

/** Names exported by a hand-kept typings file in types/. */
async function dtsNames(file: string): Promise<Set<string>> {
  const t = await Deno.readTextFile(new URL(`../types/${file}`, import.meta.url));
  return new Set([...t.matchAll(/export (?:function|type) (\w+)/g)].map((m) => m[1]));
}

/** Bridge modules: JS import name -> its typings and the machin .src it needs in the build. */
function bridges(): Record<string, { dts: string; src: string }> {
  //why: a copy of machweb ships with machin-js, so no machin checkout is needed;
  //     MACHIN_FRAMEWORK overrides it, e.g. to try a newer one.
  const fw = Deno.env.get("MACHIN_FRAMEWORK") ?? new URL("../bindings", import.meta.url).pathname;
  return {
    "machin/web": { dts: "machweb.d.ts", src: `${fw}/machweb.src` },
    "machin/json": { dts: "json.d.ts", src: new URL("../bindings/json.src", import.meta.url).pathname },
    "machin/text": { dts: "text.d.ts", src: new URL("../bindings/text.src", import.meta.url).pathname },
    "machin/desktop": { dts: "desktop.d.ts", src: new URL("../bindings/desktop.src", import.meta.url).pathname },
  };
}

/** Follow imports from `entry`; return modules in dependency order, plus every diagnostic. */
export async function buildGraph(entry: string): Promise<{ order: { path: string; out: string }[]; native: string[]; diags: Diag[]; where: Map<string, string> }> {
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
    const m = transpile(path, await Deno.readTextFile(path), new Types(checked, path));
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
  //why: one program from the entry covers every module it imports, and is reused for errors.
  const checked = program([resolve(entry)]);
  await visit(resolve(entry));
  //why: machin has one flat namespace, so two modules defining the same function name would clash.
  const seen = new Map<string, string>();
  for (const [p, m] of mods) for (const f of m.fns) {
    if (seen.has(f)) add(p, 1, "JS-DUP001", `function ${f} is also defined in ${basename(seen.get(f)!)} (machin has one namespace)`);
    seen.set(f, p);
  }
  //why: bridge and framework sources share that namespace too, including their internal names.
  for (const file of native) {
    const source = await Deno.readTextFile(file).catch(() => null);
    if (source === null) {
      add(resolve(entry), 1, "JS-IMPORT002", `cannot read ${file}; set MACHIN_FRAMEWORK to the framework directory of a machin source checkout`);
      continue;
    }
    const taken = new Set([...source.matchAll(/^(?:export )?(?:func|type) (\w+)/gm)].map((m) => m[1]));
    for (const [path, m] of mods) for (const [name, line] of m.defines) {
      if (taken.has(name)) add(path, line, "JS-NAME001", `${name} is already defined by ${basename(file)}, which this program includes; choose another name`);
    }
  }
  //why: only once everything else is clean, so one mistake isn't reported twice in two ways.
  if (!diags.length) diags.push(...typeErrors(checked));
  //why: one module for the checks the whole program uses, ahead of the modules that call them.
  const used = new Set<string>([...mods.values()].flatMap((m) => [...m.guards]));
  if (used.size) order.unshift({ path: `${GUARD_MODULE}.js`, out: guardModule(used) });
  //why: lets a caller turn a machin error naming a function into a JavaScript location.
  const where = new Map([...mods].flatMap(([p, m]) => [...m.defines].map(([n, line]) => [n, `${p}:${line}`] as const)));
  return { order, native: [...native], diags, where };
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
