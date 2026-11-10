/**
 * Side panel "Formen": a dropdown with three collections of shapes, each made
 * of one or more libraries from libraries.excalidraw.com (MIT licence, stored
 * in the plugin under js/dist/libraries/): basic shapes, and two collections
 * for teaching. A click inserts the shape in the middle of the view; shapes
 * can also be dragged onto the board.
 */
import { useEffect, useRef, useState } from "react";
import { CaptureUpdateAction, exportToSvg, MIME_TYPES, restoreElements, restoreLibraryItems, Sidebar } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, LibraryItem } from "@excalidraw/excalidraw/types";
import type { BoardConfig } from "../types.ts";

export const SHAPES_SIDEBAR = "xudw-shapes";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ShapeLibrary {
  file: string;
  name: string;
  author: string;
}

interface ShapeCollection {
  /** key of the name in config.texts */
  text: "shapesLibBasic" | "shapesLibPeople" | "shapesLibCharts";
  libraries: readonly ShapeLibrary[];
}

export const COLLECTIONS: readonly ShapeCollection[] = [
  {
    text: "shapesLibBasic",
    libraries: [
      { file: "basic-shapes.excalidrawlib", name: "Basic shapes", author: "Pablo Gil Fernández" },
      { file: "3d-shapes.excalidrawlib", name: "3D Shapes", author: "Andre Costa" },
    ],
  },
  {
    text: "shapesLibPeople",
    libraries: [
      { file: "stick-figures.excalidrawlib", name: "Stick Figures", author: "Youri Tjang" },
      { file: "stick-people.excalidrawlib", name: "Stick people", author: "David Hurt" },
      { file: "bubbles.excalidrawlib", name: "Bubbles", author: "Oscar Capraro" },
    ],
  },
  {
    text: "shapesLibCharts",
    libraries: [
      { file: "data-viz.excalidrawlib", name: "Data Viz", author: "dbs-sticky" },
      { file: "math-teacher-library.excalidrawlib", name: "Math Teacher Library", author: "Yatrik Patel" },
    ],
  },
];

const cache = new Map<string, LibraryItem[]>();

async function loadLibrary(config: BoardConfig, lib: ShapeLibrary): Promise<LibraryItem[]> {
  const cached = cache.get(lib.file);
  if (cached) return cached;
  const response = await fetch(`${config.assetPath}libraries/${lib.file}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  // version 1 files: "library" (lists of elements), version 2: "libraryItems"
  const items = restoreLibraryItems(data.libraryItems ?? data.library ?? [], "published") as LibraryItem[];
  cache.set(lib.file, items);
  return items;
}

/** Copies the elements of a library item with new ids, centred at (cx, cy), grouped. */
function instantiate(item: LibraryItem, cx: number, cy: number): any[] {
  const source = restoreElements(item.elements as never, null) as any[];
  const newId = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
  const ids = new Map<string, string>();
  const groups = new Map<string, string>();
  for (const el of source) ids.set(el.id, newId());
  const mapId = (id: string | null | undefined) => (id && ids.has(id) ? ids.get(id)! : null);
  const xs = source.map((e) => e.x);
  const ys = source.map((e) => e.y);
  const x2 = source.map((e) => e.x + e.width);
  const y2 = source.map((e) => e.y + e.height);
  const dx = cx - (Math.min(...xs) + Math.max(...x2)) / 2;
  const dy = cy - (Math.min(...ys) + Math.max(...y2)) / 2;
  const outer = source.length > 1 ? newId() : null;
  return source.map((el) => ({
    ...el,
    id: ids.get(el.id),
    x: el.x + dx,
    y: el.y + dy,
    version: 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    index: null,
    groupIds: [
      ...(el.groupIds ?? []).map((g: string) => {
        if (!groups.has(g)) groups.set(g, newId());
        return groups.get(g);
      }),
      ...(outer ? [outer] : []),
    ],
    containerId: mapId(el.containerId),
    frameId: null,
    boundElements: el.boundElements ? el.boundElements.filter((b: any) => ids.has(b.id)).map((b: any) => ({ ...b, id: ids.get(b.id) })) : null,
    startBinding: el.startBinding && ids.has(el.startBinding.elementId) ? { ...el.startBinding, elementId: ids.get(el.startBinding.elementId) } : null,
    endBinding: el.endBinding && ids.has(el.endBinding.elementId) ? { ...el.endBinding, elementId: ids.get(el.endBinding.elementId) } : null,
    locked: false,
  }));
}

function Preview({ item }: { item: LibraryItem }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    void exportToSvg({
      elements: item.elements as never,
      appState: { exportBackground: false, viewBackgroundColor: "transparent" } as never,
      files: null,
      exportPadding: 6,
    }).then((svg: SVGSVGElement) => {
      if (cancelled || !ref.current) return;
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      ref.current.replaceChildren(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [item]);
  return <div className="xudw-shape-preview" ref={ref} />;
}

export function ShapesSidebar({ api, config }: { api: ExcalidrawImperativeAPI | null; config: BoardConfig }) {
  const t = config.texts;
  const [selected, setSelected] = useState(0);
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const collection = COLLECTIONS[selected];

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setFailed(false);
    Promise.all(collection.libraries.map((lib) => loadLibrary(config, lib)))
      .then((loaded) => !cancelled && setItems(loaded.flat()))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [collection, config]);

  const insert = (item: LibraryItem) => {
    if (!api || !config.canEdit) return;
    const app = api.getAppState();
    const zoom = app.zoom.value;
    const cx = -app.scrollX + app.width / 2 / zoom;
    const cy = -app.scrollY + app.height / 2 / zoom;
    const created = instantiate(item, cx, cy);
    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), ...(restoreElements(created as never, null) as never[])] as never,
      appState: { selectedElementIds: Object.fromEntries(created.filter((e) => !e.containerId).map((e) => [e.id, true])) } as never,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  return (
    <Sidebar name={SHAPES_SIDEBAR} className="xudw-shapes">
      <Sidebar.Header>{t.shapesTitle}</Sidebar.Header>
      <div className="xudw-shapes-body">
        <label className="xudw-shapes-label" htmlFor="xudw-shapes-select">{t.shapesLibrary}</label>
        <select id="xudw-shapes-select" className="xudw-shapes-select" value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
          {COLLECTIONS.map((c, i) => (
            <option key={c.text} value={i}>{t[c.text]}</option>
          ))}
        </select>
        <p className="xudw-shapes-hint">{config.canEdit ? t.shapesHint : t.cmdViewOnly}</p>
        {failed && <p className="xudw-warning">{t.offline}</p>}
        {items === null && !failed && <p className="xudw-shapes-hint">{t.shapesLoading}</p>}
        {items !== null && (
          <div className="xudw-shapes-grid">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="xudw-shape"
                title={item.name || t[collection.text]}
                disabled={!config.canEdit}
                draggable={config.canEdit}
                onClick={() => insert(item)}
                onDragStart={(e) => {
                  // Excalidraw inserts dropped library items itself (with new ids)
                  e.dataTransfer.setData(MIME_TYPES.excalidrawlib, JSON.stringify({ type: "excalidrawlib", version: 2, source: "udon-whiteboard", libraryItems: [item] }));
                }}
              >
                <Preview item={item} />
              </button>
            ))}
          </div>
        )}
        <p className="xudw-shapes-source">{t.shapesSource.replace("%s", collection.libraries.map((l) => `«${l.name}» – ${l.author}`).join(", "))}</p>
      </div>
    </Sidebar>
  );
}
