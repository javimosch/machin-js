/** @typedef {import("./guidetypes.js").Guide} Guide */

/**
 * A markdown section with one bullet per line.
 * @param {string} title
 * @param {string[]} lines
 * @returns {string}
 */
function section(title, lines) {
  //why: every list in the guide renders the same way.
  return `\n## ${title}\n\n- ${lines.join("\n- ")}\n`;
}

/**
 * The examples as markdown.
 * @param {Guide} g
 * @returns {string}
 */
function exampleSection(g) {
  //why: each goal is followed by the exact commands.
  let out = "\n## Examples\n";
  for (const e of g.examples) {
    out += `\n${e.goal}:\n\n`;
    for (const c of e.do) {
      out += `    ${c}\n`;
    }
  }
  return out;
}

/**
 * The guide as markdown (cli-guide-spec §2, --human).
 * @param {Guide} g
 * @returns {string}
 */
export function markdown(g) {
  //why: same data as the JSON, only laid out for a person.
  const m = g.model, c = g.concepts;
  let out = `# jot ${g.version}\n\n${g.jot} ${g.one_liner}\n`;
  out += section("Model", [m.storage, m.output, m.errors]);
  out += section("Loop", g.loop);
  out += section("Concepts", [`task: ${c.task}`, `id: ${c.id}`, `tag: ${c.tag}`, `done: ${c.done}`]);
  out += section("Commands", g.commands.tasks) + section("About jot", g.commands.about);
  out += exampleSection(g) + section("Gotchas", g.gotchas) + section("See also", g.see_also);
  return out;
}
