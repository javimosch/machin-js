// The landing page. index.md stays a plain index for readers on GitHub; the site shows this.
import { REPO, shell } from "./shell.ts";

//why: both snippets are copied from examples/todo (src/store.js and gold/store.src).
const JS = `/**
 * Flip a todo between done and not done.
 * @param {int} db
 * @param {int} id
 * @returns {int} sqlite result code, 0 on success.
 */
export function toggleTodo(db, id) {
  //why: 1 - done flips 0<->1 in SQL, so no read-modify-write race.
  return sqlite_exec(db, "UPDATE todos SET done = 1 - done WHERE id = ?", [String(id)]);
}`;
const MFL = `func toggleTodo(db, id) (r) {
    return sqlite_exec(db, "UPDATE todos SET done = 1 - done WHERE id = ?", []string{str(id)})
}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One code panel with a file-name tab. */
const panel = (cls: string, name: string, lang: string, code: string) =>
  `<figure class="panel ${cls}"><figcaption>${name}</figcaption><pre><code class="language-${lang}">${esc(code)}</code></pre></figure>`;

/** Render the landing page. */
export default function () {
  return shell({
    title: "machin-js — native apps in JavaScript you can read",
    kind: "home",
    body: `<main>
<section class="hero wrap">
  <h1>Native apps in JavaScript you can <mark>still read</mark> when the agent is off.</h1>
  <p class="lede">machin-js compiles a strict, documented subset of JavaScript to <a href="https://github.com/javimosch/machin">machin</a>, and from there to a single native binary.</p>
  <p class="actions"><a class="btn primary" href="/getting-started/">Get started</a><a class="btn" href="/tutorial/">Read the todo app</a></p>
  <p class="lede"><code>machin-js new hello && cd hello && machin-js run main.js</code></p>
  <p><a href="${REPO}/releases/tag/v0.9.0">v0.9.0 alpha</a> · Linux x86-64</p>
</section>
<section class="flow wrap" aria-label="From JavaScript to a native binary">
  ${panel("source", "store.js — you read and edit this", "javascript", JS)}
  <p class="arrow">transpiles to ↓</p>
  ${panel("output", "store.src — generated machin", "go", MFL)}
  <p class="arrow">which <code>machin build</code> turns into a native binary</p>
</section>
<section class="wrap three">
  <div><h2>The compiler keeps it readable</h2><p>A function without JSDoc or a <code>//why:</code> line, or longer than 20 lines, does not compile. That holds for agent-written code too.</p><a href="/diagnostics/">Every rule →</a></div>
  <div><h2>Debug it as plain JavaScript</h2><p>The same modules run under Deno, with a real debugger. A native crash on a bad list index names your <code>.js</code> line, column and expression.</p><a href="/debugging/">How to debug →</a></div>
  <div><h2>One core, thin shells</h2><p>The todo app's SQLite store is shared unchanged by its web server and its desktop window.</p><a href="/tutorial/">Take the tour →</a></div>
</section>
<section class="shots"><div class="wrap">
  <h2>One todo app, two front ends</h2>
  <div class="pair">
    <figure><img src="/assets/shots/web.png" alt="The web todo app: an add box and three todos, the first struck through" width="500" height="220"><figcaption>Web: server-rendered HTML, no client JavaScript</figcaption></figure>
    <figure><img src="/assets/shots/desktop.png" alt="The desktop todo window: three todos with checkboxes and delete buttons" width="480" height="230"><figcaption>Desktop: a raylib window (an early spike)</figcaption></figure>
  </div>
</div></section>
<section class="wrap honest">
  <h2>It is alpha, and says so</h2>
  <p>There are four worked examples: a todo app, a command-line tool, a small API and an agent-first CLI. No classes, <code>async</code>, decimals, <code>.map()</code> or nested JSON input yet. <a href="/language/">See exactly what works</a>, and <a href="/NORTH-STAR/">where it is going</a>.</p>
  <p class="actions"><a class="btn primary" href="/getting-started/">Get started</a><a class="btn" href="${REPO}">View on GitHub</a></p>
</section>
<footer class="wrap">MIT licensed · <a href="${REPO}">source</a> · built with Lume</footer>
</main>`,
  });
}
