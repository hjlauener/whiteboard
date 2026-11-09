/**
 * Overlay "Befehle": run commands, work with any AI (guide + prompt),
 * reference of the language. Texts come from the ILIAS language files
 * (config.texts); the language itself, its reference and the prompt are in
 * English because they are read by AIs.
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { buildPrompt, parse, reference, type Problem } from "../../../sdk/js/src/language.ts";
import { executeCommands } from "./execute.ts";
import { exportBoard } from "./export.ts";
import type { BoardConfig } from "../types.ts";

type Tab = "run" | "ai" | "reference";

const EXAMPLE = `note id=topic x=0 y=0 text="Topic"
rect id=a below=topic text="First point"
rect id=b right=a text="Second point"
arrow from=topic to=a
arrow from=topic to=b`;

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
  const [tab, setTab] = useState<Tab>("run");
  const [script, setScript] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [withBoard, setWithBoard] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const boardScript = () => {
    const elements = api.getSceneElements();
    return elements.length === 0 ? "" : exportBoard(elements as never);
  };
  const prompt = useMemo(
    () => aiPrompt(config.aiPrompt ?? "", withBoard ? boardScript() : "", task),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task, withBoard, api, tab, config.aiPrompt],
  );
  const referenceText = useMemo(() => reference(), []);

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
        <div className="xudw-tabs" role="tablist">
          {(["run", "ai", "reference"] as Tab[]).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {id === "run" ? t.cmdTabRun : id === "ai" ? t.cmdTabAi : t.cmdTabReference}
            </button>
          ))}
        </div>

        {tab === "run" && (
          <div className="xudw-panel-body">
            <p>{t.cmdRunInfo}</p>
            {!config.canEdit && <p className="xudw-warning">{t.cmdViewOnly}</p>}
            <textarea
              className="xudw-script"
              value={script}
              placeholder={EXAMPLE}
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
              {/* everything an AI needs: rules, reference, current board; the task follows in the AI chat */}
              <button
                type="button"
                className="xudw-ai"
                title={t.cmdCopyForAiInfo}
                onClick={async () => {
                  if (await copy(aiPrompt(config.aiPrompt ?? "", boardScript(), ""))) {
                    flash("ai");
                    setProblems([]);
                    setMessage(t.cmdCopyForAiDone);
                  }
                }}
              >
                {copied === "ai" ? t.cmdCopied : t.cmdCopyForAi}
              </button>
            </div>
          </div>
        )}

        {tab === "ai" && (
          <div className="xudw-panel-body">
            <ol className="xudw-steps">
              <li>{t.cmdAiStep1}</li>
              <li>{t.cmdAiStep2}</li>
              <li>{t.cmdAiStep3}</li>
              <li>{t.cmdAiStep4}</li>
            </ol>
            <label className="xudw-label" htmlFor="xudw-task">{t.cmdAiTask}</label>
            <textarea id="xudw-task" className="xudw-task" value={task} placeholder={t.cmdAiTaskPlaceholder} onChange={(e) => setTask(e.target.value)} />
            <label className="xudw-check">
              <input type="checkbox" checked={withBoard} onChange={(e) => setWithBoard(e.target.checked)} /> {t.cmdAiWithBoard}
            </label>
            <div className="xudw-actions">
              <button type="button" className="primary" onClick={async () => (await copy(prompt)) && flash("prompt")}>
                {copied === "prompt" ? t.cmdCopied : t.cmdAiCopyPrompt}
              </button>
              <button type="button" onClick={() => setTab("run")}>{t.cmdAiGoRun}</button>
            </div>
            <p className="xudw-hint">{t.cmdAiTip}</p>
            <p className="xudw-hint">{t.cmdAiPrivacy}</p>
            <details>
              <summary>{t.cmdAiPreview}</summary>
              <pre className="xudw-pre">{prompt}</pre>
            </details>
          </div>
        )}

        {tab === "reference" && (
          <div className="xudw-panel-body">
            <p>{t.cmdRefInfo}</p>
            <p className="xudw-hint">{t.cmdRefLibraries}</p>
            <div className="xudw-actions">
              <button type="button" onClick={async () => (await copy(referenceText)) && flash("ref")}>
                {copied === "ref" ? t.cmdCopied : t.cmdRefCopy}
              </button>
            </div>
            <pre className="xudw-pre">{referenceText}</pre>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
