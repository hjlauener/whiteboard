export type Value = string | number | boolean | [number, number][];
/** One command. `targets` are the positional ids. */
export interface Command {
    cmd: string;
    targets?: string[];
    [param: string]: Value | string[] | undefined;
}
export interface Problem {
    /** 1-based line in the script (0 for JSON input without lines) */
    line: number;
    message: string;
}
export interface ParseResult {
    commands: Command[];
    /** line of each command in the script */
    lines: number[];
    problems: Problem[];
}
/**
 * Parses a script (one command per line) or JSON (an array of command
 * objects, or {"commands": [...]}). Values are converted to their types and
 * checked against the specification.
 */
export declare function parse(input: string): ParseResult;
/** Writes one command as a script line. */
export declare function formatCommand(c: Command): string;
/** Writes commands as a script. */
export declare function formatScript(commands: readonly Command[]): string;
/** The language reference as Markdown (for people and AIs). */
export declare function reference(): string;
export interface PromptOptions {
    /** what the AI should do, in the words of the user (any language) */
    task?: string;
    /** current board content as script (from the board's export) */
    board?: string;
}
/** The prompt that makes any AI answer with valid commands. */
export declare function buildPrompt(options?: PromptOptions): string;
