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
import { addAnchor } from "../linePatterns.ts";
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

  /** where the right click was, in board coordinates */
  let clicked: { x: number; y: number } | null = null;
  const onContextMenu = (event: MouseEvent) => {
    const app = api.getAppState();
    clicked = { x: (event.clientX - app.offsetLeft) / app.zoom.value - app.scrollX, y: (event.clientY - app.offsetTop) / app.zoom.value - app.scrollY };
  };
  container.addEventListener("contextmenu", onContextMenu, true);

  const menuItem = (text: string, run: () => void): HTMLElement => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "context-menu-item";
    const label = document.createElement("div");
    label.className = "context-menu-item__label";
    label.textContent = text;
    button.appendChild(label);
    button.appendChild(document.createElement("kbd")).className = "context-menu-item__shortcut";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      run();
      api.updateScene({ appState: { contextMenu: null } as never, captureUpdate: CaptureUpdateAction.NEVER });
    });
    li.appendChild(button);
    return li;
  };

  const extend = (menu: HTMLElement) => {
    if (menu.dataset.xudw === "1") return;
    menu.dataset.xudw = "1";
    const selected = Object.keys(api.getAppState().selectedElementIds ?? {});
    const elements = api.getSceneElements().filter((e) => selected.includes(e.id) && !(e.type === "text" && e.containerId));
    if (elements.length === 0) return;

    // one line or arrow: add an anchor point where the right click was
    const single = elements.length === 1 ? (elements[0] as unknown as { id: string; type: string; elbowed?: boolean }) : null;
    const anchorItem =
      single && (single.type === "line" || single.type === "arrow") && !single.elbowed && clicked
        ? menuItem(t.ctxAddPoint, () => {
            if (clicked) addAnchor(api, single.id, clicked.x, clicked.y);
          })
        : null;

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
    if (options.length === 0 && anchorItem === null) return;

    const items: HTMLElement[] = options.map((to) =>
      menuItem(labels[to], () => {
        const result = executeCommands(api, [{ cmd: "convert", targets: elements.map((e) => e.id), to }], [1]);
        if (result.problems.length > 0) {
          api.setToast({ message: result.problems[0].message, closable: true });
        }
      }),
    );
    if (anchorItem) items.unshift(anchorItem);
    const separator = document.createElement("hr");
    separator.className = "context-menu-item-separator";
    menu.prepend(...items, separator);
  };

  const observer = new MutationObserver(() => {
    if (!config.canEdit) return;
    container.querySelectorAll<HTMLElement>("ul.context-menu").forEach(extend);
  });
  observer.observe(container, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    container.removeEventListener("contextmenu", onContextMenu, true);
  };
}
