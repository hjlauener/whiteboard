/**
 * Hints of the toolbar ("Pfeil — A oder 5"): Excalidraw shows them as the
 * browser's own tooltip (title attribute), which appears at the mouse and
 * covers the tools next to it. Here the title is replaced by an own hint in
 * the same look: to the right of the tool (the toolbar stands upright on the
 * left), or about 100 pixels further right below it (toolbar on top).
 *
 * installToolbarHint: the hint text of Excalidraw ("Zum Verschieben …")
 * belongs to the toolbar; it is shown on top in the middle instead.
 */
const OFFSET_X = 100;
const OFFSET_Y = 8;

export function installToolbarHint(container: HTMLElement): () => void {
  const hint = document.createElement("div");
  hint.className = "xudw-toolbar-hint";
  container.appendChild(hint);
  const copy = () => {
    const text = container.querySelector(".App-toolbar .HintViewer")?.textContent ?? "";
    if (hint.textContent !== text) hint.textContent = text;
  };
  const observer = new MutationObserver(copy);
  observer.observe(container, { childList: true, subtree: true, characterData: true });
  copy();
  return () => {
    observer.disconnect();
    hint.remove();
  };
}

export function installToolbarTips(container: HTMLElement): () => void {
  const tip = document.createElement("div");
  tip.className = "xudw-tooltip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  container.appendChild(tip);

  /** the title attributes of the toolbar become data-xudw-tip */
  const takeTitles = () => {
    container.querySelectorAll<HTMLElement>(".App-toolbar-container [title]").forEach((el) => {
      const title = el.getAttribute("title");
      if (!title) return;
      el.dataset.xudwTip = title;
      el.removeAttribute("title");
    });
  };

  const show = (target: HTMLElement) => {
    const text = target.dataset.xudwTip;
    if (!text) return;
    const rect = target.getBoundingClientRect();
    tip.textContent = text;
    tip.hidden = false;
    const bar = target.closest(".App-toolbar-container")?.getBoundingClientRect();
    if (bar && bar.height > bar.width) {
      // upright toolbar: to the right of the tool
      tip.style.left = `${bar.right + OFFSET_Y}px`;
      tip.style.top = `${rect.top + (rect.height - tip.offsetHeight) / 2}px`;
      return;
    }
    // not beyond the right edge of the window
    const left = Math.min(rect.left + OFFSET_X, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${rect.bottom + OFFSET_Y}px`;
  };
  const hide = () => {
    tip.hidden = true;
  };

  const onOver = (event: PointerEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-xudw-tip]");
    if (target && container.contains(target)) show(target);
    else hide();
  };

  const observer = new MutationObserver(takeTitles);
  observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["title"] });
  container.addEventListener("pointerover", onOver);
  container.addEventListener("pointerleave", hide);
  container.addEventListener("pointerdown", hide, true);
  takeTitles();
  return () => {
    observer.disconnect();
    container.removeEventListener("pointerover", onOver);
    container.removeEventListener("pointerleave", hide);
    container.removeEventListener("pointerdown", hide, true);
    tip.remove();
  };
}
