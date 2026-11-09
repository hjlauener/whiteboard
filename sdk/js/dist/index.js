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
export * from "./spec.js";
export * from "./language.js";
import { COMMANDS } from "./spec.js";
import { formatCommand, formatScript, parse } from "./language.js";
/**
 * Builds a script step by step. Every command of the language is a method:
 * `script.rect({...})`, `script.move(["a", "b"], { dx: 10 })`, `script.undo()`.
 * Commands are checked when added; a mistake throws an error with the reason.
 */
export class Script {
    commands = [];
    /** Adds a command by name: add("rect", {id: "a"}) or add("move", ["a"], {dx: 5}). */
    add(name, targetsOrParams, params) {
        const targets = Array.isArray(targetsOrParams) ? targetsOrParams : undefined;
        const values = (Array.isArray(targetsOrParams) ? params : targetsOrParams) ?? {};
        const raw = { cmd: name };
        if (targets !== undefined)
            raw.targets = targets;
        for (const [k, v] of Object.entries(values)) {
            if (v !== undefined)
                raw[k] = v;
        }
        // check by writing and reading it again (same rules as the board)
        const result = parse(formatCommand(raw));
        if (result.problems.length > 0) {
            throw new Error(result.problems.map((p) => p.message).join("\n"));
        }
        this.commands.push(...result.commands);
        return this;
    }
    /** The commands as objects (JSON form). */
    toJSON() {
        return [...this.commands];
    }
    /** The commands as script text, ready to paste into the board. */
    toString() {
        return formatScript(this.commands);
    }
}
for (const spec of COMMANDS) {
    const name = spec.name;
    if (name in Script.prototype)
        continue;
    Object.defineProperty(Script.prototype, name, {
        value: function (targetsOrParams, params) {
            return this.add(name, targetsOrParams, params);
        },
    });
}
/** Checks a script; returns the problems (empty = fine). */
export function validate(script) {
    return parse(script).problems;
}
