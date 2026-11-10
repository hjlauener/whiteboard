/**
 * Dialog "Mermaid zu Excalidraw" (Excalidraw's text-to-diagram dialog):
 * button "Neu laden" in the header of the Mermaid input. It fills in the next
 * of the didactic examples (templates/mermaid_examples_<lang>.txt, sent in
 * data-config) and shows its title. Excalidraw's English default example
 * ("Christmas") is replaced by the first one; text written by the person
 * stays until "Neu laden" is clicked.
 *
 * The dialog is Excalidraw's own React component: it is found in the page
 * (MutationObserver) and its controlled textarea is set like typing (native
 * setter + input event), so that Excalidraw updates the preview.
 */
import type { BoardConfig } from "./types";

interface MermaidExample {
  title: string;
  code: string;
}

/** marker of Excalidraw's built-in example (0.18) */
const EXCALIDRAW_DEFAULT = "A[Christmas]";

function decode(data: string): MermaidExample[] {
  if (!data) return [];
  try {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const list = JSON.parse(new TextDecoder().decode(bytes)) as MermaidExample[];
    return Array.isArray(list) ? list.filter((e) => e && typeof e.code === "string" && e.code !== "") : [];
  } catch {
    return [];
  }
}

function setTextarea(input: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const format = (text: string, ...args: (string | number)[]): string => args.reduce<string>((s, a) => s.replace("%s", String(a)), text);

export function installMermaidExamples(config: BoardConfig): () => void {
  const examples = decode(config.mermaidExamples);
  if (examples.length === 0) return () => {};
  const t = config.texts;
  // stays while the page is open: reopening the dialog continues with the next example
  let index = -1;

  const attach = (): void => {
    const dialog = document.querySelector<HTMLElement>(".ttd-dialog");
    if (!dialog || dialog.querySelector(".xudw-mermaid-next")) return;
    const input = dialog.querySelector<HTMLTextAreaElement>("textarea.ttd-dialog-input");
    const header = input?.closest(".ttd-dialog-panel")?.querySelector<HTMLElement>(".ttd-dialog-panel__header");
    if (!input || !header) return;

    input.placeholder = t.mermaidPlaceholder;
    const bar = document.createElement("div");
    bar.className = "xudw-mermaid-bar";
    const label = document.createElement("span");
    label.className = "xudw-mermaid-example";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "xudw-mermaid-next";
    button.title = t.mermaidNextTitle;
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    button.append(document.createTextNode(t.mermaidNext));

    const show = (i: number): void => {
      index = i;
      const example = examples[i];
      setTextarea(input, example.code);
      label.textContent = format(t.mermaidExample, i + 1, examples.length, example.title);
      input.focus();
    };
    button.addEventListener("click", () => show((index + 1) % examples.length));

    bar.append(label, button);
    header.append(bar);
    if (input.value.includes(EXCALIDRAW_DEFAULT)) {
      show(index < 0 ? 0 : index);
    } else if (index >= 0 && input.value.trim() === examples[index].code.trim()) {
      label.textContent = format(t.mermaidExample, index + 1, examples.length, examples[index].title);
    }
  };

  const observer = new MutationObserver(attach);
  observer.observe(document.body, { childList: true, subtree: true });
  attach();
  return () => observer.disconnect();
}
