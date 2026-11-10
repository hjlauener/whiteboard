import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_PALETTE, PALETTES } from "./palettes.ts";
import { TEMPLATE_TOPICS } from "./templates.ts";
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
      if (!m || !LOCALES.includes(m[1]) || !existsSync(new URL(`./locales/${m[1]}.json`, import.meta.url))) {
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
 * Fifth font size "XXL" (48) after Excalidraw's S/M/L/XL (16/20/28/36): a
 * button in the font size picker and the English text of its tooltip
 * (German and French: locales/*.json). If a new Excalidraw version changes
 * these places, the build stops.
 */
export const HUGE_FONT_SIZE = 48;
/** "XXL" drawn like Excalidraw's "XL" icon (20×20, strokes) */
const XXL_PATH = "M0.8 3.333 5.6 16.667M5.6 3.333 0.8 16.667M7.2 3.333 12 16.667M12 3.333 7.2 16.667M13.6 3.333v13.334h5.2";
function hugeFontSize(): Plugin {
  const prod = /[\\/]@excalidraw[\\/]excalidraw[\\/]dist[\\/]prod[\\/]/;
  const picker = /(\w+)\("legend",\{children:(\w+)\("labels\.fontSize"\)\}\)(.{0,400}?)\{value:36,text:\2\("labels\.veryLarge"\),icon:(\w+),testId:"fontSize-veryLarge"\}\]/;
  let pickerDone = false;
  let englishDone = false;
  return {
    name: "xudw-huge-font-size",
    transform(code, id) {
      if (!prod.test(id)) return null;
      let out = code;
      if (picker.test(out)) {
        out = out.replace(
          picker,
          (_m, jsx, t, between, icon) =>
            `${jsx}("legend",{children:${t}("labels.fontSize")})${between}{value:36,text:${t}("labels.veryLarge"),icon:${icon},testId:"fontSize-veryLarge"},` +
            `{value:${HUGE_FONT_SIZE},text:${t}("labels.xudwHuge"),icon:${jsx}("svg",{"aria-hidden":"true",focusable:"false",role:"img",viewBox:"0 0 20 20",fill:"none",stroke:"currentColor",strokeLinecap:"round",strokeLinejoin:"round",children:${jsx}("path",{d:"${XXL_PATH}",strokeWidth:1.25})}),testId:"fontSize-xxl"}]`,
        );
        pickerDone = true;
      }
      // built-in English texts (the fallback of every language)
      if (!/[\\/]locales[\\/]/.test(id) && out.includes('veryLarge:"Very large"')) {
        out = out.replace('veryLarge:"Very large"', 'veryLarge:"Very large",xudwHuge:"Huge"');
        englishDone = true;
      }
      return out === code ? null : { code: out, map: null };
    },
    buildEnd() {
      if (!pickerDone || !englishDone) {
        this.error(`XXL font size: ${pickerDone ? "" : "font size picker "}${englishDone ? "" : "English text "}not found`);
      }
    },
  };
}

/**
 * Hatching as fine and dense as in Excalidraw with its thinnest line: the
 * board's line widths are 2/4/6 instead of 1/2/4, and Excalidraw derives the
 * hatching from the line width (gap = 4 x width, line = width / 2). Halved
 * here, so that "thin" hatches like Excalidraw's thinnest line.
 */
function fineHatching(): Plugin {
  const rule = /fillWeight:(\w+)\.strokeWidth\/2,hachureGap:\1\.strokeWidth\*4/;
  let done = false;
  return {
    name: "xudw-fine-hatching",
    transform(code, id) {
      if (!/[\\/]@excalidraw[\\/]excalidraw[\\/]dist[\\/]prod[\\/]/.test(id) || !rule.test(code)) return null;
      done = true;
      return { code: code.replace(rule, (_m, e) => `fillWeight:${e}.strokeWidth/4,hachureGap:${e}.strokeWidth*2`), map: null };
    },
    buildEnd() {
      if (!done) this.error("Hatching: rule not found in Excalidraw");
    },
  };
}

/**
 * Hand-drawn hatching on clean shapes: the board draws new shapes with
 * roughness 0 (clean outline), and roughjs then draws the hatching perfectly
 * even. Like in Excalidraw's own look the hatch lines should vary a little
 * (spacing, sometimes a double, thicker line), so the hatching (roughjs
 * patternFillPolygons/patternFillArc) is drawn with roughness at least 1;
 * the outline keeps the roughness of the element. Solid fills are not
 * affected. If a new roughjs version changes this place, the build stops.
 */
function sketchyHatching(): Plugin {
  const file = /[\\/]roughjs[\\/]bin[\\/]renderer\.js$/;
  return {
    name: "xudw-sketchy-hatching",
    transform(code, id) {
      if (!file.test(id)) return null;
      const polygons = "export function patternFillPolygons(polygonList, o) {\n    return getFiller(o, helper).fillPolygons(polygonList, o);";
      if (!code.includes(polygons) || !code.includes("export function patternFillArc(x, y, width, height, start, stop, o) {")) {
        this.error("Hatching: roughjs renderer has changed");
      }
      const out = code
        .replace(polygons, "export function patternFillPolygons(polygonList, o) {\n    o = __xudwHatch(o);\n    return getFiller(o, helper).fillPolygons(polygonList, o);")
        .replace("export function patternFillArc(x, y, width, height, start, stop, o) {", "export function patternFillArc(x, y, width, height, start, stop, o) {\n    o = __xudwHatch(o);")
        + "\nfunction __xudwHatch(o) { return o.roughness < 1 ? Object.assign({}, o, { roughness: 1 }) : o; }\n";
      return { code: out, map: null };
    },
  };
}

/**
 * Excalidraw shows the fill styles (hatched, cross-hatched, solid) only if
 * there is a background colour; the board shows them for every element that
 * can be filled (src/fillMenu.ts sets a colour when a style is chosen and
 * adds the button "Füllung entfernen"). If a new Excalidraw version changes
 * this place, the build stops.
 */
/**
 * Menu "Weitere Werkzeuge" (wish of the client): without "Web-Einbettung"
 * (embedding web pages) and "Laserpointer" (the board has its own laser
 * button; the key K still works), and without the English heading
 * "Generate" above "Mermaid zu Excalidraw". (Excalidraw gives the embedding
 * and the Mermaid entry the same data-testid, so CSS cannot tell them apart.)
 * If a new Excalidraw version changes these places, the build stops.
 */
function slimExtraTools(): Plugin {
  const index = /[\\/]@excalidraw[\\/]excalidraw[\\/]dist[\\/]prod[\\/]index\.js$/;
  const remove: [string, RegExp][] = [
    ["Web-Einbettung", /\w+\(\w+\.Item,\{onSelect:\(\)=>\w+\.setActiveTool\(\{type:"embeddable"\}\),icon:\w+,"data-testid":"toolbar-embeddable",selected:\w+,children:\w+\("toolBar\.embeddable"\)\}\),/],
    ["Laserpointer", /\w+\(\w+\.Item,\{onSelect:\(\)=>\w+\.setActiveTool\(\{type:"laser"\}\),icon:\w+,"data-testid":"toolbar-laser",selected:\w+,shortcut:\w+\.K\.toLocaleUpperCase\(\),children:\w+\("toolBar\.laser"\)\}\),/],
    ["Generate", /\w+\("div",\{style:\{margin:"6px 0",fontSize:14,fontWeight:600\},children:"Generate"\}\),/],
  ];
  return {
    name: "xudw-slim-extra-tools",
    transform(code, id) {
      if (!index.test(id)) return null;
      let out = code;
      for (const [what, pattern] of remove) {
        const found = (out.match(new RegExp(pattern.source, "g")) ?? []).length;
        if (found !== 1) this.error(`Extra tools: "${what}" found ${found} times instead of once`);
        out = out.replace(pattern, "");
      }
      return { code: out, map: null };
    },
  };
}

function alwaysShowFill(): Plugin {
  const index = /[\\/]@excalidraw[\\/]excalidraw[\\/]dist[\\/]prod[\\/]index\.js$/;
  const rule = /(\w+)=(\w+)\((\w+)\.activeTool\.type\)&&!(\w+)\(\3\.currentItemBackgroundColor\)\|\|(\w+)\.some\((\w+)=>\2\(\6\.type\)&&!\4\(\6\.backgroundColor\)\)/;
  return {
    name: "xudw-always-show-fill",
    transform(code, id) {
      if (!index.test(id)) return null;
      if (!rule.test(code)) this.error("Fill styles: rule not found in Excalidraw");
      return { code: code.replace(rule, (_m, v, has, s, _t, els, e) => `${v}=${has}(${s}.activeTool.type)||${els}.some(${e}=>${has}(${e}.type))`), map: null };
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

/**
 * Defaults of the board that Excalidraw does not let configure:
 * - colour palette and quick picks: one of the four palettes of palettes.ts
 *   instead of Open Color. All four are built in; the board takes the one
 *   of data-config.palette (the div is there before the module runs, module
 *   scripts are deferred). The build also writes palettes.json for the
 *   settings form.
 * - line widths: 2 / 4 / 6 instead of 1 / 2 / 4 (start with the former
 *   middle one, then thicker)
 * If a new Excalidraw version changes these places, the build stops.
 */
function boardDefaults(): Plugin {
  const chunk = /[\\/]@excalidraw[\\/]excalidraw[\\/]dist[\\/]prod[\\/]chunk-[A-Z0-9]+\.js$/;
  const pick =
    `var __xudwPal=(function(){var P=${JSON.stringify(PALETTES)},d=${JSON.stringify(DEFAULT_PALETTE)},n=d;` +
    `try{var e=document.querySelector(".xudw-board");if(e){n=JSON.parse(e.dataset.config||"null").palette||d;}}catch(x){}` +
    `return P[n]||P[d];})();\n`;
  const families = 'Object.assign({transparent:"transparent",white:"#ffffff"},__xudwPal.families)';
  let patched = false;
  return {
    name: "xudw-board-defaults",
    generateBundle() {
      if (!patched) {
        this.error("Board defaults: Excalidraw chunk with the palettes not found");
      }
      this.emitFile({ type: "asset", fileName: "palettes.json", source: JSON.stringify({ default: DEFAULT_PALETTE, palettes: PALETTES }, null, 1) });
      // list of the templates for the plugin configuration (ilUdwTemplates)
      this.emitFile({ type: "asset", fileName: "templates.json", source: JSON.stringify(TEMPLATE_TOPICS, null, 1) });
    },
    transform(code, id) {
      if (!chunk.test(id) || !code.includes("extraBold:4}")) {
        return null;
      }
      const replace = (out: string, pattern: RegExp, replacer: (...m: string[]) => string, what: string, times: number): string => {
        const count = (out.match(new RegExp(pattern.source, "g")) ?? []).length;
        if (count !== times) {
          this.error(`Board defaults: ${what} found ${count} times instead of ${times}`);
        }
        return out.replace(new RegExp(pattern.source, "g"), replacer as never);
      };
      let out = code;
      out = replace(out, /(\w+)=\{thin:1,bold:2,extraBold:4\}/, (_m, v) => `${v}={thin:2,bold:4,extraBold:6}`, "line widths", 1);
      out = replace(
        out,
        /(\w+)=\[(\w+)\.black,\2\.red\[\w+\],\2\.green\[\w+\],\2\.blue\[\w+\],\2\.yellow\[\w+\]\]/,
        (_m, v) => `${v}=__xudwPal.stroke`,
        "stroke picks",
        1,
      );
      out = replace(
        out,
        /(\w+)=\[(\w+)\.transparent,\2\.red\[\w+\],\2\.green\[\w+\],\2\.blue\[\w+\],\2\.yellow\[\w+\]\]/,
        (_m, v) => `${v}=__xudwPal.background`,
        "background picks",
        1,
      );
      out = replace(
        out,
        /(\w+)=\{transparent:(\w+)\.transparent,white:\2\.white,gray:\2\.gray,black:\2\.black,bronze:\2\.bronze,\.\.\.\w+\}/,
        (_m, v) => `${v}=${families}`,
        "element palettes",
        2,
      );
      patched = true;
      return { code: pick + out, map: null };
    },
  };
}

// Builds the whiteboard as ES module into ../js/dist:
//   whiteboard.js   entry, loaded by ILIAS with <script type="module">
//   whiteboard.css  styles of Excalidraw
//   chunks/         parts loaded on demand (languages, export, ...)
export default defineConfig({
  plugins: [excalidrawLocales(), serifFont(), boardDefaults(), hugeFontSize(), alwaysShowFill(), slimExtraTools(), fineHatching(), sketchyHatching(), react()],
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
