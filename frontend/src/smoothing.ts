/**
 * "Freihand glätten": when a freehand stroke is finished, its jitter is
 * removed (Ramer–Douglas–Peucker) and the remaining points are rounded into
 * a smooth curve (Chaikin's corner cutting). The stroke stays a freehand
 * element, so it keeps its hand-drawn look, just without the wobble.
 *
 * Switched on by default; the choice is remembered per browser.
 */
import { CaptureUpdateAction, newElementWith } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

type Point = [number, number];

const STORAGE_KEY = "xudwSmoothFreehand";

export function smoothingEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSmoothingEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // no storage: only for this page
  }
}

/** Distance of p from the line a–b. */
function distance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

/** Ramer–Douglas–Peucker: keeps only the points that shape the line. */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  let max = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distance(points[i], points[0], points[points.length - 1]);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max <= tolerance) return [points[0], points[points.length - 1]];
  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** Chaikin's corner cutting: rounds the corners into a smooth curve; ends stay. */
function chaikin(points: Point[], iterations: number): Point[] {
  let pts = points;
  for (let k = 0; k < iterations; k++) {
    if (pts.length < 3) return pts;
    const next: Point[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      next.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1]);
      next.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

export function smoothPoints(points: Point[], zoom: number): Point[] {
  // tolerance in board units: about 2.5 screen pixels
  const simplified = simplify(points, 2.5 / Math.max(zoom, 0.1));
  return chaikin(simplified, 3);
}

/** Watches the board and smooths each freehand stroke when it is finished. */
export function installSmoothing(api: ExcalidrawImperativeAPI): () => void {
  let drawing: string | null = null;
  return api.onChange((elements, appState) => {
    const current = appState.newElement?.type === "freedraw" ? appState.newElement.id : null;
    if (current !== null) {
      drawing = current;
      return;
    }
    if (drawing === null) return;
    const finished = drawing;
    drawing = null;
    if (!smoothingEnabled()) return;
    const el = elements.find((e) => e.id === finished && !e.isDeleted);
    if (!el || el.type !== "freedraw" || el.points.length < 4) return;
    const points = smoothPoints(el.points as unknown as Point[], appState.zoom.value);
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const smoothed = newElementWith(el as never, {
      points,
      pressures: [],
      simulatePressure: true,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    } as never);
    // after Excalidraw has finished its own update
    window.setTimeout(() => {
      api.updateScene({
        elements: api.getSceneElementsIncludingDeleted().map((e) => (e.id === finished ? smoothed : e)) as never,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }, 0);
  });
}
