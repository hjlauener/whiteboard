/**
 * Overlay "Befehle und KI": paste commands (e.g. the answer of an AI), check
 * and run them; "Für eine KI kopieren" copies the text for an AI
 * (templates/ai_prompt_*.txt with the board content), which can also be
 * looked at. Texts come from the ILIAS language files (config.texts).
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { buildPrompt, parse, type Problem } from "../../../sdk/js/src/language.ts";
import { executeCommands } from "./execute.ts";
import { exportBoard } from "./export.ts";
import type { BoardConfig } from "../types.ts";

/**
 * The text for an AI from the plugin (templates/ai_prompt_*.txt): the block
 * [[BOARD … @@BOARD@@ … ]] only with board content, [[TASK … @@TASK@@ … ]]
 * only with a task. (No {…} placeholders: ILIAS removes them from the page.) Without a template from ILIAS the generated English
 * prompt of the language library is used.
 */
function aiPrompt(template: string, board: string, task: string): string {
  if (template.trim() === "") {
    return buildPrompt({ board, task });
  }
  const block = (text: string, name: string, value: string) =>
    text.replace(new RegExp(`\\[\\[${name}\\n([\\s\\S]*?)\\n\\]\\]\\n?`), (_m, inner: string) =>
      value.trim() === "" ? "" : inner.replace(`@@${name}@@`, () => value.trim()) + "\n",
    );
  return block(block(template, "BOARD", board), "TASK", task).trimEnd();
}

/** "%s" in a text from ILIAS is replaced by the value (ILIAS removes {…} from language texts). */
function fill(template: string, value: string | number): string {
  return template.replace("%s", String(value));
}

/**
 * The three most used AIs. With prefill the text is passed in the address
 * (?q=…) if it is short enough; long addresses are refused by the services,
 * then the text is only in the clipboard and is pasted by hand.
 */
const AIS: readonly { name: string; url: string; prefill: ((text: string) => string) | null }[] = [
  { name: "ChatGPT", url: "https://chatgpt.com/", prefill: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { name: "Microsoft Copilot", url: "https://copilot.microsoft.com/", prefill: (q) => `https://copilot.microsoft.com/?q=${encodeURIComponent(q)}` },
  { name: "Google Gemini", url: "https://gemini.google.com/app", prefill: null },
];
const MAX_URL_LENGTH = 8000;

/** Copies synchronously (inside the click), so that a new tab can be opened in the same click. */
function copyNow(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  if (!ok) void navigator.clipboard?.writeText(text).catch(() => undefined);
  return true;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback for browsers without clipboard access
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function CommandPanel({ api, config, onClose }: { api: ExcalidrawImperativeAPI; config: BoardConfig; onClose: () => void }) {
  const t = config.texts;
  const [script, setScript] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [aiMenu, setAiMenu] = useState(false);

  /** copy the text, open the AI in a new tab (with the text in the address if possible) */
  const openAi = (ai: (typeof AIS)[number]) => {
    const text = promptForAi();
    copyNow(text);
    const prefilled = ai.prefill ? ai.prefill(text) : null;
    const usePrefill = prefilled !== null && prefilled.length <= MAX_URL_LENGTH;
    window.open(usePrefill ? prefilled : ai.url, "_blank", "noopener");
    setAiMenu(false);
    setProblems([]);
    setMessage(fill(usePrefill ? t.aiOpenedPrefilled : t.aiOpenedPaste, ai.name));
  };

  /** text for an AI with the current board content */
  const promptForAi = () => {
    const elements = api.getSceneElements();
    return aiPrompt(config.aiPrompt ?? "", elements.length === 0 ? "" : exportBoard(elements as never), "");
  };

  const flash = (what: string) => {
    setCopied(what);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const check = () => {
    const result = parse(script);
    setProblems(result.problems);
    setMessage(result.problems.length === 0 ? fill(t.cmdChecked, result.commands.length) : null);
    return result;
  };

  const run = () => {
    const result = check();
    if (result.problems.length > 0 || result.commands.length === 0) return;
    const done = executeCommands(api, result.commands, result.lines);
    setProblems(done.problems);
    setMessage(done.problems.length === 0 ? fill(t.cmdDone, done.done) : null);
  };

  const problemText = problems.map((p) => (p.line > 0 ? `${t.cmdLine} ${p.line}: ${p.message}` : p.message)).join("\n");

  return createPortal(
    <div className="xudw-overlay" role="dialog" aria-modal="true" aria-label={t.cmdTitle} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="xudw-panel">
        <div className="xudw-panel-head">
          <h2>{t.cmdTitle}</h2>
          <button type="button" className="xudw-close" onClick={onClose} aria-label={t.cmdClose}>×</button>
        </div>
        <div className="xudw-panel-body">
          <p>{t.cmdRunInfo}</p>
          {!config.canEdit && <p className="xudw-warning">{t.cmdViewOnly}</p>}
          <textarea
            className="xudw-script"
            value={script}
            placeholder={t.cmdPlaceholder}
            spellCheck={false}
            onChange={(e) => {
              setScript(e.target.value);
              setMessage(null);
            }}
          />
          {problems.length > 0 && (
            <div className="xudw-problems">
              <strong>{t.cmdErrors}</strong>
              <ul>
                {problems.map((p, i) => (
                  <li key={i}>{p.line > 0 ? `${t.cmdLine} ${p.line}: ` : ""}{p.message}</li>
                ))}
              </ul>
              <button type="button" onClick={async () => (await copy(problemText)) && flash("errors")}>
                {copied === "errors" ? t.cmdCopied : t.cmdCopyErrors}
              </button>
            </div>
          )}
          {message && <p className="xudw-ok">{message}</p>}
          <div className="xudw-actions">
            <button type="button" onClick={check}>{t.cmdCheck}</button>
            <button type="button" className="primary" disabled={!config.canEdit || script.trim() === ""} onClick={run}>{t.cmdRun}</button>
            <span className="xudw-spacer" />
            {/* everything an AI needs: the text of templates/ai_prompt_*.txt with the current board */}
            <button
              type="button"
              className="xudw-ai"
              title={t.cmdCopyForAiInfo}
              onClick={async () => {
                if (await copy(promptForAi())) {
                  flash("ai");
                  setProblems([]);
                  setMessage(t.cmdCopyForAiDone);
                }
              }}
            >
              {copied === "ai" ? t.cmdCopied : t.cmdCopyForAi}
            </button>
            <div className="xudw-ai-menu">
              <button type="button" className="xudw-ai" aria-haspopup="menu" aria-expanded={aiMenu} title={t.aiOpenInfo} onClick={() => setAiMenu(!aiMenu)}>
                {t.aiOpen} ▾
              </button>
              {aiMenu && (
                <ul className="xudw-ai-list" role="menu">
                  {AIS.map((ai) => (
                    <li key={ai.name} role="none">
                      <button type="button" role="menuitem" onClick={() => openAi(ai)}>{ai.name}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <details className="xudw-prompt" open={showPrompt} onToggle={(e) => setShowPrompt((e.target as HTMLDetailsElement).open)}>
            <summary>{t.cmdAiPreview}</summary>
            {showPrompt && <pre className="xudw-pre">{promptForAi()}</pre>}
          </details>
          <p className="xudw-hint">{t.cmdAiPrivacy}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
