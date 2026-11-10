/**
 * Dropdown "Linienform" in the properties panel: a fourth button in the row
 * "Konturstil" (solid, dashed, dotted) shows the current line shape; a click
 * opens the list with a preview of each shape. The choice applies to the
 * selected lines and arrows and to new ones (linePatterns.ts).
 *
 * Excalidraw has no interface to extend its properties panel, so the button
 * is added to the row when it appears (like the right-click entries in
 * commands/convertMenu.ts). Shown only for lines and arrows.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { BoardConfig } from "./types.ts";
import {
  applyToSelection,
  canHavePattern,
  currentLinePattern,
  LINE_PATTERNS,
  patternOf,
  patternPoints,
  setCurrentLinePattern,
  type LinePattern,
} from "./linePatterns.ts";

/** the line shape drawn small, fitted into its box */
export function PatternPreview({ pattern, width = 84 }: { pattern: LinePattern; width?: number }) {
  const pts = patternPoints([[0, 0], [width, 0]], pattern, 0);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 2;
  const [x0, y0] = [Math.min(...xs) - pad, Math.min(...ys, -7) - pad];
  const [w, h] = [Math.max(...xs) - x0 + pad, Math.max(...ys, 7) - y0 + pad];
  return (
    <svg className="xudw-lp-preview" viewBox={`${x0} ${y0} ${w} ${h}`} aria-hidden="true" focusable="false">
      <polyline points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function selectedLines(api: ExcalidrawImperativeAPI) {
  const selected = api.getAppState().selectedElementIds ?? {};
  return api.getSceneElements().filter((e) => selected[e.id] && canHavePattern(e as never));
}

function LinePatternButton({ api, config, portal }: { api: ExcalidrawImperativeAPI; config: BoardConfig; portal: HTMLElement }) {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const t = config.linePatterns;

  // follow the selection
  useEffect(() => api.onChange(() => setTick((n) => n + 1)), [api]);

  // close on a click elsewhere or with Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const lines = selectedLines(api);
  const current: LinePattern = lines.length > 0 ? patternOf(lines[0] as never) : currentLinePattern();
  const name = (p: LinePattern) => t.items[p]?.[0] ?? p;

  const choose = (p: LinePattern) => {
    setCurrentLinePattern(p);
    applyToSelection(api, p);
    setOpen(false);
    setTick((n) => n + 1);
  };

  // below the button, or above it if there is not enough room
  const rect = buttonRef.current?.getBoundingClientRect();
  let place: Record<string, number> = {};
  if (rect) {
    const below = window.innerHeight - rect.bottom - 14;
    const above = rect.top - 14;
    place = below >= 320 || below >= above ? { left: rect.left, top: rect.bottom + 6, maxHeight: below } : { left: rect.left, bottom: window.innerHeight - rect.top + 6, maxHeight: above };
  }
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`xudw-lp-button${current !== "straight" ? " xudw-lp-active" : ""}`}
        title={`${t.title}: ${name(current)}`}
        aria-label={t.title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <PatternPreview pattern={current === "straight" ? "wave" : current} width={40} />
        <span className="xudw-lp-caret" aria-hidden="true">▾</span>
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={listRef}
            className="xudw-lp-list"
            role="listbox"
            aria-label={t.title}
            style={place}
          >
            <div className="xudw-lp-title">{t.title}</div>
            {LINE_PATTERNS.map((p) => (
              <button
                key={p}
                type="button"
                role="option"
                aria-selected={p === current}
                className={`xudw-lp-item${p === current ? " xudw-lp-selected" : ""}`}
                title={t.items[p]?.[1] ?? ""}
                onClick={() => choose(p)}
              >
                <span className="xudw-lp-name">{name(p)}</span>
                <PatternPreview pattern={p} />
              </button>
            ))}
          </div>,
          portal,
        )}
    </>
  );
}

export function installLinePatternMenu(api: ExcalidrawImperativeAPI, container: HTMLElement, config: BoardConfig): () => void {
  let host: HTMLElement | null = null;
  let root: Root | null = null;

  const applicable = (): boolean => {
    const app = api.getAppState();
    const tool = app.activeTool?.type;
    return tool === "line" || tool === "arrow" || selectedLines(api).length > 0;
  };

  const sync = () => {
    if (!config.canEdit) return;
    const input = container.querySelector<HTMLInputElement>('input[name="strokeStyle"]');
    const row = input?.closest("fieldset")?.querySelector<HTMLElement>(".buttonList") ?? null;
    if (row === null) {
      if (root !== null && host !== null && !host.isConnected) {
        const old = root;
        root = null;
        host = null;
        window.setTimeout(() => old.unmount(), 0);
      }
      return;
    }
    if (host === null || !row.contains(host)) {
      if (root !== null) {
        const old = root;
        window.setTimeout(() => old.unmount(), 0);
      }
      host = document.createElement("span");
      host.className = "xudw-lp-host";
      row.appendChild(host);
      root = createRoot(host);
      const portal = container.querySelector<HTMLElement>(".excalidraw") ?? container;
      root.render(<LinePatternButton api={api} config={config} portal={portal} />);
    }
    host.style.display = applicable() ? "" : "none";
  };

  const observer = new MutationObserver(sync);
  observer.observe(container, { childList: true, subtree: true });
  const removeChange = api.onChange(sync);
  sync();
  return () => {
    observer.disconnect();
    removeChange();
    if (root !== null) {
      const old = root;
      window.setTimeout(() => old.unmount(), 0);
    }
    host?.remove();
  };
}
