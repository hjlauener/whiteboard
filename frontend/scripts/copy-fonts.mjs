// Copies the fonts of Excalidraw to ../js/dist/fonts so that they are loaded
// from ILIAS itself and not from a CDN. "Xiaolai" (Chinese, Japanese,
// Korean characters, 12 MB) is left out; for such characters Excalidraw falls
// back to its CDN.
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const src = "node_modules/@excalidraw/excalidraw/dist/prod/fonts";
const dst = "../js/dist/fonts";
for (const name of readdirSync(src)) {
  if (name === "Xiaolai") continue;
  cpSync(join(src, name), join(dst, name), { recursive: true });
}
console.log("fonts copied to", dst);

// serif font Source Serif 4 (OFL), see vite.config.ts
const serif = "node_modules/@fontsource/source-serif-4";
mkdirSync(join(dst, "SourceSerif"), { recursive: true });
for (const file of ["source-serif-4-latin-400-normal.woff2", "source-serif-4-latin-ext-400-normal.woff2"]) {
  cpSync(join(serif, "files", file), join(dst, "SourceSerif", file));
}
cpSync(join(serif, "LICENSE"), join(dst, "SourceSerif", "LICENSE.txt"));
console.log("Source Serif copied");

// shape libraries (libraries.excalidraw.com, MIT), see src/shapes/ShapesSidebar.tsx
// emptied first, so that removed libraries do not stay in js/dist
rmSync("../js/dist/libraries", { recursive: true, force: true });
mkdirSync("../js/dist/libraries", { recursive: true });
for (const file of readdirSync("libraries")) {
  cpSync(join("libraries", file), join("../js/dist/libraries", file));
}
console.log("shape libraries copied");
