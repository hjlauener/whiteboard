/**
 * MCP server for Udon Whiteboard Script.
 *
 * Gives AI programs (Claude, ChatGPT, IDE assistants, …) the command language
 * of the Udon Whiteboard as tools. The board itself is not reachable from
 * outside: the AI writes and checks a script, the user pastes it into the
 * board ("Befehle" → "Befehle ausführen").
 *
 * Start: node sdk/mcp/dist/server.mjs   (stdio transport)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildPrompt, formatScript, LANGUAGE_NAME, LANGUAGE_VERSION, parse, reference, type Command } from "../../js/src/index.ts";

const PASTE_HINT =
  'The board cannot be reached from here: give the script to the user, who pastes it into the board under "Befehle" → "Befehle ausführen" and clicks "Ausführen".';

const server = new McpServer(
  { name: "udon-whiteboard", version: LANGUAGE_VERSION },
  {
    instructions: `Tools for "${LANGUAGE_NAME}", the command language of the Udon Whiteboard (an ILIAS plugin). Read the language with whiteboard_language, write a script, check it with whiteboard_validate. ${PASTE_HINT}`,
  },
);

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

server.registerTool(
  "whiteboard_language",
  {
    title: "Language reference",
    description: `Returns the reference of ${LANGUAGE_NAME}: all commands, parameters, colours and examples. Read it before writing a script.`,
  },
  async () => text(reference()),
);

server.registerTool(
  "whiteboard_validate",
  {
    title: "Check a script",
    description: "Checks a script (one command per line, or JSON) against the language. Returns the problems with line numbers, or the normalised script if it is valid.",
    inputSchema: { script: z.string().describe("The script to check.") },
  },
  async ({ script }) => {
    const result = parse(script);
    if (result.problems.length > 0) {
      return { ...text(result.problems.map((p) => (p.line > 0 ? `Line ${p.line}: ${p.message}` : p.message)).join("\n")), isError: true };
    }
    return text(`Valid: ${result.commands.length} command(s).\n${PASTE_HINT}\n\n\`\`\`udon\n${formatScript(result.commands)}\n\`\`\``);
  },
);

server.registerTool(
  "whiteboard_from_json",
  {
    title: "Write a script from JSON",
    description: 'Turns commands given as JSON objects ({"cmd": "rect", "id": "a", "x": 0, …}; positional ids as "targets") into a checked script.',
    inputSchema: {
      commands: z.array(z.record(z.string(), z.unknown())).describe("Commands as objects with a cmd field."),
    },
  },
  async ({ commands }) => {
    const result = parse(JSON.stringify(commands as Command[]));
    if (result.problems.length > 0) {
      return { ...text(result.problems.map((p) => `Command ${p.line}: ${p.message}`).join("\n")), isError: true };
    }
    return text(`${PASTE_HINT}\n\n\`\`\`udon\n${formatScript(result.commands)}\n\`\`\``);
  },
);

server.registerTool(
  "whiteboard_prompt",
  {
    title: "Prompt for another AI",
    description: "Builds the complete prompt (rules, reference, optional current board, task) that makes any AI answer with valid commands.",
    inputSchema: {
      task: z.string().describe("What should be drawn or changed, in the user's words."),
      board: z.string().optional().describe('Current board as script (from "Board als Befehle kopieren"), if existing elements should be changed.'),
    },
  },
  async ({ task, board }) => text(buildPrompt({ task, board })),
);

server.registerPrompt(
  "draw_on_whiteboard",
  {
    title: "Draw on the Udon Whiteboard",
    description: "Write a whiteboard script for a task.",
    argsSchema: {
      task: z.string().describe("What should be drawn or changed."),
      board: z.string().optional().describe("Current board as script (optional)."),
    },
  },
  ({ task, board }) => ({
    messages: [{ role: "user" as const, content: { type: "text" as const, text: buildPrompt({ task, board }) } }],
  }),
);

server.registerResource(
  "language",
  "udon-whiteboard://language",
  { title: `${LANGUAGE_NAME} reference`, mimeType: "text/markdown" },
  async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: reference() }] }),
);

await server.connect(new StdioServerTransport());
