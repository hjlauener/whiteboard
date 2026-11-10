/**
 * Executes Udon Whiteboard Script commands on the Excalidraw board.
 *
 * All commands of a script run on a working copy of the scene. Only when all
 * of them succeeded is the scene updated – as ONE step, so that the whole
 * script can be undone at once. If one command fails, nothing is changed and
 * the problems are returned with their line numbers.
 *
 * Every changed element gets a new version (newElementWith), so the change is
 * synchronised to the others like a change made by hand.
 */
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  FONT_FAMILY,
  newElementWith,
  restoreElements,
  ROUNDNESS,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { canHavePattern, isLinePattern, patternChanges, patternOf } from "../linePatterns.ts";
import type { Command, Problem } from "../../../sdk/js/src/language.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type El = Record<string, any> & {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  version: number;
  isDeleted: boolean;
  groupIds: readonly string[];
};

export interface ExecuteResult {
  /** number of commands executed (0 if there were problems) */
  done: number;
  problems: Problem[];
}

class CommandError extends Error {}

const SERIF = ((FONT_FAMILY as Record<string, number>)["Source Serif"] ?? FONT_FAMILY.Nunito) as number;
const FONTS: Record<string, number> = { serif: SERIF, sans: FONT_FAMILY.Nunito, hand: FONT_FAMILY.Excalifont, code: FONT_FAMILY["Comic Shanns"] };
const SIZES: Record<string, number> = { S: 16, M: 20, L: 28, XL: 36, XXL: 48 };
/** line widths as in the board: 2 / 4 / 6 (see boardDefaults() in vite.config.ts) */
const WIDTHS: Record<string, number> = { thin: 2, bold: 4, extra: 6 };
const NOTE_FILL = "#ffec99";
/** space between a shape and its text (Excalidraw's BOUND_TEXT_PADDING) */
const BOUND_TEXT_PADDING = 5;
const GAP_DEFAULT = 60;
const ARROW_GAP = 6;

/** Excalidraw's key for undo/redo (Cmd on Mac, Ctrl elsewhere). */
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);

export function executeCommands(api: ExcalidrawImperativeAPI, commands: readonly Command[], lines: readonly number[]): ExecuteResult {
  let state = new BoardState(api);
  let done = 0;
  for (let i = 0; i < commands.length; i++) {
    const c = commands[i];
    if (c.cmd === "undo" || c.cmd === "redo") {
      // the changes so far become one step, then Excalidraw undoes/redoes
      state.apply();
      pressUndo(c.cmd === "redo");
      state = new BoardState(api);
      done++;
      continue;
    }
    try {
      state.run(c);
      done++;
    } catch (e) {
      const message = e instanceof CommandError ? e.message : `could not be carried out (${(e as Error).message}).`;
      return { done: 0, problems: [{ line: lines[i] ?? i + 1, message: `${c.cmd}: ${message}` }] };
    }
  }
  state.apply();
  return { done, problems: [] };
}

function pressUndo(redo: boolean): void {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: redo && !IS_MAC ? "y" : "z",
      code: redo && !IS_MAC ? "KeyY" : "KeyZ",
      metaKey: IS_MAC,
      ctrlKey: !IS_MAC,
      shiftKey: redo && IS_MAC,
      bubbles: true,
    }),
  );
}

/** Working copy of the scene. */
class BoardState {
  private readonly order: string[] = [];
  private readonly els = new Map<string, El>();
  private readonly changed = new Set<string>();
  private lastCreated: string | null = null;
  private selection: string[] | null = null;
  private viewTargets: string[] | null = null;
  private readonly moved = new Set<string>();

  constructor(private readonly api: ExcalidrawImperativeAPI) {
    for (const el of api.getSceneElementsIncludingDeleted() as unknown as El[]) {
      this.order.push(el.id);
      this.els.set(el.id, el);
    }
  }

  // --------------------------------------------------------------------
  // applying
  // --------------------------------------------------------------------

  apply(): void {
    this.rerouteArrows();
    if (this.changed.size > 0) {
      const elements = this.order.map((id) => this.els.get(id)!).filter(Boolean);
      this.api.updateScene({ elements: elements as never, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
    }
    if (this.selection !== null) {
      this.api.updateScene({
        appState: { selectedElementIds: Object.fromEntries(this.selection.map((id) => [id, true])) } as never,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
    if (this.viewTargets !== null) {
      const targets = this.viewTargets.map((id) => this.els.get(id)).filter((e): e is El => e !== undefined && !e.isDeleted);
      if (targets.length > 0) {
        this.api.scrollToContent(targets as never, { fitToContent: true, animate: true });
      }
    }
  }

  private get(id: string): El | undefined {
    const el = this.els.get(id);
    return el !== undefined && !el.isDeleted ? el : undefined;
  }

  private alive(): El[] {
    return this.order.map((id) => this.els.get(id)!).filter((e) => e !== undefined && !e.isDeleted);
  }

  /** Replaces an element with a changed copy (new version). */
  private update(el: El, changes: Record<string, unknown>): El {
    const next = newElementWith(el as never, changes as never) as unknown as El;
    this.els.set(el.id, next);
    this.changed.add(el.id);
    return next;
  }

  /** Adds new elements (from convertToExcalidrawElements / restoreElements). */
  private add(elements: El[]): void {
    for (const el of elements) {
      const previous = this.els.get(el.id);
      if (previous !== undefined) {
        // an id used before by a deleted element: the new one must have a higher version
        el.version = previous.version + 1;
        this.els.set(el.id, el);
      } else {
        this.order.push(el.id);
        this.els.set(el.id, el);
      }
      this.changed.add(el.id);
    }
  }

  /** Elements meant by an id: the element, or all elements of a group. */
  private resolve(id: string): El[] {
    const el = this.get(id);
    if (el !== undefined) return [el];
    const members = this.alive().filter((e) => e.groupIds.includes(id) && !e.containerId);
    if (members.length > 0) return members;
    throw new CommandError(`unknown id "${id}". Use the id of an element or group on the board.`);
  }

  private resolveAll(ids: readonly string[] | undefined): El[] {
    const out = new Map<string, El>();
    for (const id of ids ?? []) {
      for (const el of this.resolve(id)) out.set(el.id, el);
    }
    return [...out.values()];
  }

  private boundText(el: El): El | undefined {
    const ref = (el.boundElements ?? []).find((b: { type: string }) => b.type === "text");
    return ref ? this.get(ref.id) : undefined;
  }

  // --------------------------------------------------------------------
  // commands
  // --------------------------------------------------------------------

  run(c: Command): void {
    switch (c.cmd) {
      case "rect":
      case "ellipse":
      case "diamond":
      case "note":
        return this.createShape(c);
      case "text":
        return this.createText(c);
      case "arrow":
      case "line":
        return this.createLinear(c);
      case "draw":
        return this.createDraw(c);
      case "frame":
        return this.createFrame(c);
      case "move":
        return this.move(c);
      case "resize":
        return this.resize(c);
      case "rotate":
        return this.rotate(c);
      case "style":
        return this.style(c);
      case "settext":
        return this.setText(c);
      case "font":
        return this.font(c);
      case "convert":
        return this.convert(c);
      case "delete":
        return this.remove(c);
      case "link":
        return this.forEach(c, (el) => this.update(el, { link: String(c.url) === "" ? null : String(c.url) }));
      case "lock":
        return this.forEach(c, (el) => this.update(el, { locked: true }));
      case "unlock":
        return this.forEach(c, (el) => this.update(el, { locked: false }));
      case "group":
        return this.group(c);
      case "ungroup":
        return this.ungroup(c);
      case "front":
      case "back":
        return this.reorder(c, c.cmd === "front");
      case "align":
        return this.align(c);
      case "distribute":
        return this.distribute(c);
      case "select":
        this.selection = this.resolveAll(c.targets).map((e) => e.id);
        return;
      case "view":
        this.viewTargets = c.targets?.length === 1 && c.targets[0] === "all" ? this.alive().map((e) => e.id) : this.resolveAll(c.targets).map((e) => e.id);
        return;
    }
    throw new CommandError("not supported.");
  }

  private forEach(c: Command, fn: (el: El) => void): void {
    for (const el of this.resolveAll(c.targets)) fn(el);
  }

  private checkNewId(id: unknown): string | undefined {
    if (id === undefined) return undefined;
    const s = String(id);
    if (this.get(s) !== undefined || this.alive().some((e) => e.groupIds.includes(s))) {
      throw new CommandError(`id "${s}" is already used on the board. Choose another id or change the existing element.`);
    }
    return s;
  }

  /** x/y of a new element of the given size (x/y, right/left/below/above, or next to the last one). */
  private place(c: Command, w: number, h: number): { x: number; y: number } {
    const gap = typeof c.gap === "number" ? c.gap : GAP_DEFAULT;
    for (const dir of ["right", "left", "below", "above"] as const) {
      if (c[dir] === undefined) continue;
      const ref = this.bounds(this.resolve(String(c[dir])));
      switch (dir) {
        case "right":
          return { x: ref.x2 + gap, y: ref.y1 };
        case "left":
          return { x: ref.x1 - gap - w, y: ref.y1 };
        case "below":
          return { x: ref.x1, y: ref.y2 + gap };
        case "above":
          return { x: ref.x1, y: ref.y1 - gap - h };
      }
    }
    if (c.x !== undefined || c.y !== undefined) {
      return { x: Number(c.x ?? 0), y: Number(c.y ?? 0) };
    }
    const last = this.lastCreated ? this.get(this.lastCreated) : undefined;
    if (last !== undefined) {
      const b = this.bounds([last]);
      return { x: b.x2 + GAP_DEFAULT, y: b.y1 };
    }
    // middle of the visible area
    const app = this.api.getAppState();
    const zoom = app.zoom.value;
    return { x: -app.scrollX + app.width / 2 / zoom - w / 2, y: -app.scrollY + app.height / 2 / zoom - h / 2 };
  }

  private styleProps(c: Command, type: string): Record<string, unknown> {
    const p: Record<string, unknown> = {};
    if (c.stroke !== undefined) p.strokeColor = c.stroke;
    if (c.fill !== undefined) {
      p.backgroundColor = c.fill;
      if (c.fillstyle === undefined) p.fillStyle = "solid";
    }
    if (c.fillstyle !== undefined) p.fillStyle = c.fillstyle;
    if (c.width !== undefined) p.strokeWidth = WIDTHS[String(c.width)];
    if (c.linestyle !== undefined) p.strokeStyle = c.linestyle;
    if (c.rough !== undefined) p.roughness = Number(c.rough);
    if (c.opacity !== undefined) p.opacity = Number(c.opacity);
    if (c.round !== undefined) {
      p.roundness = c.round ? { type: type === "rectangle" ? ROUNDNESS.ADAPTIVE_RADIUS : ROUNDNESS.PROPORTIONAL_RADIUS } : null;
    }
    return p;
  }

  private fontProps(c: Command, current?: El): { fontFamily: number; fontSize: number; textAlign: string } {
    return {
      fontFamily: c.font !== undefined ? FONTS[String(c.font)] : current?.fontFamily ?? SERIF,
      fontSize: c.size !== undefined ? SIZES[String(c.size)] : current?.fontSize ?? SIZES.M,
      textAlign: c.align !== undefined ? String(c.align) : current?.textAlign ?? "center",
    };
  }

  private createShape(c: Command): void {
    const id = this.checkNewId(c.id);
    const note = c.cmd === "note";
    const type = note ? "rectangle" : c.cmd === "rect" ? "rectangle" : c.cmd;
    const w = Number(c.w ?? (note ? 180 : 160));
    const h = Number(c.h ?? (note ? 180 : 80));
    const { x, y } = this.place(c, w, h);
    const style = this.styleProps(c, type);
    const skeleton: Record<string, unknown> = {
      type,
      id,
      x,
      y,
      width: w,
      height: h,
      roughness: 0,
      strokeWidth: WIDTHS.thin,
      roundness: type === "rectangle" ? { type: ROUNDNESS.ADAPTIVE_RADIUS } : type === "diamond" ? { type: ROUNDNESS.PROPORTIONAL_RADIUS } : null,
      ...(note ? { backgroundColor: NOTE_FILL, fillStyle: "solid", strokeColor: "#f08c00", strokeWidth: 1 } : {}),
      ...style,
    };
    if (c.text !== undefined && c.text !== "") {
      skeleton.label = { text: String(c.text), ...this.fontProps(c), strokeColor: (style.strokeColor as string | undefined) ?? (note ? "#1e1e1e" : undefined) };
    }
    const created = convertToExcalidrawElements([skeleton as never], { regenerateIds: false }) as unknown as El[];
    this.add(created);
    this.lastCreated = created[0].id;
  }

  private createText(c: Command): void {
    const id = this.checkNewId(c.id);
    const font = this.fontProps(c);
    const probe = this.layoutFreeText(String(c.text), font.fontFamily, font.fontSize, c.align === undefined ? "left" : String(c.align));
    const { x, y } = this.place(c, probe.width, probe.height);
    const created = convertToExcalidrawElements(
      [{ type: "text", id, x, y, text: String(c.text), fontFamily: font.fontFamily, fontSize: font.fontSize, textAlign: c.align ?? "left", ...this.styleProps(c, "text") } as never],
      { regenerateIds: false },
    ) as unknown as El[];
    this.add(created);
    this.lastCreated = created[0].id;
  }

  private layoutFreeText(text: string, fontFamily: number, fontSize: number, textAlign: string): El {
    return (convertToExcalidrawElements([{ type: "text", x: 0, y: 0, text, fontFamily, fontSize, textAlign } as never]) as unknown as El[])[0];
  }

  /** Arrow or line; with from/to attached (arrow) or placed between the elements (line). */
  private createLinear(c: Command): void {
    const id = this.checkNewId(c.id);
    const from = c.from !== undefined ? this.single(String(c.from)) : undefined;
    const to = c.to !== undefined ? this.single(String(c.to)) : undefined;
    let points: [number, number][];
    if (Array.isArray(c.points)) {
      points = c.points as [number, number][];
    } else {
      const a: [number, number] = from ? center(from) : [Number(c.x1), Number(c.y1)];
      const b: [number, number] = to ? center(to) : [Number(c.x2), Number(c.y2)];
      const start = from ? clip(from, a, b, ARROW_GAP) : a;
      const end = to ? clip(to, b, a, ARROW_GAP) : b;
      points = [start, end];
    }
    const [x0, y0] = points[0];
    const rel = points.map(([px, py]) => [px - x0, py - y0] as [number, number]);
    const isArrow = c.cmd === "arrow";
    const skeleton: Record<string, unknown> = {
      type: isArrow ? "arrow" : "line",
      id,
      x: x0,
      y: y0,
      points: rel,
      width: Math.max(...rel.map((p) => p[0])) - Math.min(...rel.map((p) => p[0])),
      height: Math.max(...rel.map((p) => p[1])) - Math.min(...rel.map((p) => p[1])),
      roughness: 0,
      strokeWidth: 2,
      ...this.styleProps(c, "arrow"),
    };
    if (isArrow) {
      skeleton.endArrowhead = c.head === undefined ? "arrow" : c.head === "none" ? null : c.head;
      skeleton.startArrowhead = c.tail === undefined || c.tail === "none" ? null : c.tail;
      if (c.text !== undefined && c.text !== "") {
        skeleton.label = { text: String(c.text), fontFamily: SERIF, fontSize: SIZES.M };
      }
    }
    const created = convertToExcalidrawElements([skeleton as never], { regenerateIds: false }) as unknown as El[];
    this.add(created);
    let arrow = this.els.get(created[0].id)!;
    if (isArrow && (from || to)) {
      arrow = this.update(arrow, {
        startBinding: from ? { elementId: from.id, focus: 0, gap: ARROW_GAP } : null,
        endBinding: to ? { elementId: to.id, focus: 0, gap: ARROW_GAP } : null,
      });
      for (const target of [from, to]) {
        if (target === undefined) continue;
        const current = this.els.get(target.id)!;
        const bound = [...(current.boundElements ?? [])].filter((b: { id: string }) => b.id !== arrow.id);
        this.update(current, { boundElements: [...bound, { id: arrow.id, type: "arrow" }] });
      }
    }
    if (isLinePattern(c.pattern) && c.pattern !== "straight") {
      this.update(arrow, patternChanges(arrow, c.pattern, arrow.points));
    }
  }

  private single(id: string): El {
    const els = this.resolve(id);
    if (els.length !== 1) throw new CommandError(`"${id}" is a group; arrows connect single elements.`);
    return els[0];
  }

  private createDraw(c: Command): void {
    const id = this.checkNewId(c.id);
    const pts = c.points as [number, number][];
    const [x0, y0] = pts[0];
    const rel = pts.map(([px, py]) => [px - x0, py - y0]);
    const xs = rel.map((p) => p[0]);
    const ys = rel.map((p) => p[1]);
    const raw = {
      type: "freedraw",
      id: id ?? `draw-${Math.random().toString(36).slice(2, 12)}`,
      x: x0,
      y: y0,
      points: rel,
      pressures: [],
      simulatePressure: true,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      strokeColor: c.stroke ?? "#1e1e1e",
      strokeWidth: c.width !== undefined ? WIDTHS[String(c.width)] : 2,
      opacity: c.opacity ?? 100,
      roughness: 0,
    };
    const created = restoreElements([raw as never], null) as unknown as El[];
    this.add(created);
    this.lastCreated = created[0].id;
  }

  private createFrame(c: Command): void {
    const id = this.checkNewId(c.id);
    const children = c.contains !== undefined ? this.resolveAll(String(c.contains).trim().split(/\s+/).filter(Boolean)) : [];
    let w = Number(c.w ?? 400);
    let h = Number(c.h ?? 300);
    let pos: { x: number; y: number };
    if (children.length > 0 && c.x === undefined && c.w === undefined) {
      const b = this.bounds(children);
      pos = { x: b.x1 - 40, y: b.y1 - 40 };
      w = b.x2 - b.x1 + 80;
      h = b.y2 - b.y1 + 80;
    } else {
      pos = this.place(c, w, h);
    }
    const created = convertToExcalidrawElements(
      [{ type: "frame", id, x: pos.x, y: pos.y, width: w, height: h, name: c.title !== undefined ? String(c.title) : null, children: [] } as never],
      { regenerateIds: false },
    ) as unknown as El[];
    this.add(created);
    const frame = created[0];
    for (const child of children) {
      this.update(this.els.get(child.id)!, { frameId: frame.id });
      const text = this.boundText(child);
      if (text) this.update(text, { frameId: frame.id });
    }
    // a frame is drawn behind its contents
    this.order.splice(this.order.indexOf(frame.id), 1);
    const first = Math.min(...children.map((ch) => this.order.indexOf(ch.id)).filter((i) => i >= 0), this.order.length);
    this.order.splice(first, 0, frame.id);
    this.lastCreated = frame.id;
  }

  /** Moves elements (with their texts, frame contents) by dx/dy. */
  private shift(els: El[], dx: number, dy: number): void {
    const all = new Map<string, El>();
    for (const el of els) {
      all.set(el.id, el);
      const text = this.boundText(el);
      if (text) all.set(text.id, text);
      if (el.type === "frame") {
        for (const child of this.alive().filter((e) => e.frameId === el.id)) all.set(child.id, child);
      }
    }
    for (const el of all.values()) {
      const current = this.els.get(el.id)!;
      this.update(current, { x: current.x + dx, y: current.y + dy });
      this.moved.add(el.id);
    }
  }

  private move(c: Command): void {
    const els = this.resolveAll(c.targets);
    const b = this.bounds(els);
    let dx = Number(c.dx ?? 0);
    let dy = Number(c.dy ?? 0);
    if (c.x !== undefined || c.y !== undefined || ["right", "left", "below", "above"].some((k) => c[k] !== undefined)) {
      const target = this.place({ ...c, x: c.x ?? (c.y !== undefined ? b.x1 : undefined), y: c.y ?? (c.x !== undefined ? b.y1 : undefined) } as Command, b.x2 - b.x1, b.y2 - b.y1);
      dx = target.x - b.x1;
      dy = target.y - b.y1;
    }
    this.shift(els, dx, dy);
  }

  private resize(c: Command): void {
    for (const el of this.resolveAll(c.targets)) {
      if (el.type === "text") throw new CommandError(`"${el.id}" is a text; change its size with font size=…`);
      const w = Number(c.w ?? el.width);
      const h = Number(c.h ?? el.height);
      const changes: Record<string, unknown> = { width: w, height: h };
      if (Array.isArray(el.points)) {
        const sx = el.width > 0 ? w / el.width : 1;
        const sy = el.height > 0 ? h / el.height : 1;
        changes.points = el.points.map(([px, py]: number[]) => [px * sx, py * sy]);
      }
      const next = this.update(el, changes);
      this.moved.add(el.id);
      const text = this.boundText(next);
      if (text) this.relayoutLabel(next, text.originalText ?? text.text, text);
    }
  }

  private rotate(c: Command): void {
    const angle = ((Number(c.angle) % 360) * Math.PI) / 180;
    for (const el of this.resolveAll(c.targets)) {
      this.update(el, { angle });
      const text = this.boundText(el);
      if (text && el.type !== "arrow") this.update(text, { angle });
    }
  }

  private style(c: Command): void {
    for (const el of this.resolveAll(c.targets)) {
      const props = this.styleProps(c, el.type);
      if (el.type === "text") {
        const allowed: Record<string, unknown> = {};
        if (props.strokeColor !== undefined) allowed.strokeColor = props.strokeColor;
        if (props.opacity !== undefined) allowed.opacity = props.opacity;
        this.update(el, allowed);
        continue;
      }
      if (el.type === "arrow" || el.type === "line") delete props.roundness;
      let next = this.update(el, props);
      if (isLinePattern(c.pattern) && canHavePattern(next)) {
        // with a new line width the pattern is computed again (its size depends on it)
        next = this.update(next, patternChanges(next, c.pattern));
      } else if (props.strokeWidth !== undefined && patternOf(next) !== "straight") {
        next = this.update(next, patternChanges(next, patternOf(next)));
      }
      const text = this.boundText(el);
      if (text && props.strokeColor !== undefined) this.update(text, { strokeColor: props.strokeColor });
    }
  }

  /** convert: another kind of shape (rect/ellipse/diamond/note) or linear element (arrow/line). */
  private convert(c: Command): void {
    const to = String(c.to);
    const SHAPES = ["rectangle", "ellipse", "diamond"];
    for (const el of this.resolveAll(c.targets)) {
      if (to === "arrow" || to === "line") {
        if (el.type !== "arrow" && el.type !== "line") {
          throw new CommandError(`"${el.id}" is a ${el.type}; only arrows and lines can become an ${to}.`);
        }
        if (to === "arrow") {
          this.update(el, { type: "arrow", endArrowhead: "arrow", startArrowhead: null });
        } else {
          // lines are not attached to shapes: detach both ends
          for (const binding of [el.startBinding, el.endBinding]) {
            const target = binding ? this.get(binding.elementId) : undefined;
            if (target) {
              this.update(target, { boundElements: (target.boundElements ?? []).filter((b: { id: string }) => b.id !== el.id) });
            }
          }
          this.update(el, { type: "line", endArrowhead: null, startArrowhead: null, startBinding: null, endBinding: null });
        }
        continue;
      }
      if (!SHAPES.includes(el.type)) {
        throw new CommandError(`"${el.id}" is a ${el.type}; only rectangles, ellipses and diamonds can become a ${to}.`);
      }
      const type = to === "rect" || to === "note" ? "rectangle" : to;
      const changes: Record<string, unknown> = {
        type,
        roundness: type === "rectangle" ? { type: ROUNDNESS.ADAPTIVE_RADIUS } : type === "diamond" ? { type: ROUNDNESS.PROPORTIONAL_RADIUS } : null,
      };
      if (to === "note") {
        Object.assign(changes, { backgroundColor: NOTE_FILL, fillStyle: "solid", strokeColor: "#f08c00", strokeWidth: 1 });
      }
      // the longest word of the text must fit into the new shape (ellipses and
      // diamonds have less room than rectangles): widen it around its centre
      const label = this.boundText(el);
      if (label) {
        const words = String(label.originalText ?? label.text).split(/\s+/).filter(Boolean);
        const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");
        if (longest !== "") {
          const w = this.layoutFreeText(longest, label.fontFamily, label.fontSize, "left").width + 2 * BOUND_TEXT_PADDING;
          const needed = Math.ceil(type === "ellipse" ? w * Math.SQRT2 : type === "diamond" ? w * 2 : w) + 4;
          if (needed > el.width) {
            Object.assign(changes, { width: needed, x: el.x - (needed - el.width) / 2 });
          }
        }
      }
      const next = this.update(el, changes);
      this.moved.add(el.id); // attached arrows are led to the new outline
      const text = this.boundText(next);
      if (text) this.relayoutLabel(next, text.originalText ?? text.text, text);
    }
  }

  private setText(c: Command): void {
    const el = this.single(String(c.targets?.[0]));
    const text = String(c.text);
    if (el.type === "text") {
      if (el.containerId) {
        const container = this.get(el.containerId);
        if (container) return this.relayoutLabel(container, text, el);
      }
      const probe = this.layoutFreeText(text, el.fontFamily, el.fontSize, el.textAlign);
      this.update(el, { text: probe.text, originalText: text, width: probe.width, height: probe.height });
      return;
    }
    if (!["rectangle", "ellipse", "diamond", "arrow"].includes(el.type)) {
      throw new CommandError(`"${el.id}" (${el.type}) cannot hold text.`);
    }
    this.relayoutLabel(el, text, this.boundText(el));
  }

  private font(c: Command): void {
    for (const el of this.resolveAll(c.targets)) {
      const text = el.type === "text" ? el : this.boundText(el);
      if (!text) throw new CommandError(`"${el.id}" has no text.`);
      const f = this.fontProps(c, text);
      if (text.containerId) {
        const container = this.get(text.containerId);
        if (container) {
          this.relayoutLabel(container, text.originalText ?? text.text, text, f);
          continue;
        }
      }
      const probe = this.layoutFreeText(text.originalText ?? text.text, f.fontFamily, f.fontSize, f.textAlign);
      this.update(text, { ...f, text: probe.text, width: probe.width, height: probe.height, lineHeight: probe.lineHeight });
    }
  }

  /**
   * (Re)writes the text inside a shape or on an arrow. The layout (wrapping,
   * size, position) is done by Excalidraw itself: a copy of the container
   * with the label is converted, and its text replaces the old one.
   */
  private relayoutLabel(container: El, text: string, old?: El, font?: { fontFamily: number; fontSize: number; textAlign: string }): void {
    const f = font ?? {
      fontFamily: old?.fontFamily ?? SERIF,
      fontSize: old?.fontSize ?? SIZES.M,
      textAlign: old?.textAlign ?? "center",
    };
    const probeId = `xudwtmp${Math.random().toString(36).slice(2, 10)}`;
    const skeleton: Record<string, unknown> =
      container.type === "arrow"
        ? { type: "arrow", id: probeId, x: container.x, y: container.y, points: container.points, label: { text, ...f } }
        : { type: container.type, id: probeId, x: container.x, y: container.y, width: container.width, height: container.height, label: { text, ...f } };
    const probe = convertToExcalidrawElements([skeleton as never], { regenerateIds: false }) as unknown as El[];
    const probeContainer = probe.find((e) => e.id === probeId)!;
    const probeText = probe.find((e) => e.type === "text");
    if (!probeText) return;
    const fields = {
      text: probeText.text,
      originalText: text,
      x: probeText.x,
      y: probeText.y,
      width: probeText.width,
      height: probeText.height,
      fontFamily: probeText.fontFamily,
      fontSize: probeText.fontSize,
      textAlign: probeText.textAlign,
      verticalAlign: probeText.verticalAlign,
      lineHeight: probeText.lineHeight,
      angle: container.type === "arrow" ? 0 : container.angle,
    };
    if (old !== undefined) {
      this.update(old, fields);
    } else {
      const created = { ...probeText, ...fields, containerId: container.id, groupIds: container.groupIds, frameId: container.frameId ?? null, strokeColor: container.type === "arrow" ? "#1e1e1e" : container.strokeColor } as El;
      this.add([created]);
      const current = this.els.get(container.id)!;
      this.update(current, { boundElements: [...(current.boundElements ?? []), { id: created.id, type: "text" }] });
    }
    if (container.type !== "arrow" && probeContainer.height > container.height) {
      this.update(this.els.get(container.id)!, { height: probeContainer.height });
    }
  }

  private remove(c: Command): void {
    const targets = this.resolveAll(c.targets);
    const ids = new Set(targets.map((e) => e.id));
    for (const el of targets) {
      this.update(this.els.get(el.id)!, { isDeleted: true });
      const text = this.boundText(el);
      if (text) this.update(text, { isDeleted: true });
    }
    for (const el of this.alive()) {
      const changes: Record<string, unknown> = {};
      if (el.startBinding && ids.has(el.startBinding.elementId)) changes.startBinding = null;
      if (el.endBinding && ids.has(el.endBinding.elementId)) changes.endBinding = null;
      if (el.frameId && ids.has(el.frameId)) changes.frameId = null;
      if (el.boundElements && el.boundElements.some((b: { id: string }) => ids.has(b.id))) {
        changes.boundElements = el.boundElements.filter((b: { id: string }) => !ids.has(b.id));
      }
      if (Object.keys(changes).length > 0) this.update(el, changes);
    }
  }

  private group(c: Command): void {
    const gid = this.checkNewId(c.id) ?? `g${Math.random().toString(36).slice(2, 12)}`;
    for (const el of this.resolveAll(c.targets)) {
      for (const e of [el, this.boundText(el)]) {
        if (e) this.update(this.els.get(e.id)!, { groupIds: [...e.groupIds, gid] });
      }
    }
  }

  private ungroup(c: Command): void {
    for (const id of c.targets ?? []) {
      const isGroup = this.get(id) === undefined;
      for (const el of this.resolve(id)) {
        for (const e of [el, this.boundText(el)]) {
          if (!e || e.groupIds.length === 0) continue;
          const groupIds = isGroup ? e.groupIds.filter((g) => g !== id) : e.groupIds.slice(0, -1);
          this.update(this.els.get(e.id)!, { groupIds });
        }
      }
    }
  }

  private reorder(c: Command, toFront: boolean): void {
    const ids: string[] = [];
    for (const el of this.resolveAll(c.targets)) {
      ids.push(el.id);
      const text = this.boundText(el);
      if (text) ids.push(text.id);
    }
    const rest = this.order.filter((id) => !ids.includes(id));
    this.order.length = 0;
    this.order.push(...(toFront ? [...rest, ...ids] : [...ids, ...rest]));
    for (const id of ids) this.update(this.els.get(id)!, {});
  }

  /** Units for align/distribute: an element, or all members of a group id. */
  private units(c: Command): El[][] {
    return (c.targets ?? []).map((id) => this.resolve(id));
  }

  private align(c: Command): void {
    const units = this.units(c);
    const boxes = units.map((u) => this.bounds(u));
    const all = { x1: Math.min(...boxes.map((b) => b.x1)), y1: Math.min(...boxes.map((b) => b.y1)), x2: Math.max(...boxes.map((b) => b.x2)), y2: Math.max(...boxes.map((b) => b.y2)) };
    units.forEach((unit, i) => {
      const b = boxes[i];
      let dx = 0;
      let dy = 0;
      switch (c.edge) {
        case "left": dx = all.x1 - b.x1; break;
        case "right": dx = all.x2 - b.x2; break;
        case "center": dx = (all.x1 + all.x2) / 2 - (b.x1 + b.x2) / 2; break;
        case "top": dy = all.y1 - b.y1; break;
        case "bottom": dy = all.y2 - b.y2; break;
        case "middle": dy = (all.y1 + all.y2) / 2 - (b.y1 + b.y2) / 2; break;
      }
      if (dx !== 0 || dy !== 0) this.shift(unit.map((e) => this.els.get(e.id)!), dx, dy);
    });
  }

  private distribute(c: Command): void {
    const horizontal = c.axis === "x";
    const units = this.units(c).map((u) => ({ unit: u, box: this.bounds(u) }));
    units.sort((a, b) => (horizontal ? a.box.x1 - b.box.x1 : a.box.y1 - b.box.y1));
    const size = (b: Box) => (horizontal ? b.x2 - b.x1 : b.y2 - b.y1);
    const first = units[0].box;
    const last = units[units.length - 1].box;
    const span = horizontal ? last.x2 - first.x1 : last.y2 - first.y1;
    const gap = (span - units.reduce((s, u) => s + size(u.box), 0)) / (units.length - 1);
    let pos = horizontal ? first.x1 : first.y1;
    for (const { unit, box } of units) {
      const delta = pos - (horizontal ? box.x1 : box.y1);
      if (delta !== 0) this.shift(unit.map((e) => this.els.get(e.id)!), horizontal ? delta : 0, horizontal ? 0 : delta);
      pos += size(box) + gap;
    }
  }

  // --------------------------------------------------------------------
  // geometry
  // --------------------------------------------------------------------

  private bounds(els: El[]): Box {
    const boxes = els.map((e) => this.els.get(e.id) ?? e).map(box);
    return { x1: Math.min(...boxes.map((b) => b.x1)), y1: Math.min(...boxes.map((b) => b.y1)), x2: Math.max(...boxes.map((b) => b.x2)), y2: Math.max(...boxes.map((b) => b.y2)) };
  }

  /** Arrows attached to moved or resized elements follow them. */
  private rerouteArrows(): void {
    if (this.moved.size === 0) return;
    for (const arrow of this.alive().filter((e) => e.type === "arrow")) {
      const s = arrow.startBinding?.elementId as string | undefined;
      const e = arrow.endBinding?.elementId as string | undefined;
      if (!(s && this.moved.has(s)) && !(e && this.moved.has(e))) continue;
      if (this.moved.has(arrow.id)) continue;
      const pts = arrow.points as [number, number][];
      const absStart: [number, number] = [arrow.x + pts[0][0], arrow.y + pts[0][1]];
      const absEnd: [number, number] = [arrow.x + pts[pts.length - 1][0], arrow.y + pts[pts.length - 1][1]];
      const from = s ? this.get(s) : undefined;
      const to = e ? this.get(e) : undefined;
      const a: [number, number] = from ? center(from) : absStart;
      const b: [number, number] = to ? center(to) : absEnd;
      const start = from ? clip(from, a, b, ARROW_GAP) : absStart;
      const end = to ? clip(to, b, a, ARROW_GAP) : absEnd;
      const rel: [number, number][] = [[0, 0], [end[0] - start[0], end[1] - start[1]]];
      let next = this.update(arrow, { x: start[0], y: start[1], points: rel, width: Math.abs(rel[1][0]), height: Math.abs(rel[1][1]) });
      if (patternOf(next) !== "straight") next = this.update(next, patternChanges(next, patternOf(next), rel));
      const label = this.boundText(next);
      if (label) {
        this.update(label, { x: (start[0] + end[0]) / 2 - label.width / 2, y: (start[1] + end[1]) / 2 - label.height / 2 });
      }
    }
  }
}

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function box(el: El): Box {
  if (Array.isArray(el.points) && el.points.length > 0) {
    const xs = el.points.map((p: number[]) => el.x + p[0]);
    const ys = el.points.map((p: number[]) => el.y + p[1]);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  return { x1: el.x, y1: el.y, x2: el.x + el.width, y2: el.y + el.height };
}

function center(el: El): [number, number] {
  const b = box(el);
  return [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2];
}

/**
 * Point where the line from `inside` (centre of el) towards `outside` leaves
 * the element, plus a small gap. Ellipses and diamonds are treated by their
 * shape, others by their box.
 */
function clip(el: El, inside: [number, number], outside: [number, number], gap: number): [number, number] {
  const [cx, cy] = inside;
  const dx = outside[0] - cx;
  const dy = outside[1] - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const hw = el.width / 2;
  const hh = el.height / 2;
  let t: number;
  if (el.type === "ellipse") {
    t = 1 / Math.sqrt((ux * ux) / (hw * hw || 1) + (uy * uy) / (hh * hh || 1));
  } else if (el.type === "diamond") {
    t = 1 / (Math.abs(ux) / (hw || 1) + Math.abs(uy) / (hh || 1));
  } else {
    const tx = ux !== 0 ? hw / Math.abs(ux) : Infinity;
    const ty = uy !== 0 ? hh / Math.abs(uy) : Infinity;
    t = Math.min(tx, ty);
  }
  return [cx + ux * (t + gap), cy + uy * (t + gap)];
}
