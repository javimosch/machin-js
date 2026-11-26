// Deno twin of bindings/json.src. test/json_test.ts compares the two on thousands of documents.
import { json_valid } from "./machin.js";

const TOKEN = /\s*("(?:[^"\\]+|\\.)*"|[{}[\]:,]|[^\s{}[\]:,"]+)/y;

//why: mirrors machin's json_get: the FIRST key whose written form equals `name` (JSON.parse takes
//     the last, and decodes escaped keys), so the valid text is walked token by token.
function rawToken(body, name) {
  if (name === "" || name.includes(".") || name.includes("[") || !json_valid(body)) return "";
  TOKEN.lastIndex = 0;
  const next = () => {
    const m = TOKEN.exec(body);
    return m ? { text: m[1], start: TOKEN.lastIndex - m[1].length, end: TOKEN.lastIndex } : null;
  };
  if (next()?.text !== "{") return "";
  for (let key = next(); key && key.text !== "}"; key = next()) {
    if (key.text === ",") continue;
    next(); // the colon
    const first = next();
    let end = first.end, depth = "{[".includes(first.text) ? 1 : 0;
    while (depth > 0) {
      const t = next();
      depth += "{[".includes(t.text) ? 1 : "}]".includes(t.text) ? -1 : 0;
      end = t.end;
    }
    if (key.text.slice(1, -1) === name) return body.slice(first.start, end);
  }
  return "";
}

const whole = (t) => /^-?\d{1,15}$/.test(t);
//why: "\ud800" alone is valid JSON syntax but not text, so it counts as no string (as natively).
function decoded(token) {
  if (!token.startsWith('"')) return null;
  const s = JSON.parse(token).split("\0")[0];
  return s.isWellFormed() ? s : null;
}
export const json_has = (body, name) => rawToken(body, name) !== "";
export const json_is_string = (body, name) => decoded(rawToken(body, name)) !== null;
export const json_string = (body, name) => decoded(rawToken(body, name)) ?? "";
export const json_is_int = (body, name) => whole(rawToken(body, name));
export const json_int = (body, name) => (whole(rawToken(body, name)) ? Number(rawToken(body, name)) + 0 : 0);
export const json_is_bool = (body, name) => ["true", "false"].includes(rawToken(body, name));
export const json_bool = (body, name) => rawToken(body, name) === "true";
