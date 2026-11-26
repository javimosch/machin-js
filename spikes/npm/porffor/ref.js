import { marked } from "npm:marked@15.0.6";
for (const line of (await Deno.readTextFile(Deno.args[0])).split("\n")) {
  if (line === "") continue;
  let out;
  try { out = JSON.stringify({ ok: true, value: marked.parse(...JSON.parse(line)) }); }
  catch (e) { out = JSON.stringify({ ok: false, error: String((e && e.name) || e) }); }
  console.log(out);
}
