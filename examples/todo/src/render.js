import { replace } from "machin";
/** @typedef {import("./model.js").Todo} Todo */

/**
 * Escape text for safe inclusion in HTML.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  //why: & first, or the & in &lt; would itself get escaped.
  return replace(replace(replace(s, "&", "&amp;"), "<", "&lt;"), ">", "&gt;");
}

/**
 * One todo as a plain text line, e.g. "[x] 3 buy milk".
 * @param {Todo} t
 * @returns {string}
 */
export function renderLine(t) {
  //why: a text form lets the CLI demo and tests avoid HTML parsing.
  const mark = t.done == 1 ? "[x]" : "[ ]";
  return mark + " " + String(t.id) + " " + t.title;
}

/**
 * A one-button form that POSTs to `action`.
 * @param {string} action URL path to post to.
 * @param {string} label Button text; must already be HTML-escaped.
 * @returns {string}
 */
function renderButton(action, label) {
  //why: plain forms, not JavaScript — the page works with no client code at all.
  return "<form method=\"post\" action=\"" + action + "\"><button>" + label + "</button></form>";
}

/**
 * One todo as an HTML list item: a toggle button (its label) and a delete button.
 * @param {Todo} t
 * @returns {string}
 */
function renderItem(t) {
  //why: title is user input, so it is escaped here, at the only place it enters HTML.
  const cls = t.done == 1 ? "done" : "open";
  const toggle = renderButton("/toggle/" + String(t.id), escapeHtml(t.title));
  return "<li class=\"" + cls + "\">" + toggle + renderButton("/delete/" + String(t.id), "x") + "</li>";
}

/**
 * The page stylesheet: a narrow centered column, done items struck through.
 * @returns {string}
 */
function renderStyle() {
  //why: inline <style> keeps the app one binary with no static-file serving.
  return "<style>body{font:16px sans-serif;max-width:28rem;margin:2rem auto}ul{padding:0;list-style:none}li{display:flex;gap:.5rem}li form:first-child{flex:1}li form:first-child button{width:100%;text-align:left}.done form:first-child button{text-decoration:line-through;color:#888}</style>";
}

/**
 * The whole todo list as an HTML page, with an add form on top.
 * @param {Todo[]} todos
 * @returns {string}
 */
export function renderPage(todos) {
  //why: server-side rendering keeps the pilot free of wasm and a client build.
  const form = "<form method=\"post\" action=\"/add\"><input name=\"title\" placeholder=\"what needs doing?\"><button>add</button></form>";
  let items = "";
  for (let i = 0; i < todos.length; i++) {
    items = items + renderItem(todos[i]);
  }
  return "<!doctype html><title>todos</title>" + renderStyle() + "<h1>todos</h1>" + form + "<ul>" + items + "</ul>";
}
