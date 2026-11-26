// Deno twin of bindings/text.src. [...s] counts code points, like the machin version.
export const text_length = (s) => [...s].length;
const spaces = (n) => " ".repeat(Math.max(0, n));
export const pad_end = (s, width) => s + spaces(width - text_length(s));
export const pad_start = (s, width) => spaces(width - text_length(s)) + s;
