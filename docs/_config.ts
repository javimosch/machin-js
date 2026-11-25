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
    page.data.title = heading ? heading[1] : "machin-js";
  }
});

//why: give headings GitHub-style ids, so `page.md#section` links resolve in both places.
site.process([".html"], (pages) => {
  for (const page of pages) {
    for (const h of page.document.querySelectorAll("h2, h3")) {
      const slug = (h.textContent ?? "").toLowerCase().replace(/[^\w\- ]/g, "").trim().replace(/ /g, "-");
      h.setAttribute("id", slug);
    }
  }
});

export default site;
