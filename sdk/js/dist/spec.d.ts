/**
 * Udon Whiteboard command language – the single source of truth.
 *
 * Everything else is derived from this list: the parser and validator, the
 * reference in the board, the prompt for AIs, the JSON schema, the Python
 * library and the MCP server. The descriptions are in English on purpose:
 * they are read by AIs of any kind.
 *
 * Script syntax (one command per line):
 *
 *   command [target ids…] key=value key="text with spaces" …
 *   # comment
 *
 * JSON syntax (same commands): [{"cmd": "rect", "id": "a", "x": 0, …}, …]
 * with "targets": ["a", "b"] for the positional ids.
 */
export declare const LANGUAGE_NAME = "Udon Whiteboard Script";
export declare const LANGUAGE_VERSION = "1.0";
export type ParamType = "id" | "number" | "string" | "color" | "enum" | "points" | "boolean";
export interface ParamSpec {
    name: string;
    type: ParamType;
    description: string;
    values?: readonly string[];
    required?: boolean;
    min?: number;
    max?: number;
}
export type Category = "create" | "change" | "arrange" | "view";
export interface CommandSpec {
    name: string;
    category: Category;
    description: string;
    /** positional element ids before the key=value pairs */
    targets?: {
        min: number;
        max?: number;
        description: string;
    };
    params: readonly ParamSpec[];
    examples: readonly string[];
}
export declare const COLORS: Readonly<Record<string, string>>;
export declare const COMMANDS: readonly CommandSpec[];
export declare const COMMAND_MAP: ReadonlyMap<string, CommandSpec>;
