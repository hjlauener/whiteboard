/**
 * Tool 4 of the toolbar: "Notizzettel" instead of the ellipse. A click (or
 * the key 4) opens the sticky notes below it: colours, square or round and
 * "Stapel" (NotesPanel, stickyNotes.ts); a colour inserts the note (or pad)
 * in the middle of the view.
 *
 * Excalidraw's toolbar cannot be extended, so the ellipse button is hidden
 * and a copy of it with the note icon is put in its place (the copy has no
 * Excalidraw handlers). The ellipse remains reachable with the key O.
 */
import { createRoot, type Root } from "react-dom/client";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { insertItem, NotesPanel } from "./shapes/ShapesSidebar.tsx";
import type { BoardConfig } from "./types.ts";

const ICON =
  '<svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M4 3.5h12a.5.5 0 0 1 .5.5v8.5l-4 4H4a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z"/><path d="M16.5 12.5h-3.5a.5.5 0 0 0-.5.5v3.5"/></svg>';

export function installNotesTool(api: ExcalidrawImperativeAPI, container: HTMLElement, config: BoardConfig): () => void {
  if (!config.canEdit) return () => undefined;
  let tool: HTMLLabelElement | null = null;
  let popover: HTMLDivElement | null = null;
  let root: Root | null = null;

  const close = () => {
    if (root) {
      const old = root;
      window.setTimeout(() => old.unmount(), 0);
    }
    root = null;
    popover?.remove();
    popover = null;
    const input = tool?.querySelector("input");
    if (input) input.checked = false;
  };

  const open = () => {
    if (!tool) return;
    close();
    const rect = tool.getBoundingClientRect();
    popover = document.createElement("div");
    popover.className = "xudw-notes-popover";
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${rect.bottom + 8}px`;
    container.appendChild(popover);
    root = createRoot(popover);
    root.render(
      <NotesPanel
        config={config}
        onInsert={(item) => {
          insertItem(api, item);
          close();
        }}
      />,
    );
    const input = tool.querySelector("input");
    if (input) input.checked = true;
  };

  const toggle = () => (popover ? close() : open());

  /** puts the notes tool in place of the ellipse (again after Excalidraw re-rendered the toolbar) */
  const place = () => {
    const ellipse = container.querySelector('input[data-testid="toolbar-ellipse"]')?.closest("label");
    if (!ellipse) return;
    if (ellipse.style.display !== "none") ellipse.style.display = "none";
    if (tool && tool.isConnected && tool.nextElementSibling === ellipse) return;
    tool = ellipse.cloneNode(true) as HTMLLabelElement;
    tool.style.display = "";
    tool.classList.add("xudw-notes-tool");
    tool.setAttribute("title", `${config.texts.shapesLibNotes} — 4`);
    tool.removeAttribute("data-xudw-tip");
    const input = tool.querySelector("input");
    if (input) {
      input.name = "xudw-notes-tool";
      input.checked = false;
      input.setAttribute("data-testid", "toolbar-notes");
      input.setAttribute("aria-label", config.texts.shapesLibNotes);
      input.setAttribute("aria-keyshortcuts", "4");
    }
    const svg = tool.querySelector(".ToolIcon__icon svg");
    if (svg) svg.outerHTML = ICON;
    tool.addEventListener("click", (event) => {
      event.preventDefault();
      toggle();
    });
    ellipse.before(tool);
  };

  // key 4: the notes instead of the ellipse
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "4" || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
    if (api.getAppState().editingTextElement) return;
    event.preventDefault();
    event.stopPropagation();
    toggle();
  };
  const onDown = (event: PointerEvent) => {
    const target = event.target as Node;
    if (popover && !popover.contains(target) && !tool?.contains(target)) close();
  };
  const onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && popover) close();
  };

  const observer = new MutationObserver(place);
  observer.observe(container, { childList: true, subtree: true });
  window.addEventListener("keydown", onKey, true);
  // capture: Excalidraw handles Esc itself and stops it
  window.addEventListener("keydown", onEscape, true);
  document.addEventListener("pointerdown", onDown, true);
  place();
  return () => {
    observer.disconnect();
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("keydown", onEscape, true);
    document.removeEventListener("pointerdown", onDown, true);
    close();
    tool?.remove();
  };
}
