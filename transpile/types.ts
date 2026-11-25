// What the checker knows about each expression, looked up by the positions acorn reports.
//why: the emitter needs types to tell integer from string, array from string, and to name
//     machin element types. Both parsers read the same text, so offsets line up.
import ts from "npm:typescript@5.7.3";

export type Kind = "int" | "string" | "bool" | "array" | "object" | "any" | "other";
type At = { start: number; end: number };

export class Types {
  #ck: ts.TypeChecker;
  #nodes = new Map<string, ts.Node>();

  /** Index every expression and name in `file` by its offsets. */
  constructor(program: ts.Program, file: string) {
    this.#ck = program.getTypeChecker();
    const sf = program.getSourceFile(file);
    if (!sf) throw new Error(`no source file ${file}`);
    const walk = (n: ts.Node) => {
      if (ts.isExpression(n) || ts.isIdentifier(n)) this.#nodes.set(`${n.getStart(sf)}:${n.end}`, n);
      ts.forEachChild(n, walk);
    };
    walk(sf);
  }

  #node(at: At) {
    return this.#nodes.get(`${at.start}:${at.end}`);
  }

  /** The broad kind of an expression's type. */
  kind(at: At): Kind {
    const n = this.#node(at);
    return n ? this.#kindOf(this.#typeOf(n)) : "any";
  }

  /** The type at a node; where the checker narrowed a variable away, its declared type. */
  #typeOf(n: ts.Node): ts.Type {
    const t = this.#ck.getTypeAtLocation(n);
    //why: in code it can prove unreachable the checker calls a variable `never`, but we still
    //     have to emit it, and what matters then is what the variable was declared to be.
    if (!(t.flags & ts.TypeFlags.Never)) return t;
    if (ts.isParenthesizedExpression(n)) return this.#typeOf(n.expression);
    //why: an unreachable `a && b` has the type its left side was declared with.
    if (ts.isBinaryExpression(n)) return this.#typeOf(n.left);
    const symbol = this.#ck.getSymbolAtLocation(n);
    return symbol ? this.#ck.getTypeOfSymbol(symbol) : t;
  }

  #kindOf(t: ts.Type): Kind {
    if (t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return "any";
    if (t.flags & ts.TypeFlags.BooleanLike) return "bool";
    if (t.isUnion()) {
      const kinds = new Set(t.types.map((x) => this.#kindOf(x)));
      return kinds.size === 1 ? [...kinds][0] : "other";
    }
    if (t.flags & ts.TypeFlags.NumberLike) return "int";
    if (t.flags & ts.TypeFlags.StringLike) return "string";
    if (this.#ck.isArrayType(t)) return "array";
    return t.flags & ts.TypeFlags.Object ? "object" : "other";
  }

  /** The machin spelling of a type, or null when there isn't exactly one. */
  #spell(t: ts.Type): string | null {
    const kind = this.#kindOf(t);
    if (kind === "int" || kind === "string" || kind === "bool") return kind;
    if (kind === "array") {
      const element = this.#spell(this.#ck.getTypeArguments(t as ts.TypeReference)[0]);
      return element ? `[]${element}` : null;
    }
    //why: only named typedefs become machin structs.
    return kind === "object" ? t.aliasSymbol?.name ?? null : null;
  }

  /** The machin type an expression should have: what its context expects, else its own type. */
  spell(at: At): string | null {
    const n = this.#node(at);
    if (!n) return null;
    const expected = ts.isExpression(n) ? this.#ck.getContextualType(n) : undefined;
    return (expected && this.#spell(expected)) || this.#spell(this.#typeOf(n));
  }
}
