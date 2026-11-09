import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Languages of the board: like the plugin (German, English, French). */
const LOCALES = ["de-DE", "en", "fr-FR"];

/**
 * Excalidraw ships about 55 languages as separate files. Only German, English
 * and French are built; the others become empty (Excalidraw falls back to
 * English). German is written in Swiss spelling (ss instead of ß).
 *
 * locales/<lang>.json supplements Excalidraw's translation: texts that are
 * missing there (they would appear in English) and German texts with "Sie"
 * instead of "du". They are merged into the language file when building.
 */
function excalidrawLocales(): Plugin {
  const locale = /[\\/]@excalidraw[\\/]excalidraw[\\/]dist[\\/]prod[\\/]locales[\\/]([A-Za-z-]+?)-[A-Z0-9]{8}\.js$/;
  return {
    name: "xudw-excalidraw-locales",
    load(id) {
      const m = locale.exec(id);
      if (m && !LOCALES.includes(m[1])) {
        return "export default {};";
      }
      return null;
    },
    transform(code, id) {
      const m = locale.exec(id);
      if (!m || !LOCALES.includes(m[1]) || m[1] === "en") {
        return null;
      }
      const lang = m[1];
      // export{a as labels,b as search,...,X as default}: Excalidraw reads the named exports
      const exportAt = code.lastIndexOf("export{");
      const close = code.indexOf("}", exportAt);
      if (exportAt < 0 || close < 0) {
        this.error(`Excalidraw language file ${lang}: export not found`);
      }
      const names = new Map<string, string>();
      for (const part of code.slice(exportAt + 7, close).split(",")) {
        const [local, exported] = part.trim().split(/\s+as\s+/);
        names.set(exported ?? local, local);
      }
      const extra = JSON.parse(readFileSync(new URL(`./locales/${lang}.json`, import.meta.url), "utf-8")) as Record<string, unknown>;
      let merge = "var __xudwMerge=function m(t,s){for(var k in s){if(s[k]&&typeof s[k]==='object'){t[k]=t[k]||{};m(t[k],s[k]);}else{t[k]=s[k];}}return t;};\n";
      const added: string[] = [];
      for (const [section, values] of Object.entries(extra)) {
        const local = names.get(section);
        if (local !== undefined) {
          merge += `__xudwMerge(${local},${JSON.stringify(values)});\n`;
          if (names.has("default")) {
            merge += `${names.get("default")}[${JSON.stringify(section)}]=${local};\n`;
          }
        } else {
          const v = `__xudw_${section}`;
          merge += `var ${v}=${JSON.stringify(values)};\n`;
          if (names.has("default")) {
            merge += `${names.get("default")}[${JSON.stringify(section)}]=${v};\n`;
          }
          added.push(`${v} as ${section}`);
        }
      }
      const exportClause = code.slice(exportAt, close) + (added.length > 0 ? "," + added.join(",") : "") + code.slice(close);
      let out = code.slice(0, exportAt) + merge + exportClause;
      if (lang === "de-DE") {
        out = out.replace(/\\xDF/g, "ss").replace(/ß/g, "ss");
      }
      return { code: out, map: null };
    },
  };
}

/**
 * Adds the serif font "Source Serif" (Source Serif 4, Adobe, OFL) to the fonts
 * of Excalidraw. Excalidraw has a fixed list of fonts (number, metrics, font
 * files); the font is added to these three places in its code. The metrics are
 * those of Source Serif 4 (measured in the browser). If a new Excalidraw
 * version changes the code, the build stops with an error.
 */
export const SERIF_FONT = { name: "Source Serif", id: 10 };
const SERIF_METRICS = "unitsPerEm:1e3,ascender:1036,descender:-335,lineHeight:1.35";

function serifFont(): Plugin {
  const chunk = /[\\/]@excalidraw[\\/]excalidraw[\\/]dist[\\/]prod[\\/]chunk-[A-Z0-9]+\.js$/;
  return {
    name: "xudw-serif-font",
    transform(code, id) {
      // font picker: names without quotes ("Lilita One" -> Lilita One)
      const picker = /text:(\w+)\[0\]\?\.fontFace\?\.family\?\?"Unknown"/;
      if (/[\\/]@excalidraw[\\/]excalidraw[\\/]dist[\\/]prod[\\/]/.test(id) && picker.test(code)) {
        code = code.replace(picker, (_m, faces) => `text:(${faces}[0]?.fontFace?.family??"Unknown").replace(/"/g,"")`);
        if (!chunk.test(id) || !code.includes('"Liberation Sans":9}')) {
          return { code, map: null };
        }
      }
      if (!chunk.test(id) || !code.includes('"Liberation Sans":9}')) {
        return null;
      }
      const replaceOnce = (out: string, pattern: RegExp, replacer: (...m: string[]) => string, what: string): string => {
        const matches = out.match(new RegExp(pattern.source, "g")) ?? [];
        if (matches.length !== 1) {
          this.error(`Serif font: ${what} found ${matches.length} times instead of once`);
        }
        return out.replace(pattern, replacer as never);
      };
      const ranges = /(\w+)=\{LATIN:"U\+0000-00FF/.exec(code);
      if (ranges === null) {
        this.error("Serif font: unicode ranges not found");
      }
      const name = JSON.stringify(SERIF_FONT.name);
      let out = replaceOnce(code, /"Liberation Sans":9\}/, () => `"Liberation Sans":9,${name}:${SERIF_FONT.id}}`, "font list");
      out = replaceOnce(
        out,
        /\[(\w+)\.Nunito\]:\{metrics:\{[^}]*\},icon:(\w+)\}/,
        (m, fonts, icon) => `${m},[${fonts}[${name}]]:{metrics:{${SERIF_METRICS}},icon:${icon}}`,
        "font metrics",
      );
      out = replaceOnce(
        out,
        /(\w+)\("Nunito",\.\.\.(\w+)\)/,
        (m, register) =>
          `${m},${register}(${name},` +
          `{uri:"./fonts/SourceSerif/source-serif-4-latin-ext-400-normal.woff2",descriptors:{unicodeRange:${ranges![1]}.LATIN_EXT}},` +
          `{uri:"./fonts/SourceSerif/source-serif-4-latin-400-normal.woff2",descriptors:{unicodeRange:${ranges![1]}.LATIN}})`,
        "font registration",
      );
      return { code: out, map: null };
    },
  };
}

// Builds the whiteboard as ES module into ../js/dist:
//   whiteboard.js   entry, loaded by ILIAS with <script type="module">
//   whiteboard.css  styles of Excalidraw
//   chunks/         parts loaded on demand (languages, export, ...)
export default defineConfig({
  plugins: [excalidrawLocales(), serifFont(), react()],
  base: "./",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.IS_PREACT": JSON.stringify("false"),
  },
  build: {
    outDir: "../js/dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: "src/main.tsx",
      preserveEntrySignatures: "strict",
      output: {
        entryFileNames: "whiteboard.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (info) =>
          (info.names ?? []).some((n) => n.endsWith(".css")) ? "whiteboard.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
});
