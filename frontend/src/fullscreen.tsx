/**
 * Button "Vollbild" (top right): shows only the whiteboard
 * a) in the browser window: the board covers the page (ILIAS menus hidden);
 * b) on the whole screen: the browser's full screen mode (Fullscreen API).
 * In either mode the same button ends it; the browser also ends b) with Esc.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { BoardConfig } from "./types.ts";

type Mode = "none" | "window" | "screen";

const ICON_ENTER = "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4";
const ICON_EXIT = "M8 4v4H4M20 8h-4V4M16 20v-4h4M4 16h4v4";

export function FullscreenButton({ api, config, board, portal }: { api: ExcalidrawImperativeAPI | null; config: BoardConfig; board: HTMLElement | null; portal: HTMLElement | null }) {
  const t = config.texts;
  const [mode, setMode] = useState<Mode>("none");
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** when full screen was entered (some browsers end it at once when not allowed) */
  const enteredAt = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // after a change of size Excalidraw has to measure its canvas again
  const remeasure = () => {
    window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
      api?.refresh();
    }, 50);
  };

  // the browser ended full screen (Esc): follow
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && mode === "screen") {
        // ended at once: not allowed here (e.g. embedded browser), then at least the window
        setMode(performance.now() - enteredAt.current < 800 ? "window" : "none");
        remeasure();
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  });

  // "in the browser window": board over the page, page not scrollable
  useEffect(() => {
    if (!board) return;
    board.classList.toggle("xudw-maximized", mode === "window");
    document.documentElement.classList.toggle("xudw-page-maximized", mode === "window");
  }, [mode, board]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const enter = async (next: Mode) => {
    setOpen(false);
    if (next === "screen" && board) {
      enteredAt.current = performance.now();
      // some browsers neither allow nor refuse (embedded browsers): wait briefly
      const ok = await Promise.race([
        board.requestFullscreen().then(
          () => true,
          () => false,
        ),
        new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 700)),
      ]);
      if (!ok || !document.fullscreenElement) next = "window"; // not allowed here: at least the window
    }
    setMode(next);
    remeasure();
  };

  const leave = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // already ended
      }
    }
    setMode("none");
    remeasure();
  };

  const active = mode !== "none";
  const rect = buttonRef.current?.getBoundingClientRect();
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`xudw-cmd-button xudw-fullscreen-button${active ? " xudw-active" : ""}`}
        title={active ? t.fullscreenExit : t.fullscreenTitle}
        aria-label={active ? t.fullscreenExit : t.fullscreenTitle}
        aria-haspopup={active ? undefined : "menu"}
        aria-expanded={active ? undefined : open}
        onClick={() => (active ? void leave() : setOpen(!open))}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={active ? ICON_EXIT : ICON_ENTER} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        rect &&
        portal &&
        createPortal(
          <div ref={menuRef} className="xudw-tpl-menu" style={{ top: rect.bottom + 6, right: window.innerWidth - rect.right }}>
            <div className="xudw-tpl-list xudw-fullscreen-list" role="menu" aria-label={t.fullscreenTitle}>
              <div className="xudw-tpl-title">{t.fullscreenTitle}</div>
              <button type="button" role="menuitem" className="xudw-tpl-item" onClick={() => void enter("window")}>
                <span className="xudw-tpl-name">{t.fullscreenWindow}</span>
                <span className="xudw-tpl-info">{t.fullscreenWindowInfo}</span>
              </button>
              {document.fullscreenEnabled && (
                <button type="button" role="menuitem" className="xudw-tpl-item" onClick={() => void enter("screen")}>
                  <span className="xudw-tpl-name">{t.fullscreenScreen}</span>
                  <span className="xudw-tpl-info">{t.fullscreenScreenInfo}</span>
                </button>
              )}
            </div>
          </div>,
          portal,
        )}
    </>
  );
}
