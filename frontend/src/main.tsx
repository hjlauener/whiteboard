import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import "@excalidraw/excalidraw/index.css";
import "./whiteboard.css";
import { BoardSync, type SyncStatus } from "./sync";
import type { BoardConfig } from "./types";

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

function StatusBadge({ sync, config }: { sync: BoardSync; config: BoardConfig }) {
  const [status, setStatus] = useState<SyncStatus>("online");
  useEffect(() => sync.onStatus(setStatus), [sync]);
  const text = status === "offline" ? config.texts.offline : status === "saving" ? config.texts.saving : config.texts.saved;
  return <div className={`xudw-status xudw-status-${status}`}>{text}</div>;
}

function Board({ config, sync, initial }: { config: BoardConfig; sync: BoardSync; initial: OrderedExcalidrawElement[] }) {
  return (
    <Excalidraw
      langCode={config.langCode}
      initialData={{ elements: initial, scrollToContent: true }}
      isCollaborating={true}
      viewModeEnabled={!config.canEdit}
      excalidrawAPI={(api: ExcalidrawImperativeAPI) => sync.attach(api)}
      onChange={(elements) => sync.handleChange(elements)}
      onPointerUpdate={({ pointer }) => sync.handlePointer(pointer)}
      renderTopRightUI={() => <StatusBadge sync={sync} config={config} />}
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
    />
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
