// Checks the transpiler adds so a crash can say where it happened in your .js.
//why: a machin panic carries no location at all, and without --safe an out-of-range read doesn't
//     even panic. These checks always run, and name the JavaScript file and line.

/** The machin source of each check. Only the ones a program uses are emitted. */
export const GUARDS: Record<string, string> = {
  js_idx: `func js_idx(xs, i, at) (r) {
    if i < 0 || i >= len(xs) {
        eprintln(at + ": index " + str(i) + " is outside the list (length " + str(len(xs)) + ")")
        exit(1)
    }
    return i
}
`,
  js_at: `func js_at(xs, i, at) (r) {
    return xs[js_idx(xs, i, at)]
}
`,
  js_get: `func js_get(m, k, fallback) (r) {
    r = fallback
    if has(m, k) {
        r = m[k]
    }
}
`,
  js_includes: `func js_includes(xs, v) (r) {
    r = false
    for _, x := range xs {
        if x == v {
            r = true
        }
    }
}
`,
  js_map: `func js_map(xs, f) (out) {
    for _, x := range xs {
        out = append(out, f(x))
    }
}
`,
  js_filter: `func js_filter(xs, keep) (out) {
    for _, x := range xs {
        if keep(x) {
            out = append(out, x)
        }
    }
}
`,
  js_divisor: `func js_divisor(d, at) (r) {
    if d == 0 {
        eprintln(at + ": division by zero")
        exit(1)
    }
    return d
}
`,
};

export const GUARD_MODULE = "machin_js_guard";

/** The module holding the checks in `used` (plus the ones they call), in a stable order. */
export function guardModule(used: Set<string>): string {
  if (used.has("js_at")) used.add("js_idx");
  return Object.keys(GUARDS).filter((name) => used.has(name)).map((name) => GUARDS[name]).join("\n");
}
