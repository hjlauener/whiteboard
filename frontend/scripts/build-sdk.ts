/**
 * Builds the libraries in ../sdk from the language specification
 * (sdk/js/src/spec.ts):
 *
 *   sdk/spec/commands.json                 specification as data
 *   sdk/spec/udon-whiteboard-script.schema.json   JSON Schema of the JSON form
 *   sdk/spec/LANGUAGE.md                   reference (Markdown)
 *   sdk/spec/PROMPT.md                     prompt for any AI (without task)
 *   sdk/python/udon_whiteboard/spec.json   specification for the Python library
 *   sdk/js/dist/                           JavaScript + type declarations (tsc)
 *   sdk/mcp/dist/server.mjs                MCP server as one file (esbuild)
 *
 * Run with: ./dev/npm.sh run sdk   (Node with TypeScript type stripping)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COLORS, COMMANDS, LANGUAGE_NAME, LANGUAGE_VERSION, type ParamSpec } from "../../sdk/js/src/spec.ts";
import { buildPrompt, reference } from "../../sdk/js/src/language.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sdk = join(root, "sdk");
const write = (path: string, content: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.endsWith("\n") ? content : content + "\n");
  console.log("written", path.slice(root.length + 1));
};

// 1. specification as data
const spec = { name: LANGUAGE_NAME, version: LANGUAGE_VERSION, colors: COLORS, commands: COMMANDS };
write(join(sdk, "spec", "commands.json"), JSON.stringify(spec, null, 2));
write(join(sdk, "python", "udon_whiteboard", "spec.json"), JSON.stringify(spec, null, 2));

// 2. JSON Schema of the JSON form
const ID = "^[A-Za-z0-9_-]{1,64}$";
function paramSchema(p: ParamSpec): Record<string, unknown> {
  const s: Record<string, unknown> = { description: p.description };
  switch (p.type) {
    case "number":
      s.type = "number";
      if (p.min !== undefined) s.minimum = p.min;
      if (p.max !== undefined) s.maximum = p.max;
      break;
    case "id":
      Object.assign(s, { type: "string", pattern: ID });
      break;
    case "color":
      s.anyOf = [{ enum: Object.keys(COLORS) }, { type: "string", pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" }];
      break;
    case "enum":
      s.enum = p.values;
      break;
    case "boolean":
      s.anyOf = [{ type: "boolean" }, { enum: ["yes", "no"] }];
      break;
    case "points":
      s.anyOf = [
        { type: "string", description: '"x,y x,y …"' },
        { type: "array", minItems: 2, items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } } },
      ];
      break;
    case "string":
      s.type = "string";
      break;
  }
  return s;
}
const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://github.com/hjlauener/whiteboard/sdk/spec/udon-whiteboard-script.schema.json",
  title: `${LANGUAGE_NAME} ${LANGUAGE_VERSION} (JSON form)`,
  description: "A list of commands for the Udon Whiteboard. Paste it into the board under \"Befehle\" → \"Befehle ausführen\".",
  type: "array",
  items: {
    oneOf: COMMANDS.map((c) => {
      const properties: Record<string, unknown> = { cmd: { const: c.name, description: c.description } };
      const required = ["cmd"];
      if (c.targets) {
        properties.targets = {
          type: "array",
          description: c.targets.description,
          minItems: c.targets.min,
          ...(c.targets.max !== undefined ? { maxItems: c.targets.max } : {}),
          items: { type: "string", pattern: c.name === "view" ? `${ID}|^all$` : ID },
        };
        required.push("targets");
      }
      for (const p of c.params) {
        properties[p.name] = paramSchema(p);
        if (p.required) required.push(p.name);
      }
      return { title: c.name, type: "object", properties, required, additionalProperties: false };
    }),
  },
};
write(join(sdk, "spec", "udon-whiteboard-script.schema.json"), JSON.stringify(schema, null, 2));

// 3. reference and prompt as text
write(join(sdk, "spec", "LANGUAGE.md"), reference());
write(join(sdk, "spec", "PROMPT.md"), buildPrompt());
// the Python library builds its prompt from the same parts
const prompt = buildPrompt();
write(join(sdk, "python", "udon_whiteboard", "reference.md"), reference());
write(join(sdk, "python", "udon_whiteboard", "prompt_head.md"), prompt.slice(0, prompt.indexOf("## Task")).trimEnd());

// 4. JavaScript library (tsc) and MCP server (one file, esbuild)
const bin = (name: string) => join(root, "frontend", "node_modules", ".bin", name);
execFileSync(bin("tsc"), ["-p", join(sdk, "js", "tsconfig.json")], { stdio: "inherit" });
console.log("built sdk/js/dist");
execFileSync(
  bin("esbuild"),
  [join(sdk, "mcp", "src", "server.ts"), "--bundle", "--platform=node", "--format=esm", "--target=node18", `--outfile=${join(sdk, "mcp", "dist", "server.mjs")}`, "--log-level=warning"],
  // the packages (MCP SDK, zod) are installed in frontend/node_modules
  { stdio: "inherit", cwd: join(root, "frontend"), env: { ...process.env, NODE_PATH: join(root, "frontend", "node_modules") } },
);
console.log("built sdk/mcp/dist/server.mjs");
