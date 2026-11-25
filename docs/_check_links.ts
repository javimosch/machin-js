// Fail if the built site has a dead internal link or #anchor, or a leftover .md link.
const root = new URL("_site/", import.meta.url);
const pages = new Map<string, string>();
async function walk(dir: URL, base: string) {
  for await (const e of Deno.readDir(dir)) {
    if (e.isDirectory) await walk(new URL(`${e.name}/`, dir), `${base}${e.name}/`);
    else if (e.name === "index.html") pages.set(base, await Deno.readTextFile(new URL(e.name, dir)));
  }
}
await walk(root, "/");
const bad: string[] = [];
let n = 0;
for (const [from, html] of pages) {
  for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^https?:/.test(href)) continue;
    n++;
    const u = new URL(href, `https://x/machin-js${from}`);
    const path = u.pathname.replace(/^\/machin-js/, "");
    //why: every internal URL must live under the Pages base path, or it 404s once deployed.
    if (!u.pathname.startsWith("/machin-js/") || path.endsWith(".md")) bad.push(`${from} -> ${href}`);
    else if (path.startsWith("/assets/")) await Deno.stat(new URL(`.${path}`, root)).catch(() => bad.push(`${from} -> ${href}`));
    else if (!pages.has(path)) bad.push(`${from} -> ${href}`);
    else if (u.hash && !pages.get(path)!.includes(`id="${u.hash.slice(1)}"`)) bad.push(`${from} -> ${href} (no anchor)`);
  }
}
console.log(`${pages.size} pages, ${n} internal links, ${bad.length} broken`);
bad.forEach((b) => console.log("  " + b));
Deno.exit(bad.length ? 1 : 0);
