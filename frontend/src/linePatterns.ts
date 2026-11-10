/**
 * "Linienform": lines and arrows as zigzag, wave, saw tooth, lightning, curls,
 * organic line, teeth and bumps, or loops.
 *
 * Excalidraw draws lines only straight or curved through their points, so the
 * pattern is made of points: they are computed along the original course of
 * the line (any number of points). The original course is kept in the
 * element (customData.xudwBase), so the pattern can be changed or removed
 * ("Gerade") at any time. Start and end stay where they are, so arrows stay
 * attached to their shapes.
 *
 * Used by the dropdown in the properties panel (linePatternMenu.ts) and by
 * the command language (parameter pattern=…).
 */
import { CaptureUpdateAction, newElementWith } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export const LINE_PATTERNS = ["straight", "zigzag", "wave", "saw", "lightning", "curl", "organic", "mixed", "loops"] as const;
export type LinePattern = (typeof LINE_PATTERNS)[number];

/* eslint-disable @typescript-eslint/no-explicit-any */
type El = Record<string, any>;
type Point = [number, number];

const STORAGE_KEY = "xudwLinePattern";

export function isLinePattern(value: unknown): value is LinePattern {
  return typeof value === "string" && (LINE_PATTERNS as readonly string[]).includes(value);
}

/** pattern for new lines and arrows (per browser, like the smoothing) */
export function currentLinePattern(): LinePattern {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isLinePattern(value) ? value : "straight";
  } catch {
    return "straight";
  }
}

export function setCurrentLinePattern(pattern: LinePattern): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, pattern);
  } catch {
    // no storage: only for this page
  }
}

export function patternOf(el: El): LinePattern {
  const value = el.customData?.xudwPattern;
  return isLinePattern(value) ? value : "straight";
}

/** the course of the line without pattern (relative points) */
export function basePoints(el: El): Point[] {
  const base = el.customData?.xudwBase;
  return Array.isArray(base) && base.length >= 2 ? (base as Point[]) : (el.points as Point[]);
}

// ----------------------------------------------------------------------
// the course of the line: position and direction at a distance s from the start
// ----------------------------------------------------------------------

class Course {
  private readonly lengths: number[] = [0];
  readonly length: number;

  constructor(private readonly pts: readonly Point[]) {
    for (let i = 1; i < pts.length; i++) {
      this.lengths.push(this.lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    this.length = this.lengths[this.lengths.length - 1];
  }

  /** point at distance s, moved by n to the side (left of the direction) */
  at(s: number, n: number): Point {
    const clamped = Math.max(0, Math.min(this.length, s));
    let i = 1;
    while (i < this.pts.length - 1 && this.lengths[i] < clamped) i++;
    const [a, b] = [this.pts[i - 1], this.pts[i]];
    const seg = this.lengths[i] - this.lengths[i - 1] || 1;
    const t = (clamped - this.lengths[i - 1]) / seg;
    const dx = (b[0] - a[0]) / seg;
    const dy = (b[1] - a[1]) / seg;
    // beyond the ends (loops): continue in the direction of the end segment
    const extra = s - clamped;
    return [a[0] + (b[0] - a[0]) * t + dx * extra + dy * n, a[1] + (b[1] - a[1]) * t + dy * extra - dx * n];
  }
}

// ----------------------------------------------------------------------
// patterns: lists of [distance along the line, distance to the side]
// ----------------------------------------------------------------------

/** number of repetitions on a line of the given length, so that it ends where it began */
function periods(length: number, wavelength: number): number {
  return Math.max(1, Math.round(length / wavelength));
}

function sample(count: number, f: (t: number) => Point): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= count; i++) out.push(f(i / count));
  return out;
}

function shape(pattern: LinePattern, length: number, amplitude: number): Point[] {
  const A = amplitude;
  switch (pattern) {
    case "zigzag": {
      const p = periods(length, 4 * A);
      const w = length / p;
      const out: Point[] = [[0, 0]];
      for (let k = 0; k < 2 * p; k++) out.push([(k + 0.5) * (w / 2), k % 2 === 0 ? A : -A]);
      out.push([length, 0]);
      return out;
    }
    case "wave": {
      const p = periods(length, 5 * A);
      return sample(p * 16, (t) => [t * length, A * Math.sin(2 * Math.PI * p * t)]);
    }
    case "saw": {
      const p = periods(length, 3 * A);
      const w = length / p;
      const out: Point[] = [[0, 0]];
      for (let k = 1; k <= p; k++) {
        out.push([k * w, A]);
        if (k < p) out.push([k * w, -A]);
      }
      out.push([length, 0]);
      return out;
    }
    case "lightning": {
      const steps = Math.max(4, Math.round(length / (1.6 * A)));
      const w = length / steps;
      // repeating rhythm of calm and sharp turns
      const rhythm = [0, 0, 1.5, -1.1, 0.4, 0.9, -1.4, 0.3, 0, 1.1, -0.8, 0];
      const out: Point[] = [];
      for (let k = 0; k <= steps; k++) {
        out.push([k * w, k === 0 || k === steps ? 0 : rhythm[k % rhythm.length] * A]);
      }
      return out;
    }
    case "curl":
    case "loops": {
      // trochoid: a point on a rolling wheel; with a long arm it makes loops
      const p = periods(length, (pattern === "curl" ? 3.2 : 4.5) * A);
      const a = length / (2 * Math.PI * p);
      const b = pattern === "curl" ? Math.max(a * 1.8, 0.9 * A) : Math.max(a * 2.6, 1.8 * A);
      return sample(p * 28, (t) => {
        const theta = 2 * Math.PI * p * t;
        return [a * theta - b * Math.sin(theta), b * (Math.cos(theta) - 1)];
      });
    }
    case "organic": {
      const p = periods(length, 6 * A);
      return sample(p * 18, (t) => {
        const u = t * p;
        const wave = 0.65 * Math.sin(2 * Math.PI * u) + 0.3 * Math.sin(2 * Math.PI * 1.7 * u + 1) + 0.15 * Math.sin(2 * Math.PI * 3.1 * u + 2);
        const fade = Math.min(1, t * 6, (1 - t) * 6); // starts and ends on the line
        return [t * length, A * wave * fade];
      });
    }
    case "mixed": {
      const p = periods(length, 3.5 * A);
      const w = length / p;
      const out: Point[] = [[0, 0]];
      for (let k = 0; k < p; k++) {
        if (k % 2 === 0) {
          out.push([(k + 0.5) * w, -A], [(k + 1) * w, 0]);
        } else {
          for (let i = 1; i <= 8; i++) out.push([(k + i / 8) * w, A * Math.sin((Math.PI * i) / 8)]);
        }
      }
      return out;
    }
    default:
      return [[0, 0], [length, 0]];
  }
}

/**
 * Anchor points of a pattern for lines and arrows: few points, about one or
 * two per change of direction. Round patterns are drawn by Excalidraw as a
 * curve through them (curved), the others with sharp corners. The points
 * can be moved by hand, and more can be added (right click).
 */
function anchors(pattern: LinePattern, length: number, amplitude: number): { pts: Point[]; curved: boolean } {
  const A = amplitude;
  switch (pattern) {
    case "wave": {
      const p = periods(length, 5 * A);
      const pts: Point[] = [[0, 0]];
      for (let k = 0; k < 2 * p; k++) pts.push([((k + 0.5) / (2 * p)) * length, k % 2 === 0 ? A : -A]);
      pts.push([length, 0]);
      return { pts, curved: true };
    }
    case "organic": {
      const p = periods(length, 6 * A);
      const dense = shape("organic", length, A);
      // every fourth point of a period (dense has 18 per period)
      const step = Math.max(1, Math.round(18 / 4));
      const pts = dense.filter((_, i) => i % step === 0);
      if (pts[pts.length - 1] !== dense[dense.length - 1]) pts.push(dense[dense.length - 1]);
      return { pts: p > 0 ? pts : dense, curved: true };
    }
    case "curl":
    case "loops": {
      const p = periods(length, (pattern === "curl" ? 3.2 : 4.5) * A);
      const a = length / (2 * Math.PI * p);
      const b = pattern === "curl" ? Math.max(a * 1.8, 0.9 * A) : Math.max(a * 2.6, 1.8 * A);
      return {
        pts: sample(p * 8, (t) => {
          const theta = 2 * Math.PI * p * t;
          return [a * theta - b * Math.sin(theta), b * (Math.cos(theta) - 1)];
        }),
        curved: true,
      };
    }
    case "mixed": {
      const p = periods(length, 3.5 * A);
      const w = length / p;
      const pts: Point[] = [[0, 0]];
      for (let k = 0; k < p; k++) {
        if (k % 2 === 0) {
          // tooth: points close to the tip keep it nearly sharp in the curve
          pts.push([(k + 0.44) * w, -0.88 * A], [(k + 0.5) * w, -A], [(k + 0.56) * w, -0.88 * A], [(k + 1) * w, 0]);
        } else {
          pts.push([(k + 0.25) * w, 0.7 * A], [(k + 0.5) * w, A], [(k + 0.75) * w, 0.7 * A], [(k + 1) * w, 0]);
        }
      }
      return { pts, curved: true };
    }
    case "lightning": {
      // without points that lie on a straight piece of the line
      const dense = shape("lightning", length, A);
      const pts = dense.filter((pt, i) => i === 0 || i === dense.length - 1 || pt[1] !== 0 || dense[i - 1][1] !== 0 || dense[i + 1][1] !== 0);
      return { pts, curved: false };
    }
    default:
      return { pts: shape(pattern, length, A), curved: false };
  }
}

/** drawn as a curve through the anchor points (lines and arrows) */
export function isCurved(pattern: LinePattern): boolean {
  return pattern === "wave" || pattern === "organic" || pattern === "curl" || pattern === "loops" || pattern === "mixed";
}

/** short signature of the points of an element (to notice changes) */
export function pointsSignature(points: readonly Point[]): string {
  return points.map((p) => `${Math.round(p[0])},${Math.round(p[1])}`).join(" ");
}

/** points this browser has computed for a pattern (so they do not count as moved by hand) */
const generated = new Map<string, string>();

/** Points of the line with the pattern (relative to the element), and its size. */
export function patternPoints(base: readonly Point[], pattern: LinePattern, strokeWidth: number, freehand = false): Point[] {
  if (pattern === "straight" || base.length < 2) return base.map((p) => [p[0], p[1]] as Point);
  const course = new Course(base);
  if (course.length < 1) return base.map((p) => [p[0], p[1]] as Point);
  // freehand strokes are drawn about three times as wide as lines: a larger pattern
  const amplitude = 6 + 1.5 * (strokeWidth || 2) * (freehand ? 3 : 1);
  const form = freehand ? shape(pattern, course.length, amplitude) : anchors(pattern, course.length, amplitude).pts;
  const pts = form.map(([s, n]) => course.at(s, n));
  // exactly the original ends (arrows stay attached)
  pts[0] = [base[0][0], base[0][1]];
  pts[pts.length - 1] = [base[base.length - 1][0], base[base.length - 1][1]];
  return pts;
}

/**
 * Points every few units along the pattern: a freehand stroke is drawn
 * smoothly through its points, so corners (zigzag, saw tooth) need points
 * close to them to stay sharp.
 */
function densify(points: readonly Point[], step = 3): Point[] {
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/**
 * Changes for an element (line, arrow or freehand stroke) to get the pattern:
 * points, size, course kept in customData. With "straight" the original
 * course comes back (freehand: also its pressures).
 */
export function patternChanges(el: El, pattern: LinePattern, base: readonly Point[] = basePoints(el)): Record<string, unknown> {
  const freehand = el.type === "freedraw";
  const shaped = patternPoints(base, pattern, el.strokeWidth, freehand);
  const points = freehand && pattern !== "straight" ? densify(shaped) : shaped;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const customData: Record<string, unknown> = { ...(el.customData ?? {}) };
  delete customData.xudwPattern;
  delete customData.xudwBase;
  delete customData.xudwRoundness;
  delete customData.xudwPressures;
  delete customData.xudwEdited;
  generated.set(el.id, pointsSignature(points));
  const changes: Record<string, unknown> = {
    points,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
  if (freehand) {
    // the pressures belong to the original points: kept, and back with "straight"
    const kept = el.customData?.xudwPressures as { pressures: number[]; simulate: boolean } | undefined;
    const original = kept ?? { pressures: el.pressures ?? [], simulate: el.simulatePressure ?? true };
    if (pattern === "straight") {
      changes.pressures = original.pressures;
      changes.simulatePressure = original.simulate;
    } else {
      customData.xudwPattern = pattern;
      customData.xudwBase = base.map((p) => [p[0], p[1]]);
      customData.xudwPressures = original;
      // even pressure: simulated pressure would make the closely set pattern points thick
      changes.pressures = points.map(() => 0.5);
      changes.simulatePressure = false;
    }
    changes.lastCommittedPoint = points[points.length - 1];
  } else if (pattern === "straight") {
    if (el.customData?.xudwRoundness !== undefined) changes.roundness = el.customData.xudwRoundness;
  } else {
    customData.xudwPattern = pattern;
    customData.xudwBase = base.map((p) => [p[0], p[1]]);
    customData.xudwRoundness = el.customData?.xudwRoundness !== undefined ? el.customData.xudwRoundness : (el.roundness ?? null);
    // round patterns: a curve through the anchor points; the others with sharp corners
    changes.roundness = isCurved(pattern) ? { type: 2 } : null;
  }
  changes.customData = Object.keys(customData).length > 0 ? customData : undefined;
  return changes;
}

export function canHavePattern(el: El): boolean {
  return (el.type === "line" || el.type === "arrow" || el.type === "freedraw") && !el.elbowed && !el.isDeleted;
}

/** Gives the selected lines and arrows the pattern (one undoable step). */
export function applyToSelection(api: ExcalidrawImperativeAPI, pattern: LinePattern): number {
  const selected = api.getAppState().selectedElementIds ?? {};
  let count = 0;
  const elements = api.getSceneElementsIncludingDeleted().map((e) => {
    const el = e as unknown as El;
    if (!selected[el.id] || !canHavePattern(el) || patternOf(el) === pattern) return e;
    count++;
    return newElementWith(e as never, patternChanges(el, pattern) as never);
  });
  if (count > 0) api.updateScene({ elements: elements as never, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
  return count;
}

/**
 * Watches the board:
 * - a line or arrow that has just been drawn gets the current pattern;
 * - points of a patterned line moved by hand (or added): kept from then on
 *   (customData.xudwEdited), the pattern is not computed again;
 * - when Excalidraw moved the end of a patterned arrow attached to a shape
 *   (the shape was moved), the pattern is computed again along the new course.
 */
export function installLinePatterns(api: ExcalidrawImperativeAPI): () => void {
  let drawing: string | null = null;
  const seen = new Map<string, string>();
  return api.onChange((elements, appState) => {
    const current = appState.newElement ?? appState.multiElement;
    if (current && (current.type === "line" || current.type === "arrow")) {
      drawing = current.id;
      return;
    }
    // not while something is being dragged or edited
    if (appState.selectedElementsAreBeingDragged || appState.editingLinearElement) {
      return;
    }
    const fixes = new Map<string, Record<string, unknown>>();
    if (drawing !== null) {
      const finished = drawing;
      drawing = null;
      const pattern = currentLinePattern();
      const el = elements.find((e) => e.id === finished) as El | undefined;
      if (pattern !== "straight" && el && canHavePattern(el) && patternOf(el) === "straight") {
        fixes.set(el.id, patternChanges(el, pattern, el.points as Point[]));
      }
    }
    for (const e of elements) {
      const el = e as El;
      if (el.isDeleted || el.type === "freedraw" || patternOf(el) === "straight" || fixes.has(el.id)) continue;
      const pts = el.points as Point[];
      const signature = pointsSignature(pts);
      const known = seen.get(el.id);
      seen.set(el.id, signature);
      if (known === undefined || known === signature || generated.get(el.id) === signature) continue;
      if (el.customData?.xudwEdited) continue;
      if (appState.selectedElementIds[el.id]) {
        // the points were changed by hand: keep them
        fixes.set(el.id, { customData: { ...(el.customData ?? {}), xudwEdited: true } });
        continue;
      }
      if (!el.startBinding && !el.endBinding) continue;
      // ends moved by Excalidraw: course with the new ends, pattern again
      const base = basePoints(el).map((p) => [p[0], p[1]] as Point);
      const expected = patternPoints(base, patternOf(el), el.strokeWidth);
      const first = expected[0];
      const last = expected[expected.length - 1];
      const movedStart = Math.hypot(pts[0][0] - first[0], pts[0][1] - first[1]) > 0.5;
      const movedEnd = Math.hypot(pts[pts.length - 1][0] - last[0], pts[pts.length - 1][1] - last[1]) > 0.5;
      if (!movedStart && !movedEnd) continue;
      base[0] = [pts[0][0], pts[0][1]];
      base[base.length - 1] = [pts[pts.length - 1][0], pts[pts.length - 1][1]];
      fixes.set(el.id, patternChanges(el, patternOf(el), base));
    }
    if (fixes.size === 0) return;
    window.setTimeout(() => {
      api.updateScene({
        elements: api.getSceneElementsIncludingDeleted().map((e) => (fixes.has(e.id) ? newElementWith(e as never, fixes.get(e.id) as never) : e)) as never,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }, 0);
  });
}

/**
 * Adds an anchor point to a line or arrow at a point of the board (right
 * click "Ankerpunkt hinzufügen"): on the nearest piece of the line.
 */
export function addAnchor(api: ExcalidrawImperativeAPI, id: string, sceneX: number, sceneY: number): boolean {
  const el = api.getSceneElements().find((e) => e.id === id) as El | undefined;
  if (!el || (el.type !== "line" && el.type !== "arrow") || el.elbowed) return false;
  const pts = el.points as Point[];
  const p: Point = [sceneX - el.x, sceneY - el.y];
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    const d = Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  const points = [...pts.slice(0, best + 1), p, ...pts.slice(best + 1)];
  const xs = points.map((q) => q[0]);
  const ys = points.map((q) => q[1]);
  const changes: Record<string, unknown> = {
    points,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
  if (patternOf(el) !== "straight") changes.customData = { ...(el.customData ?? {}), xudwEdited: true };
  api.updateScene({
    elements: api.getSceneElementsIncludingDeleted().map((e) => (e.id === id ? newElementWith(e as never, changes as never) : e)) as never,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return true;
}
