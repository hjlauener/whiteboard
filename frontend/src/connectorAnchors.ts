/**
 * Anchor points for connecting objects (like in Miro): while the line or
 * arrow tool is active, an object near the pointer shows four anchor points
 * (top, right, bottom, left; the nearest one highlighted). A line that starts
 * or ends at an anchor point snaps to it and is attached to the object: when
 * the object is moved, the line follows and stays at the anchor.
 *
 * Excalidraw attaches only arrows to objects, so an attached line becomes an
 * arrow without heads (it looks the same). Excalidraw moves it along while an
 * object is dragged; afterwards its ends are put back on the anchors
 * (customData.xudwAnchors), because Excalidraw would let them slide along the
 * outline.
 */
import { CaptureUpdateAction, newElementWith, restoreElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type El = Record<string, any>;
type Point = [number, number];
type Side = "n" | "e" | "s" | "w";

interface Anchor {
  id: string;
  side: Side;
}

const SHAPES = new Set(["rectangle", "ellipse", "diamond"]);
const SIDES: readonly Side[] = ["n", "e", "s", "w"];
/** how near (screen pixels) the pointer must be to an object to show its anchors */
const NEAR = 40;
/** how near (screen pixels) an end must be to an anchor to snap */
const SNAP = 18;

/** position of an anchor on the board (rotation of the object included) */
function anchorPoint(el: El, side: Side): Point {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const local: Record<Side, Point> = {
    n: [cx, el.y],
    e: [el.x + el.width, cy],
    s: [cx, el.y + el.height],
    w: [el.x, cy],
  };
  const [px, py] = local[side];
  const a = el.angle ?? 0;
  if (!a) return [px, py];
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [cx + (px - cx) * cos - (py - cy) * sin, cy + (px - cx) * sin + (py - cy) * cos];
}

/** the topmost object whose (enlarged) box contains the point */
function shapeNear(elements: readonly El[], x: number, y: number, margin: number, exclude?: string): El | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.isDeleted || el.id === exclude || !SHAPES.has(el.type) || el.locked) continue;
    if (x >= el.x - margin && x <= el.x + el.width + margin && y >= el.y - margin && y <= el.y + el.height + margin) return el;
  }
  return null;
}

/** the anchor within reach of the point, if any */
function anchorAt(elements: readonly El[], x: number, y: number, reach: number, exclude?: string): Anchor | null {
  let best: Anchor | null = null;
  let bestDistance = reach;
  for (const el of elements) {
    if (el.isDeleted || el.id === exclude || !SHAPES.has(el.type) || el.locked) continue;
    for (const side of SIDES) {
      const [ax, ay] = anchorPoint(el, side);
      const d = Math.hypot(ax - x, ay - y);
      if (d <= bestDistance) {
        bestDistance = d;
        best = { id: el.id, side };
      }
    }
  }
  return best;
}

export function installConnectorAnchors(api: ExcalidrawImperativeAPI, container: HTMLElement): () => void {
  const layer = document.createElement("div");
  layer.className = "xudw-anchors";
  container.appendChild(layer);
  const dots = SIDES.map(() => {
    const dot = document.createElement("div");
    dot.className = "xudw-anchor";
    layer.appendChild(dot);
    return dot;
  });
  layer.hidden = true;

  let pointer: Point | null = null;
  let drawing: string | null = null;

  const toScene = (clientX: number, clientY: number): Point => {
    const app = api.getAppState();
    return [(clientX - app.offsetLeft) / app.zoom.value - app.scrollX, (clientY - app.offsetTop) / app.zoom.value - app.scrollY];
  };
  const toClient = ([x, y]: Point): Point => {
    const app = api.getAppState();
    return [(x + app.scrollX) * app.zoom.value + app.offsetLeft, (y + app.scrollY) * app.zoom.value + app.offsetTop];
  };

  /** shows the anchors of the object near the pointer while a line or arrow is drawn */
  const showAnchors = () => {
    const app = api.getAppState();
    const tool = app.activeTool?.type;
    const connecting = (tool === "line" || tool === "arrow") && app.currentItemArrowType !== "elbow";
    if (!connecting || pointer === null) {
      layer.hidden = true;
      return;
    }
    const zoom = app.zoom.value;
    const elements = api.getSceneElements() as unknown as El[];
    const current = (app.newElement ?? app.multiElement)?.id;
    const shape = shapeNear(elements, pointer[0], pointer[1], NEAR / zoom, current);
    if (!shape) {
      layer.hidden = true;
      return;
    }
    const hot = anchorAt([shape], pointer[0], pointer[1], SNAP / zoom);
    SIDES.forEach((side, i) => {
      const [cx, cy] = toClient(anchorPoint(shape, side));
      dots[i].style.left = `${cx}px`;
      dots[i].style.top = `${cy}px`;
      // not on top of the toolbar, the properties panel or other panels
      const under = document.elementFromPoint(cx, cy);
      dots[i].hidden = !under || !!under.closest(".Island, .xudw-notes-popover, .xudw-tpl-menu, .xudw-status-slot") || !container.contains(under);
      dots[i].classList.toggle("xudw-anchor-hot", hot?.side === side);
    });
    layer.hidden = false;
  };

  const onMove = (event: PointerEvent) => {
    pointer = toScene(event.clientX, event.clientY);
    showAnchors();
  };
  container.addEventListener("pointermove", onMove, true);

  const removeChange = api.onChange((elements, appState) => {
    const all = elements as unknown as El[];
    const current = appState.newElement ?? appState.multiElement;
    if (current && (current.type === "line" || current.type === "arrow") && !(current as El).elbowed) {
      drawing = current.id;
      showAnchors();
      return;
    }
    showAnchors();
    if (appState.selectedElementsAreBeingDragged || appState.editingLinearElement) return;

    const fixes = new Map<string, El>();
    if (drawing !== null) {
      const id = drawing;
      drawing = null;
      const el = all.find((e) => e.id === id && !e.isDeleted);
      const attached = el ? attach(el, all, appState.zoom.value) : null;
      if (attached) fixes.set(id, attached);
    }
    for (const el of all) {
      if (el.isDeleted || !el.customData?.xudwAnchors || fixes.has(el.id)) continue;
      const fixed = keepOnAnchors(el, all);
      if (fixed) fixes.set(el.id, fixed);
    }
    if (fixes.size === 0) return;
    window.setTimeout(() => apply(api, fixes, all), 0);
  });

  return () => {
    removeChange();
    container.removeEventListener("pointermove", onMove, true);
    layer.remove();
  };
}

/** a line or arrow just drawn: snap its ends to anchors in reach and attach them */
function attach(el: El, all: readonly El[], zoom: number): El | null {
  if ((el.type !== "line" && el.type !== "arrow") || el.elbowed) return null;
  const pts = el.points as Point[];
  const abs = pts.map((p) => [el.x + p[0], el.y + p[1]] as Point);
  const reach = SNAP / zoom;
  const start = anchorAt(all, abs[0][0], abs[0][1], reach, el.id);
  const end = anchorAt(all, abs[abs.length - 1][0], abs[abs.length - 1][1], reach, el.id);
  if (!start && !end) return null;
  const byId = new Map(all.map((e) => [e.id, e]));
  if (start) abs[0] = anchorPoint(byId.get(start.id)!, start.side);
  if (end) abs[abs.length - 1] = anchorPoint(byId.get(end.id)!, end.side);
  // a line becomes an arrow without heads: only arrows can be attached
  const [restored] = restoreElements(
    [
      {
        ...el,
        type: "arrow",
        startArrowhead: el.type === "arrow" ? el.startArrowhead : null,
        endArrowhead: el.type === "arrow" ? el.endArrowhead : null,
        elbowed: false,
      } as never,
    ],
    null,
  ) as unknown as El[];
  const binding = (a: Anchor | null) => (a ? { elementId: a.id, focus: 0, gap: 0 } : null);
  return {
    ...placePoints(restored, abs),
    startBinding: binding(start) ?? restored.startBinding ?? null,
    endBinding: binding(end) ?? restored.endBinding ?? null,
    customData: { ...(el.customData ?? {}), xudwAnchors: { start, end } },
  };
}

/** after an object moved: the ends of an attached line back on its anchors */
function keepOnAnchors(el: El, all: readonly El[]): El | null {
  const anchors = el.customData.xudwAnchors as { start: Anchor | null; end: Anchor | null };
  const byId = new Map(all.map((e) => [e.id, e]));
  // the user moved an end away (Excalidraw removed the binding): that anchor is gone
  const start = anchors.start && el.startBinding?.elementId === anchors.start.id && byId.get(anchors.start.id) && !byId.get(anchors.start.id)!.isDeleted ? anchors.start : null;
  const end = anchors.end && el.endBinding?.elementId === anchors.end.id && byId.get(anchors.end.id) && !byId.get(anchors.end.id)!.isDeleted ? anchors.end : null;
  const pts = el.points as Point[];
  const abs = pts.map((p) => [el.x + p[0], el.y + p[1]] as Point);
  let moved = false;
  if (start) {
    const p = anchorPoint(byId.get(start.id)!, start.side);
    if (Math.hypot(p[0] - abs[0][0], p[1] - abs[0][1]) > 0.5) moved = true;
    abs[0] = p;
  }
  if (end) {
    const p = anchorPoint(byId.get(end.id)!, end.side);
    if (Math.hypot(p[0] - abs[abs.length - 1][0], p[1] - abs[abs.length - 1][1]) > 0.5) moved = true;
    abs[abs.length - 1] = p;
  }
  const lost = start !== anchors.start || end !== anchors.end;
  if (!moved && !lost) return null;
  const customData = { ...el.customData };
  if (start || end) customData.xudwAnchors = { start, end };
  else delete customData.xudwAnchors;
  return { ...(moved ? placePoints(el, abs) : el), customData };
}

/** element with new absolute points (origin at the first point) */
function placePoints(el: El, abs: Point[]): El {
  const [x0, y0] = abs[0];
  const points = abs.map(([px, py]) => [px - x0, py - y0] as Point);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { ...el, x: x0, y: y0, points, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/** writes the changes; the attached objects get the line in boundElements, so Excalidraw moves it along */
function apply(api: ExcalidrawImperativeAPI, fixes: Map<string, El>, before: readonly El[]): void {
  const bound = new Map<string, Set<string>>();
  for (const el of fixes.values()) {
    for (const b of [el.startBinding, el.endBinding]) {
      if (b?.elementId) (bound.get(b.elementId) ?? bound.set(b.elementId, new Set()).get(b.elementId)!).add(el.id);
    }
  }
  const changed = new Set(before.map((e) => e.id));
  api.updateScene({
    elements: api.getSceneElementsIncludingDeleted().map((e: any) => {
      const fix = fixes.get(e.id);
      if (fix) {
        const { id: _id, version: _v, versionNonce: _n, ...rest } = fix;
        return newElementWith(e, rest as never);
      }
      const add = bound.get(e.id);
      if (add && changed.has(e.id)) {
        const list = [...(e.boundElements ?? [])];
        let more = false;
        for (const id of add) {
          if (!list.some((b: { id: string }) => b.id === id)) {
            list.push({ id, type: "arrow" });
            more = true;
          }
        }
        if (more) return newElementWith(e, { boundElements: list } as never);
      }
      return e;
    }) as never,
    captureUpdate: CaptureUpdateAction.NEVER,
  });
}
