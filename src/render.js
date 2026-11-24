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
function renderLine(t) {
  //why: a text form lets the CLI demo and tests avoid HTML parsing.
  const mark = t.done == 1 ? "[x]" : "[ ]";
  return mark + " " + String(t.id) + " " + t.title;
}

/**
 * One todo as an HTML list item.
 * @param {Todo} t
 * @returns {string}
 */
function renderItem(t) {
  //why: title is user input, so it is escaped here, at the only place it enters HTML.
  const cls = t.done == 1 ? "done" : "open";
  return "<li class=\"" + cls + "\">" + escapeHtml(t.title) + "</li>";
}

/**
 * The whole todo list as an HTML page.
 * @param {Todo[]} todos
 * @returns {string}
 */
function renderPage(todos) {
  //why: server-side rendering keeps the pilot free of wasm and a client build.
  let items = "";
  for (let i = 0; i < todos.length; i++) {
    items = items + renderItem(todos[i]);
  }
  return "<!doctype html><title>todos</title><ul>" + items + "</ul>";
}
