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
import { CaptureUpdateAction, convertToExcalidrawElements, newElementWith } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, LibraryItem } from "@excalidraw/excalidraw/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type El = Record<string, any>;

/** classic sticky note colours: [paper, edge] */
export const NOTE_COLORS: ReadonlyArray<readonly [string, string]> = [
  ["#fff176", "#c9b52a"], // yellow
  ["#ffcc80", "#d9984a"], // orange
  ["#f8bbd0", "#d07a98"], // pink
  ["#ccff90", "#8fbf55"], // green
  ["#90caf9", "#5592c4"], // blue
  ["#d1b3f5", "#9a78c8"], // purple
];

const SIZE = 160;
/** offset of the sheets below the top one */
const STACK = [10, 5];

export type NoteShape = "square" | "round";

function randomId(): string {
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
}

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
    strokeWidth: 2,
    roughness: 0,
    roundness: shape === "round" ? null : { type: 3 },
    ...extra,
  };
}

/** elements of a single note */
export function noteElements(shape: NoteShape, paper: string, edge: string): El[] {
  return convertToExcalidrawElements([sheet(0, 0, shape, paper, edge, {}) as never], { regenerateIds: false }) as unknown as El[];
}

/** elements of a note pad: sheets below, the top sheet last */
export function padElements(shape: NoteShape, paper: string, edge: string): El[] {
  const group = randomId();
  const mark = (top: boolean) => ({ groupIds: [group], customData: { xudwPad: { shape, top } } });
  const skeletons = [
    ...STACK.map((off) => sheet(off, off, shape, paper, edge, mark(false))),
    sheet(0, 0, shape, paper, edge, mark(true)),
  ];
  return convertToExcalidrawElements(skeletons as never, { regenerateIds: false }) as unknown as El[];
}

/** the items of the collection "Notizzettel": per colour square and round note, then the pads */
export function stickyNoteItems(names: { square: string; round: string; padSquare: string; padRound: string }): LibraryItem[] {
  const items: LibraryItem[] = [];
  const add = (name: string, elements: El[]) =>
    items.push({ id: randomId(), status: "unpublished", created: Date.now(), name, elements: elements as never } as LibraryItem);
  for (const [paper, edge] of NOTE_COLORS) {
    add(names.square, noteElements("square", paper, edge));
    add(names.round, noteElements("round", paper, edge));
  }
  for (const [paper, edge] of NOTE_COLORS) {
    add(names.padSquare, padElements("square", paper, edge));
    add(names.padRound, padElements("round", paper, edge));
  }
  return items;
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

function tearOff(api: ExcalidrawImperativeAPI, all: readonly El[], groups: Set<string>, before: Map<string, { x: number; y: number }>): void {
  const notes: El[] = [];
  const back = new Map<string, { x: number; y: number }>();
  for (const group of groups) {
    const sheets = all.filter((e) => isPad(e) && padGroup(e) === group);
    const top = sheets.find((e) => e.customData.xudwPad.top) ?? sheets[sheets.length - 1];
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
