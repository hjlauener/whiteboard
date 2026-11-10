/**
 * Sticky notes ("Notizzettel") in six colours, square or round:
 * - single notes, and
 * - note pads: a stack of sheets on the board; dragging the pad tears off
 *   the top sheet (it stays where it is dropped, the pad jumps back). With
 *   Shift held the pad itself is moved.
 *
 * The notes and pads are offered in the side panel "Formen" (collection
 * "Notizzettel", ShapesSidebar.tsx). A pad is a group of sheets marked with
 * customData.xudwPad; the tearing off is done here (installStickyPads).
 */
import { CaptureUpdateAction, convertToExcalidrawElements, FONT_FAMILY, newElementWith } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, LibraryItem } from "@excalidraw/excalidraw/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type El = Record<string, any>;

/** sticky note colours, in pairs light / strong: [paper, edge, ink] */
export const NOTE_COLORS: ReadonlyArray<readonly [string, string, string]> = [
  ["#fff7a8", "#e3d77a", "#1e1e1e"], // light yellow
  ["#ffe36e", "#dcbd3e", "#1e1e1e"], // yellow
  ["#f6b47c", "#d58c50", "#1e1e1e"], // orange
  ["#f2a09a", "#cf7770", "#1e1e1e"], // salmon
  ["#f8cdef", "#d9a3cd", "#1e1e1e"], // light pink
  ["#ef9ce3", "#cb71bd", "#1e1e1e"], // pink
  ["#a9e0fb", "#7bbad9", "#1e1e1e"], // sky blue
  ["#86aef2", "#5f88cf", "#1e1e1e"], // blue
  ["#98e4d6", "#6cc1b1", "#1e1e1e"], // teal
  ["#7fd88f", "#58b569", "#1e1e1e"], // green
  ["#d6eda6", "#afcb78", "#1e1e1e"], // light green
  ["#bde26d", "#96bd45", "#1e1e1e"], // lime
  ["#f3f4f6", "#c9ccd2", "#1e1e1e"], // white
  ["#1e1e1e", "#000000", "#ffffff"], // black
];

const SIZE = 160;

export type NoteShape = "square" | "round";

function randomId(): string {
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
}

/** a darker shade of a colour (the lower sheets of a pad) */
function darker(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * (1 - amount));
  return "#" + ((1 << 24) | (c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).slice(1);
}

/** flat sheet: sharp corners, thin edge a little darker than the paper */
function sheet(x: number, y: number, shape: NoteShape, paper: string, edge: string, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    type: shape === "round" ? "ellipse" : "rectangle",
    id: randomId(),
    x,
    y,
    width: SIZE,
    height: SIZE,
    backgroundColor: paper,
    strokeColor: edge,
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
    roundness: null,
    ...extra,
  };
}

const convert = (skeletons: Record<string, unknown>[]) =>
  convertToExcalidrawElements(skeletons as never, { regenerateIds: false }) as unknown as El[];

/** elements of a single note */
export function noteElements(shape: NoteShape, color: number): El[] {
  const [paper, edge, ink] = NOTE_COLORS[color];
  return convert([sheet(0, 0, shape, paper, edge, { customData: { xudwNote: { ink } } })]);
}

/**
 * Elements of a note pad: a light frame with the label, two lower sheets
 * (seen as a darker band below the top sheet) and the top sheet.
 */
export function padElements(shape: NoteShape, color: number, label: string): El[] {
  const [paper, edge, ink] = NOTE_COLORS[color];
  const group = randomId();
  const mark = (role: string) => ({ groupIds: [group], customData: { xudwPad: { shape, role, ink } } });
  return convert([
    {
      type: "rectangle",
      id: randomId(),
      x: -14,
      y: -38,
      width: SIZE + 28,
      height: SIZE + 62,
      backgroundColor: "#f1f3f5",
      strokeColor: "#dee2e6",
      fillStyle: "solid",
      strokeWidth: 1,
      roughness: 0,
      roundness: { type: 3 },
      ...mark("frame"),
    },
    { type: "text", id: randomId(), x: -4, y: -30, text: label, fontSize: 16, fontFamily: FONT_FAMILY.Nunito, strokeColor: "#495057", ...mark("label") },
    sheet(0, 10, shape, darker(paper, 0.18), darker(edge, 0.1), mark("sheet")),
    sheet(0, 5, shape, darker(paper, 0.09), edge, mark("sheet")),
    sheet(0, 0, shape, paper, edge, mark("top")),
  ]);
}

/** library item (for clicking and dragging onto the board) */
export function noteItem(kind: "note" | "pad", shape: NoteShape, color: number, label: string): LibraryItem {
  return {
    id: randomId(),
    status: "unpublished",
    created: Date.now(),
    name: label,
    elements: (kind === "pad" ? padElements(shape, color, label) : noteElements(shape, color)) as never,
  } as LibraryItem;
}

// ----------------------------------------------------------------------
// tearing off
// ----------------------------------------------------------------------

const isPad = (el: El) => !el.isDeleted && el.customData?.xudwPad !== undefined && (el.groupIds?.length ?? 0) > 0;
const padGroup = (el: El): string => el.groupIds[el.groupIds.length - 1];

/**
 * Watches the board: when a pad (all its sheets selected) has been dragged,
 * the pad goes back to where it was and a new note is left where the top
 * sheet was dropped. With Shift held, the pad is moved as usual.
 */
export function installStickyPads(api: ExcalidrawImperativeAPI): () => void {
  /** positions of the pad sheets before the drag */
  let before = new Map<string, { x: number; y: number }>();
  let dragged: Set<string> | null = null;
  let shift = false;
  const onKey = (e: KeyboardEvent) => {
    shift = e.shiftKey;
  };
  const onPointer = (e: PointerEvent) => {
    shift = e.shiftKey;
  };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKey, true);
  window.addEventListener("pointerdown", onPointer, true);
  window.addEventListener("pointerup", onPointer, true);

  const removeChange = api.onChange((elements, appState) => {
    const all = elements as unknown as El[];
    if (appState.selectedElementsAreBeingDragged) {
      if (dragged === null) {
        const selected = all.filter((e) => appState.selectedElementIds[e.id] && !e.isDeleted);
        const groups = new Set(selected.filter(isPad).map(padGroup));
        // only when nothing but pads is dragged
        dragged = groups.size > 0 && selected.every((e) => isPad(e) && groups.has(padGroup(e))) ? groups : new Set();
      }
      return;
    }
    if (dragged !== null && dragged.size > 0 && !shift) {
      const groups = dragged;
      dragged = null;
      tearOff(api, all, groups, before);
    } else {
      dragged = null;
    }
    inkTexts(api, all, appState.editingTextElement?.id ?? null);
    // remember where the pads are
    const positions = new Map<string, { x: number; y: number }>();
    for (const el of all) if (isPad(el)) positions.set(el.id, { x: el.x, y: el.y });
    before = positions;
  });

  return () => {
    removeChange();
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("keyup", onKey, true);
    window.removeEventListener("pointerdown", onPointer, true);
    window.removeEventListener("pointerup", onPointer, true);
  };
}

/**
 * Text written on a note gets the ink colour of the note once (white on the
 * black note); afterwards it can be changed like any text.
 */
function inkTexts(api: ExcalidrawImperativeAPI, all: readonly El[], editing: string | null): void {
  const byId = new Map(all.map((e) => [e.id, e]));
  const fixes = new Map<string, Record<string, unknown>>();
  for (const text of all) {
    if (text.type !== "text" || text.isDeleted || !text.containerId || text.id === editing || text.customData?.xudwInked) continue;
    const box = byId.get(text.containerId);
    const ink = box?.customData?.xudwNote?.ink ?? (box?.customData?.xudwPad?.role === "top" ? box.customData.xudwPad.ink : undefined);
    if (ink === undefined || text.text === "") continue;
    fixes.set(text.id, { strokeColor: ink, customData: { ...(text.customData ?? {}), xudwInked: true } });
  }
  if (fixes.size === 0) return;
  window.setTimeout(() => {
    api.updateScene({
      elements: api.getSceneElementsIncludingDeleted().map((e) => (fixes.has(e.id) ? newElementWith(e as never, fixes.get(e.id) as never) : e)) as never,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, 0);
}

function tearOff(api: ExcalidrawImperativeAPI, all: readonly El[], groups: Set<string>, before: Map<string, { x: number; y: number }>): void {
  const notes: El[] = [];
  const back = new Map<string, { x: number; y: number }>();
  for (const group of groups) {
    const sheets = all.filter((e) => isPad(e) && padGroup(e) === group);
    const top = sheets.find((e) => e.customData.xudwPad.role === "top") ?? sheets[sheets.length - 1];
    const start = top ? before.get(top.id) : undefined;
    if (!top || !start || Math.hypot(top.x - start.x, top.y - start.y) < 8) continue;
    for (const s of sheets) {
      const pos = before.get(s.id);
      if (pos) back.set(s.id, pos);
    }
    // the torn-off note: a copy of the top sheet, without the pad marks
    const [note] = convertToExcalidrawElements(
      [
        {
          type: top.type,
          id: randomId(),
          x: top.x,
          y: top.y,
          width: top.width,
          height: top.height,
          angle: top.angle,
          backgroundColor: top.backgroundColor,
          strokeColor: top.strokeColor,
          fillStyle: top.fillStyle,
          strokeWidth: top.strokeWidth,
          roughness: top.roughness,
          roundness: top.roundness,
          opacity: top.opacity,
          customData: { xudwNote: { ink: top.customData.xudwPad.ink ?? "#1e1e1e" } },
        } as never,
      ],
      { regenerateIds: false },
    ) as unknown as El[];
    notes.push(note);
  }
  if (notes.length === 0) return;
  window.setTimeout(() => {
    const elements = api
      .getSceneElementsIncludingDeleted()
      .map((e) => (back.has(e.id) ? newElementWith(e as never, back.get(e.id) as never) : e));
    api.updateScene({
      elements: [...elements, ...notes] as never,
      appState: { selectedElementIds: Object.fromEntries(notes.map((n) => [n.id, true])), selectedGroupIds: {} } as never,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, 0);
}
