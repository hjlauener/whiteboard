/**
 * Udon Whiteboard Script – JavaScript/TypeScript library.
 *
 *   import { Script, parse, buildPrompt } from "udon-whiteboard";
 *
 *   const s = new Script();
 *   s.note({ id: "n1", x: 0, y: 0, text: "Idea" });
 *   s.rect({ id: "a", right: "n1", text: "Step 1" });
 *   s.arrow({ from: "n1", to: "a" });
 *   console.log(s.toString());   // paste into the board ("Befehle" → "Ausführen")
 */
export * from "./spec.ts";
export * from "./language.ts";

import { COMMANDS } from "./spec.ts";
import { formatCommand, formatScript, parse, type Command, type Problem, type Value } from "./language.ts";

type Params = Record<string, Value | undefined>;

/**
 * Builds a script step by step. Every command of the language is a method:
 * `script.rect({...})`, `script.move(["a", "b"], { dx: 10 })`, `script.undo()`.
 * Commands are checked when added; a mistake throws an error with the reason.
 */
export class Script {
  private readonly commands: Command[] = [];

  /** Adds a command by name: add("rect", {id: "a"}) or add("move", ["a"], {dx: 5}). */
  add(name: string, targetsOrParams?: string[] | Params, params?: Params): this {
    const targets = Array.isArray(targetsOrParams) ? targetsOrParams : undefined;
    const values = (Array.isArray(targetsOrParams) ? params : targetsOrParams) ?? {};
    const raw: Command = { cmd: name };
    if (targets !== undefined) raw.targets = targets;
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined) raw[k] = v;
    }
    // check by writing and reading it again (same rules as the board)
    const result = parse(formatCommand(raw));
    if (result.problems.length > 0) {
      throw new Error(result.problems.map((p: Problem) => p.message).join("\n"));
    }
    this.commands.push(...result.commands);
    return this;
  }

  /** The commands as objects (JSON form). */
  toJSON(): Command[] {
    return [...this.commands];
  }

  /** The commands as script text, ready to paste into the board. */
  toString(): string {
    return formatScript(this.commands);
  }
}

// one method per command: script.rect(...), script.arrow(...), …
export interface Script {
  [command: string]: unknown;
}
for (const spec of COMMANDS) {
  const name = spec.name;
  if (name in Script.prototype) continue;
  Object.defineProperty(Script.prototype, name, {
    value: function (this: Script, targetsOrParams?: string[] | Params, params?: Params) {
      return this.add(name, targetsOrParams, params);
    },
  });
}

/** Checks a script; returns the problems (empty = fine). */
export function validate(script: string): Problem[] {
  return parse(script).problems;
}
