// Copies the fonts of Excalidraw to ../js/dist/fonts so that they are loaded
// from ILIAS itself and not from a CDN. "Xiaolai" (Chinese, Japanese,
// Korean characters, 12 MB) is left out; for such characters Excalidraw falls
// back to its CDN.
import { cpSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = "node_modules/@excalidraw/excalidraw/dist/prod/fonts";
const dst = "../js/dist/fonts";
for (const name of readdirSync(src)) {
  if (name === "Xiaolai") continue;
  cpSync(join(src, name), join(dst, name), { recursive: true });
}
console.log("fonts copied to", dst);
