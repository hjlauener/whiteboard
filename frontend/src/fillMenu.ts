/**
 * "Füllung": Excalidraw shows the fill styles (hatched, cross-hatched,
 * solid) only when there is already a background colour. The build shows
 * them for every fillable element (alwaysShowFill() in vite.config.ts); here:
 * - choosing a fill style without background colour sets a colour, so that
 *   the fill can be seen: a middle grey for hatched and cross-hatched (the
 *   lines need a stronger colour), the first light colour for solid;
 * - a button "Füllung entfernen" (bin) in the same row makes the background
 *   transparent again.
 * Excalidraw has no interface for this row, so the button is added when the
 * row appears (like linePatternMenu.tsx).
 */
import { CaptureUpdateAction, newElementWith } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { DEFAULT_PALETTE, PALETTES } from "../palettes.ts";
import type { BoardConfig } from "./types.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** element types with a background (as Excalidraw's hasBackground) */
const FILLABLE = new Set(["rectangle", "ellipse", "diamond", "line", "freedraw", "embeddable"]);

const TRASH =
  '<svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
  '<path stroke-width="1.25" d="M3.333 5.833h13.334M8.333 9.167v5M11.667 9.167v5M4.167 5.833l.833 10c0 .92.746 1.667 1.667 1.667h6.666c.92 0 1.667-.746 1.667-1.667l.833-10M7.5 5.833v-2.5c0-.46.373-.833.833-.833h3.334c.46 0 .833.373.833.833v2.5"/></svg>';

function isTransparent(color: string | undefined): boolean {
  return !color || color === "transparent" || (color.length === 9 && color.endsWith("00"));
}

/** sets the background of the selected fillable elements (and of new ones) */
function setBackground(api: ExcalidrawImperativeAPI, color: string, onlyIfTransparent: boolean): void {
  const app = api.getAppState();
  const selected = app.selectedElementIds ?? {};
  let changed = false;
  const elements = api.getSceneElementsIncludingDeleted().map((e: any) => {
    if (!selected[e.id] || e.isDeleted || !FILLABLE.has(e.type)) return e;
    if (onlyIfTransparent && !isTransparent(e.backgroundColor)) return e;
    if (e.backgroundColor === color) return e;
    changed = true;
    return newElementWith(e, { backgroundColor: color } as never);
  });
  const appState = !onlyIfTransparent || isTransparent(app.currentItemBackgroundColor) ? { currentItemBackgroundColor: color } : {};
  if (!changed && Object.keys(appState).length === 0) return;
  api.updateScene({
    ...(changed ? { elements: elements as never } : {}),
    appState: appState as never,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
}

export function installFillMenu(api: ExcalidrawImperativeAPI, container: HTMLElement, config: BoardConfig): () => void {
  const palette = PALETTES[config.palette] ?? PALETTES[DEFAULT_PALETTE];
  const light = palette.background.find((c) => !isTransparent(c)) ?? "#ffec99";
  const middle = palette.families.greys?.[3] ?? palette.families.blacks?.[0] ?? "#868e96";

  const place = () => {
    if (!config.canEdit) return;
    const option = container.querySelector<HTMLElement>('[data-testid="fill-hachure"]');
    const row = option?.closest<HTMLElement>(".buttonList");
    if (!row || row.querySelector(".xudw-fill-remove")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "xudw-fill-remove";
    button.title = config.texts.fillRemove;
    button.setAttribute("aria-label", config.texts.fillRemove);
    button.innerHTML = TRASH;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      setBackground(api, "transparent", false);
    });
    row.appendChild(button);
  };

  // a fill style chosen without background colour: give it the first light colour
  const onClick = (event: MouseEvent) => {
    const option = (event.target as HTMLElement).closest<HTMLElement>('[data-testid^="fill-"]');
    if (!option || !container.contains(option)) return;
    const hatched = option.dataset.testid !== "fill-solid";
    window.setTimeout(() => setBackground(api, hatched ? middle : light, true), 0);
  };

  const observer = new MutationObserver(place);
  observer.observe(container, { childList: true, subtree: true });
  container.addEventListener("click", onClick, true);
  place();
  return () => {
    observer.disconnect();
    container.removeEventListener("click", onClick, true);
  };
}
