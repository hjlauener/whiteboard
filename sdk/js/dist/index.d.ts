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
import { type Command, type Problem, type Value } from "./language.ts";
type Params = Record<string, Value | undefined>;
/**
 * Builds a script step by step. Every command of the language is a method:
 * `script.rect({...})`, `script.move(["a", "b"], { dx: 10 })`, `script.undo()`.
 * Commands are checked when added; a mistake throws an error with the reason.
 */
export declare class Script {
    private readonly commands;
    /** Adds a command by name: add("rect", {id: "a"}) or add("move", ["a"], {dx: 5}). */
    add(name: string, targetsOrParams?: string[] | Params, params?: Params): this;
    /** The commands as objects (JSON form). */
    toJSON(): Command[];
    /** The commands as script text, ready to paste into the board. */
    toString(): string;
}
export interface Script {
    [command: string]: unknown;
}
/** Checks a script; returns the problems (empty = fine). */
export declare function validate(script: string): Problem[];
