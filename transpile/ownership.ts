// When is `xs.push(v)` the same natively? Only while the function is the list's sole owner.
//why: JS push changes the one shared list; machin's append returns a new slice, and whether old
//     aliases still see it depends on hidden capacity. With no alias yet, nobody can tell.

type Ref = { node: any; loops: any[]; use: "push" | "own" | "return" | "share" };
export type Problem = { node: any; msg: string };

const LOOPS = new Set(["WhileStatement", "ForStatement", "ForOfStatement"]);

/** How is the identifier used, given its parent and grandparent? */
function useOf(n: any, parent: any, grand: any, inArrow: boolean): Ref["use"] {
  if (inArrow) return "share";
  if (parent?.type === "ReturnStatement") return "return";
  if (parent?.type !== "MemberExpression" || parent.object !== n) return "share";
  if (parent.computed) return "own"; // xs[i] reads or writes one element
  if (parent.property.name === "length") return "own";
  const called = grand?.type === "CallExpression" && grand.callee === parent;
  //why: these only read the list and keep no reference to it.
  if (called && (parent.property.name === "join" || parent.property.name === "includes")) return "own";
  return parent.property.name === "push" && called ? "push" : "share";
}

/** Every use of every name in a function body, and every declaration. */
function survey(fn: any) {
  const refs = new Map<string, Ref[]>(), declared = new Map<string, any[]>();
  const walk = (n: any, path: any[], loops: any[], inArrow: boolean) => {
    if (!n || typeof n.type !== "string") return;
    const parent = path[path.length - 1];
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier") {
      declared.set(n.id.name, [...(declared.get(n.id.name) ?? []), { ...n, kind: parent.kind }]);
    }
    const isName = n.type === "Identifier" && !(parent?.type === "MemberExpression" && parent.property === n && !parent.computed)
      && !(parent?.type === "VariableDeclarator" && parent.id === n) && !(parent?.type === "Property" && parent.key === n && !parent.shorthand);
    if (isName) refs.set(n.name, [...(refs.get(n.name) ?? []), { node: n, loops, use: useOf(n, parent, path[path.length - 2], inArrow) }]);
    const inner = LOOPS.has(n.type) ? [...loops, n] : loops;
    for (const v of Object.values(n)) {
      for (const child of Array.isArray(v) ? v : [v]) walk(child, [...path, n], inner, inArrow || n.type === "ArrowFunctionExpression");
    }
  };
  walk(fn.body, [fn], [], false);
  return { refs, declared };
}

/** Why each list that is pushed to may not be, if it may not. */
export function pushProblems(fn: any): Problem[] {
  const { refs, declared } = survey(fn);
  const problems: Problem[] = [];
  for (const [name, all] of refs) {
    const pushes = all.filter((r) => r.use === "push");
    if (!pushes.length) continue;
    const made = declared.get(name) ?? [];
    if (made.length !== 1 || made[0].kind !== "const" || made[0].init?.type !== "ArrayExpression") {
      problems.push({ node: pushes[0].node, msg: `push needs a list this function creates once with const ${name} = [...]` });
      continue;
    }
    //why: after it is shared, no later push may happen — neither further down nor on a loop's
    //     next pass. `return xs` is exempt: nothing runs after it.
    //     A loop that contains the declaration doesn't count: each pass makes a new list.
    const born = (l: any) => l.start <= made[0].start && made[0].end <= l.end;
    for (const s of all.filter((r) => r.use === "share")) {
      const late = pushes.find((p) => p.node.start > s.node.start || p.loops.some((l) => !born(l) && s.loops.includes(l)));
      if (late) {
        problems.push({ node: late.node, msg: `${name} is already shared (passed on, assigned or captured) so it can't be pushed to any more` });
        break;
      }
    }
  }
  return problems;
}
