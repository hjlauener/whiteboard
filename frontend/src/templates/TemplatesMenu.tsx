/**
 * Button "Vorlagen" (top right, next to "KI"): a menu with the topics, each
 * with a submenu of its templates (only those switched on in the plugin
 * configuration). Choosing one asks first, because the board is cleared for
 * everybody; then the template is drawn with commands (catalog.ts), together
 * with the clearing as one undoable step.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { Command } from "../../../sdk/js/src/language.ts";
import { executeCommands } from "../commands/execute.ts";
import { DEFAULT_PALETTE, PALETTES } from "../../palettes.ts";
import { Builder, type Colors } from "./builder.ts";
import { TEMPLATES } from "./catalog.ts";
import type { BoardConfig } from "../types.ts";

/** colours of the templates from the palette of the board (light shades for areas) */
function templateColors(palette: string): Colors {
  const p = PALETTES[palette] ?? PALETTES[DEFAULT_PALETTE];
  const f = p.families;
  const light = (...names: string[]) => {
    for (const name of names) if (f[name]) return f[name][0];
    return "transparent";
  };
  return {
    ink: p.stroke[0],
    muted: f.greys?.[4] ?? f.blacks?.[0] ?? "#666666",
    yellow: light("yellows", "oranges"),
    blue: light("blues", "cyans", "teals"),
    green: light("greens", "teals"),
    red: light("reds", "pinks"),
    purple: light("purples", "pinks", "blues"),
    orange: light("oranges", "yellows", "reds"),
    grey: light("greys"),
  };
}

/**
 * Zooms so that the whole board is visible, below the toolbar (which covers
 * the top of the board) and above the zoom buttons.
 */
function showWhole(api: ExcalidrawImperativeAPI): void {
  const els = api.getSceneElements();
  if (els.length === 0) return;
  const xs = els.flatMap((e) => [e.x, e.x + e.width]);
  const ys = els.flatMap((e) => [e.y, e.y + e.height]);
  const [x1, x2, y1, y2] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const app = api.getAppState();
  const top = 90;
  const bottom = 70;
  const side = 40;
  const width = Math.max(100, app.width - 2 * side);
  const height = Math.max(100, app.height - top - bottom);
  const zoom = Math.max(0.1, Math.min(1, width / Math.max(1, x2 - x1), height / Math.max(1, y2 - y1)));
  api.updateScene({
    appState: {
      zoom: { value: zoom },
      scrollX: (side + (width - (x2 - x1) * zoom) / 2) / zoom - x1,
      scrollY: (top + (height - (y2 - y1) * zoom) / 2) / zoom - y1,
    } as never,
    captureUpdate: CaptureUpdateAction.NEVER,
  });
}

/** clears the board and draws the template (one step for "Rückgängig") */
export function insertTemplate(api: ExcalidrawImperativeAPI, config: BoardConfig, id: string): string | null {
  const draw = TEMPLATES[id];
  if (!draw) return null;
  const texts = config.templates.texts;
  const b = new Builder(`t${Date.now().toString(36)}-`, templateColors(config.palette));
  draw(
    b,
    (key) => texts[`${id}_${key}`] ?? key,
    (key) => texts[`common_${key}`] ?? key,
  );
  const existing = api.getSceneElements().filter((e) => !(e.type === "text" && (e as { containerId?: string | null }).containerId));
  const commands: Command[] = existing.length > 0 ? [{ cmd: "delete", targets: existing.map((e) => e.id) }, ...b.commands] : b.commands;
  const result = executeCommands(api, commands, []);
  if (result.problems.length > 0) return result.problems[0].message;
  api.updateScene({ appState: { selectedElementIds: {} } as never, captureUpdate: CaptureUpdateAction.NEVER });
  showWhole(api);
  return null;
}

export function TemplatesButton({ api, config, portal }: { api: ExcalidrawImperativeAPI | null; config: BoardConfig; portal: HTMLElement | null }) {
  const t = config.texts;
  const topics = config.templates.topics;
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  if (!config.canEdit) return null;

  const rect = buttonRef.current?.getBoundingClientRect();
  const current = topics.find((tp) => tp.id === topic);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="xudw-cmd-button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={t.templatesTitle}
        onClick={() => {
          setOpen(!open);
          setTopic(null);
        }}
      >
        {t.templatesButton}
      </button>
      {open &&
        rect &&
        portal &&
        createPortal(
          <div ref={menuRef} className="xudw-tpl-menu" style={{ top: rect.bottom + 6, right: window.innerWidth - rect.right, maxHeight: window.innerHeight - rect.bottom - 16 }}>
            <div className="xudw-tpl-list" role="menu" aria-label={t.templatesTitle}>
              <div className="xudw-tpl-title">{t.templatesTitle}</div>
              {topics.length === 0 && <div className="xudw-tpl-empty">{t.templatesNone}</div>}
              {topics.map((tp) => (
                <button
                  key={tp.id}
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={topic === tp.id}
                  className={`xudw-tpl-topic${topic === tp.id ? " xudw-tpl-active" : ""}`}
                  onMouseEnter={() => setTopic(tp.id)}
                  onFocus={() => setTopic(tp.id)}
                  onClick={() => setTopic(tp.id)}
                >
                  <span className="xudw-tpl-arrow" aria-hidden="true">‹</span>
                  <span>{tp.name}</span>
                  <span className="xudw-tpl-count">{tp.items.length}</span>
                </button>
              ))}
            </div>
            {current && (
              <div className="xudw-tpl-list xudw-tpl-sub" role="menu" aria-label={current.name}>
                <div className="xudw-tpl-title">{current.name}</div>
                {current.items.map(([id, name, info]) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    className="xudw-tpl-item"
                    onClick={() => {
                      setOpen(false);
                      setConfirm({ id, name });
                    }}
                  >
                    <span className="xudw-tpl-name">{name}</span>
                    <span className="xudw-tpl-info">{info}</span>
                  </button>
                ))}
              </div>
            )}
          </div>,
          portal,
        )}
      {confirm &&
        portal &&
        createPortal(
          <div className="xudw-overlay" role="alertdialog" aria-modal="true" aria-label={t.templatesConfirmTitle} onKeyDown={(e) => e.key === "Escape" && setConfirm(null)}>
            <div className="xudw-panel xudw-confirm">
              <div className="xudw-panel-head">
                <h2>{t.templatesConfirmTitle}</h2>
                <button type="button" className="xudw-close" onClick={() => setConfirm(null)} aria-label={t.templatesCancel}>×</button>
              </div>
              <div className="xudw-panel-body">
                <p>{t.templatesConfirmText.replace("%s", confirm.name)}</p>
                <div className="xudw-actions">
                  <span className="xudw-spacer" />
                  <button type="button" onClick={() => setConfirm(null)} autoFocus>
                    {t.templatesCancel}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      const problem = api ? insertTemplate(api, config, confirm.id) : null;
                      setConfirm(null);
                      if (problem && api) api.setToast({ message: problem, closable: true });
                    }}
                  >
                    {t.templatesConfirmOk}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          portal,
        )}
    </>
  );
}
