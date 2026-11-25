// Two small conveniences; the site is fully readable without them.
const menu = document.querySelector(".menu");
menu?.addEventListener("click", () => {
  const open = document.body.classList.toggle("menu-open");
  menu.setAttribute("aria-expanded", String(open));
});

for (const pre of document.querySelectorAll(".prose pre")) {
  //why: the button sits outside <pre>, so it doesn't scroll away with long lines.
  const box = document.createElement("div");
  box.className = "codebox";
  pre.replaceWith(box);
  const button = document.createElement("button");
  button.className = "copy";
  button.textContent = "Copy";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(pre.innerText);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Select and copy";
    }
    setTimeout(() => (button.textContent = "Copy"), 1600);
  });
  box.append(pre, button);
}
