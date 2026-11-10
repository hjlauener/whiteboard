import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw, FONT_FAMILY, MainMenu } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import "@excalidraw/excalidraw/index.css";
import "./whiteboard.css";
import { BoardSync, type SyncStatus } from "./sync";
import { CommandPanel } from "./commands/CommandPanel";
import { DEFAULT_PALETTE, PALETTES } from "../palettes.ts";
import { installConvertMenu } from "./commands/convertMenu";
import { SHAPES_SIDEBAR, ShapesSidebar } from "./shapes/ShapesSidebar";
import { installSmoothing, setSmoothingEnabled, smoothingEnabled } from "./smoothing";
import { installLinePatterns } from "./linePatterns";
import { installLinePatternMenu } from "./linePatternMenu";
import type { BoardConfig } from "./types";

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

function StatusBadge({ sync, config }: { sync: BoardSync; config: BoardConfig }) {
  const [status, setStatus] = useState<SyncStatus>("online");
  useEffect(() => sync.onStatus(setStatus), [sync]);
  if (status !== "offline" && !config.canEdit) {
    return <div className="xudw-status xudw-status-view">{config.texts.viewOnly}</div>;
  }
  const text = status === "offline" ? config.texts.offline : status === "saving" ? config.texts.saving : config.texts.saved;
  return <div className={`xudw-status xudw-status-${status}`}>{text}</div>;
}

/**
 * Serif font added to Excalidraw when building (see vite.config.ts), default
 * for new texts. Falls back to Nunito if it is missing.
 */
const SERIF_FONT_ID = ((FONT_FAMILY as Record<string, number>)["Source Serif"] ??
  FONT_FAMILY.Nunito) as typeof FONT_FAMILY.Nunito;

/** fonts of Excalidraw that should be ready before the first text is written */
const FONTS = ['"Source Serif"', "Nunito", "Excalifont", '"Comic Shanns"', '"Lilita One"', '"Liberation Sans"'];
const FONT_SAMPLE = "AaZz09ÄäÖöÜüÉéÈèÀàÇç";

/**
 * Loads the fonts right away. Otherwise Excalidraw measures the first text on
 * the page with a fallback font, and the text box is too narrow (the last
 * letters are cut off). Excalidraw registers its fonts when it starts, so this
 * waits until they are there.
 */
async function preloadFonts(attempt = 0): Promise<void> {
  const loaded = await Promise.all(
    FONTS.map((font) => document.fonts.load(`20px ${font}`, FONT_SAMPLE).catch(() => [])),
  );
  if (loaded.every((faces) => faces.length === 0) && attempt < 10) {
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    return preloadFonts(attempt + 1);
  }
}

/** With localStorage.xudwDebug = "1" the board is reachable in the browser console (window.xudw). */
function exposeForDebugging(api: ExcalidrawImperativeAPI, sync: BoardSync): void {
  try {
    if (window.localStorage.getItem("xudwDebug") === "1") {
      (window as unknown as { xudw: unknown }).xudw = { api, sync };
    }
  } catch {
    // no storage (private mode): no debugging
  }
}

function Board({ config, sync, initial }: { config: BoardConfig; sync: BoardSync; initial: OrderedExcalidrawElement[] }) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [smooth, setSmooth] = useState(smoothingEnabled());
  const [zen, setZen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  // the buttons in the top right are rendered by Excalidraw: they use the current API through a ref
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  useEffect(() => {
    if (api === null || boardRef.current === null) return;
    const removeMenu = installConvertMenu(api, boardRef.current, config);
    const removeSmoothing = installSmoothing(api);
    const removePatterns = installLinePatterns(api);
    const removePatternMenu = installLinePatternMenu(api, boardRef.current, config);
    return () => {
      removeMenu();
      removeSmoothing();
      removePatterns();
      removePatternMenu();
    };
  }, [api, config]);
  return (
    // zen mode: only the toolbar on top (and "Zen-Modus verlassen") stays visible
    <div ref={boardRef} className={zen ? "xudw-board-inner xudw-zen" : "xudw-board-inner"}>
    <Excalidraw
      langCode={config.langCode}
      initialData={{
        elements: initial,
        scrollToContent: true,
        // sober defaults for teaching: serif font, clean lines (each person can change them)
        appState: { currentItemFontFamily: SERIF_FONT_ID, currentItemRoughness: 0, currentItemStrokeColor: (PALETTES[config.palette] ?? PALETTES[DEFAULT_PALETTE]).stroke[0] },
      }}
      isCollaborating={true}
      // shortcuts (Cmd+Z, Delete, ...) also work when the focus has left the
      // board, e.g. after a button in the side panel disappeared; input fields
      // of ILIAS are not affected (Excalidraw ignores keys typed into them)
      handleKeyboardGlobally={true}
      viewModeEnabled={!config.canEdit}
      excalidrawAPI={(api: ExcalidrawImperativeAPI) => {
        sync.attach(api);
        apiRef.current = api;
        setApi(api);
        exposeForDebugging(api, sync);
        void preloadFonts();
      }}
      onChange={(elements, appState) => {
        sync.handleChange(elements, appState);
        if (appState.zenModeEnabled !== zen) setZen(appState.zenModeEnabled);
      }}
      onPointerUpdate={({ pointer }) => sync.handlePointer(pointer)}
      renderTopRightUI={() => (
        <div className="xudw-top-right">
          <button type="button" className="xudw-cmd-button" onClick={() => apiRef.current?.toggleSidebar({ name: SHAPES_SIDEBAR })} title={config.texts.shapesTitle}>
            {config.texts.shapesButton}
          </button>
          <button type="button" className="xudw-cmd-button" onClick={() => setPanelOpen(true)} title={config.texts.cmdTitle}>
            {config.texts.cmdButton}
          </button>
          <StatusBadge sync={sync} config={config} />
        </div>
      )}
      UIOptions={{
        tools: { image: false },
        canvasActions: {
          loadScene: false,
          saveToActiveFile: false,
          export: false,
          saveAsImage: true,
          toggleTheme: true,
        },
      }}
    >
      {/* no links to Excalidraw's GitHub/Discord, no "clear canvas" (it would delete the board for everybody) */}
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.DefaultItems.Help />
        <MainMenu.Separator />
        <MainMenu.Item onSelect={() => apiRef.current?.updateScene({ appState: { zenModeEnabled: true } as never })}>
          {config.texts.menuZen}
        </MainMenu.Item>
        <MainMenu.Item
          onSelect={() => {
            setSmoothingEnabled(!smooth);
            setSmooth(!smooth);
          }}
        >
          {smooth ? "✓ " : ""}
          {config.texts.menuSmooth}
        </MainMenu.Item>
        <MainMenu.DefaultItems.ToggleTheme />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
      <ShapesSidebar api={api} config={config} />
    </Excalidraw>
    {panelOpen && api !== null && <CommandPanel api={api} config={config} onClose={() => setPanelOpen(false)} />}
    </div>
  );
}

async function mount(container: HTMLElement): Promise<void> {
  const config = JSON.parse(container.dataset.config ?? "{}") as BoardConfig;
  window.EXCALIDRAW_ASSET_PATH = config.assetPath;

  const sync = new BoardSync(config);
  let initial: OrderedExcalidrawElement[];
  try {
    initial = await sync.loadInitial();
  } catch (e) {
    console.error("Udon Whiteboard: loading failed", e);
    container.textContent = config.texts.offline;
    container.classList.add("xudw-error");
    return;
  }

  createRoot(container).render(
    <StrictMode>
      <Board config={config} sync={sync} initial={initial} />
    </StrictMode>,
  );
}

document.querySelectorAll<HTMLElement>(".xudw-board").forEach((el) => void mount(el));
