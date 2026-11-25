import lume from "lume/mod.ts";
import basePath from "lume/plugins/base_path.ts";
import resolveUrls from "lume/plugins/resolve_urls.ts";
import codeHighlight from "lume/plugins/code_highlight.ts";

const site = lume({ location: new URL("https://javimosch.github.io/machin-js/") });

//why: pages link to each other as `page.md`, so the same links work on GitHub and on the site.
site.use(resolveUrls());
site.use(basePath());
site.use(codeHighlight());

site.data("layout", "layout.ts");
site.remoteFile("assets/logo.svg", import.meta.resolve("../assets/logo.svg"));
site.add("assets");

//why: the title comes from the page's own `# heading`, so the .md files need no front matter.
site.preprocess([".md"], (pages) => {
  for (const page of pages) {
    const heading = /^#\s+(.+)$/m.exec(String(page.data.content));
    page.data.title = heading ? heading[1].replace(/`/g, "") : "machin-js";
    //why: index.md is the plain index on GitHub; the site shows the designed landing page.
    if (page.src.path === "/index") page.data.layout = "home.ts";
  }
});

//why: give headings GitHub-style ids, so `page.md#section` links resolve in both places;
//     then build "On this page" from them and mark the `//why:` comments.
site.process([".html"], (pages) => {
  for (const page of pages) {
    const doc = page.document;
    const toc: string[] = [];
    for (const h of doc.querySelectorAll("h2, h3")) {
      const text = h.textContent ?? "";
      const slug = text.toLowerCase().replace(/[^\w\- ]/g, "").trim().replace(/ /g, "-");
      h.setAttribute("id", slug);
      if (h.tagName === "H2") {
        const a = doc.createElement("a");
        a.setAttribute("href", `#${slug}`);
        a.textContent = text;
        toc.push(a.outerHTML);
      }
    }
    const aside = doc.querySelector(".toc");
    if (aside && toc.length > 1) aside.innerHTML = `<p>On this page</p>${toc.join("")}`;
    for (const c of doc.querySelectorAll(".hljs-comment")) {
      if ((c.textContent ?? "").startsWith("//why:")) c.classList.add("why");
    }
  }
});

export default site;
