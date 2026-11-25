// What every page shares: <head>, top bar, footer and the small script.
export const REPO = "https://github.com/javimosch/machin-js";

/** Wrap a page body in the common document. */
export function shell(o: { title: string; kind: string; body: string; menu?: boolean }) {
  //why: hrefs are written from the site root; Lume's base_path plugin adds /machin-js.
  const menu = o.menu ? `<button class="menu" aria-expanded="false" aria-controls="side">Menu</button>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${o.title}</title>
<meta name="description" content="Write native machin apps in plain JavaScript, readable enough to maintain when the agent is off.">
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Mono:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Sans:wght@400;600&display=swap">
<link rel="stylesheet" href="/assets/style.css">
<script src="/assets/site.js" defer></script>
</head>
<body class="${o.kind}">
<header class="top">
  ${menu}
  <a class="brand" href="/"><img src="/assets/logo.svg" alt="" width="30" height="30">machin-js</a>
  <span class="badge">alpha</span>
  <nav class="toplinks" aria-label="Site"><a href="/getting-started/">Docs</a><a href="/ROADMAP/">Roadmap</a><a href="${REPO}">GitHub</a></nav>
</header>
${o.body}
</body>
</html>`;
}
