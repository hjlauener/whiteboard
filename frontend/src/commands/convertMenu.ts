/**
 * Right click on an element: "In Rechteck/Ellipse/Raute/Notiz umwandeln"
 * (shapes) or "In Pfeil/Linie umwandeln" (arrows, lines).
 *
 * Excalidraw has no interface to extend its context menu, so the entries are
 * added to its menu (ul.context-menu) when it appears. They run the command
 * "convert" of the command language, so the change is one undoable step and
 * is synchronised like every other change.
 */
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { executeCommands } from "./execute.ts";
import type { BoardConfig } from "../types.ts";

type Target = "rect" | "ellipse" | "diamond" | "note" | "arrow" | "line";

const NOTE_FILL = "#ffec99";

export function installConvertMenu(api: ExcalidrawImperativeAPI, container: HTMLElement, config: BoardConfig): () => void {
  const t = config.texts;
  const labels: Record<Target, string> = {
    rect: t.ctxConvertRect,
    ellipse: t.ctxConvertEllipse,
    diamond: t.ctxConvertDiamond,
    note: t.ctxConvertNote,
    arrow: t.ctxConvertArrow,
    line: t.ctxConvertLine,
  };

  const extend = (menu: HTMLElement) => {
    if (menu.dataset.xudw === "1") return;
    menu.dataset.xudw = "1";
    const selected = Object.keys(api.getAppState().selectedElementIds ?? {});
    const elements = api.getSceneElements().filter((e) => selected.includes(e.id) && !(e.type === "text" && e.containerId));
    if (elements.length === 0) return;

    let options: Target[] = [];
    if (elements.every((e) => ["rectangle", "ellipse", "diamond"].includes(e.type))) {
      options = ["rect", "ellipse", "diamond", "note"];
      if (elements.length === 1) {
        const e = elements[0];
        const current: Target = e.type === "rectangle" ? (e.backgroundColor === NOTE_FILL ? "note" : "rect") : (e.type as Target);
        options = options.filter((o) => o !== current);
      }
    } else if (elements.every((e) => e.type === "arrow" || e.type === "line")) {
      options = elements.every((e) => e.type === "arrow") ? ["line"] : elements.every((e) => e.type === "line") ? ["arrow"] : ["arrow", "line"];
    }
    if (options.length === 0) return;

    const items: HTMLElement[] = options.map((to) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "context-menu-item";
      const label = document.createElement("div");
      label.className = "context-menu-item__label";
      label.textContent = labels[to];
      button.appendChild(label);
      button.appendChild(document.createElement("kbd")).className = "context-menu-item__shortcut";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const result = executeCommands(api, [{ cmd: "convert", targets: elements.map((e) => e.id), to }], [1]);
        api.updateScene({ appState: { contextMenu: null } as never, captureUpdate: CaptureUpdateAction.NEVER });
        if (result.problems.length > 0) {
          api.setToast({ message: result.problems[0].message, closable: true });
        }
      });
      li.appendChild(button);
      return li;
    });
    const separator = document.createElement("hr");
    separator.className = "context-menu-item-separator";
    menu.prepend(...items, separator);
  };

  const observer = new MutationObserver(() => {
    if (!config.canEdit) return;
    container.querySelectorAll<HTMLElement>("ul.context-menu").forEach(extend);
  });
  observer.observe(container, { childList: true, subtree: true });
  return () => observer.disconnect();
}
