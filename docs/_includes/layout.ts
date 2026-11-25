// The one page layout: header, sidebar, article, previous/next.

/** Sidebar order; also drives the previous/next links. */
const NAV: [string, [string, string][]][] = [
  ["Learn", [["/", "Overview"], ["/getting-started/", "Getting started"], ["/tutorial/", "Reading the todo app"]]],
  ["Reference", [["/language/", "The JavaScript you can write"], ["/diagnostics/", "Diagnostics"], ["/modules/", "Modules"]]],
  ["Under the hood", [["/how-it-works/", "How it works"], ["/troubleshooting/", "Troubleshooting"]]],
  ["Project", [["/VISION/", "Vision"], ["/NORTH-STAR/", "North star"]]],
];
const PAGES = NAV.flatMap(([, links]) => links);
const REPO = "https://github.com/javimosch/machin-js";

/** Render a whole HTML page around the Markdown content. */
export default function (data: { title: string; url: string; content: string }) {
  //why: hrefs are written from the site root; Lume's base_path plugin adds /machin-js.
  const at = PAGES.findIndex(([href]) => href === data.url);
  const link = ([href, label]: [string, string]) =>
    `<a href="${href}"${href === data.url ? ' aria-current="page"' : ""}>${label}</a>`;
  const nav = NAV.map(([group, links]) => `<p>${group}</p>${links.map(link).join("")}`).join("");
  const prev = at > 0 ? `<a href="${PAGES[at - 1][0]}">← ${PAGES[at - 1][1]}</a>` : "<span></span>";
  const next = at >= 0 && at < PAGES.length - 1 ? `<a href="${PAGES[at + 1][0]}">${PAGES[at + 1][1]} →</a>` : "";
  const title = data.url === "/" ? "machin-js — native apps in JavaScript you can read" : `${data.title} · machin-js`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="Write native machin apps in plain JavaScript, readable enough to maintain when the agent is off.">
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<header>
  <a class="brand" href="/"><img src="/assets/logo.svg" alt="" width="32" height="32">machin-js</a>
  <span class="badge">alpha</span>
  <a class="gh" href="${REPO}">GitHub</a>
</header>
<div class="shell">
  <nav aria-label="Documentation">${nav}</nav>
  <main>
    <article>${data.content}</article>
    <div class="pager">${prev}${next}</div>
    <footer>MIT licensed · <a href="${REPO}">source</a> · built with Lume</footer>
  </main>
</div>
</body>
</html>`;
}
