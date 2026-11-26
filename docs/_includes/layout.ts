// Documentation pages: sidebar, article, "on this page", previous/next.
import { REPO, shell } from "./shell.ts";

/** Sidebar order; also drives the previous/next links. */
const NAV: [string, [string, string][]][] = [
  ["Learn", [["/getting-started/", "Getting started"], ["/tutorial/", "Reading the todo app"], ["/debugging/", "Debugging"]]],
  ["Reference", [["/language/", "The JavaScript you can write"], ["/diagnostics/", "Diagnostics"], ["/modules/", "Modules"]]],
  ["Under the hood", [["/how-it-works/", "How it works"], ["/troubleshooting/", "Troubleshooting"]]],
  ["Project", [["/VISION/", "Vision"], ["/NORTH-STAR/", "North star"], ["/ROADMAP/", "Roadmap"]]],
];
const PAGES = NAV.flatMap(([, links]) => links);

/** Render a documentation page around the Markdown content. */
export default function (data: { title: string; url: string; content: string }) {
  //why: the empty <aside class="toc"> is filled after rendering, once headings have ids.
  const at = PAGES.findIndex(([href]) => href === data.url);
  const group = NAV.find(([, links]) => links.some(([href]) => href === data.url))?.[0] ?? "Docs";
  const link = ([href, label]: [string, string]) =>
    `<a href="${href}"${href === data.url ? ' aria-current="page"' : ""}>${label}</a>`;
  const side = NAV.map(([name, links]) => `<p>${name}</p>${links.map(link).join("")}`).join("");
  const step = (i: number, dir: string, label: string) =>
    PAGES[i] ? `<a class="${dir}" href="${PAGES[i][0]}"><small>${label}</small>${PAGES[i][1]}</a>` : "<span></span>";
  return shell({
    title: `${data.title} · machin-js`,
    kind: "doc",
    menu: true,
    body: `<div class="docs">
  <nav class="side" id="side" aria-label="Documentation">${side}</nav>
  <main>
    <p class="crumb">${group}</p>
    <article class="prose">${data.content}</article>
    <div class="pager">${at >= 0 ? step(at - 1, "prev", "Previous") + step(at + 1, "next", "Next") : ""}</div>
    <footer>MIT licensed · <a href="${REPO}">source</a> · built with Lume</footer>
  </main>
  <aside class="toc" aria-label="On this page"></aside>
</div>`,
  });
}
