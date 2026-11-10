/**
 * Checks the templates (run with node, see CLAUDE.md):
 * - every template of templates.ts is drawn in src/templates/catalog.ts;
 * - every text a template uses is in all three language files;
 * - the commands of every template are valid Udon Whiteboard Script
 *   (written as script and read back with the parser of the language).
 */
import { readFileSync } from "node:fs";
import { TEMPLATE_TOPICS } from "../templates.ts";
import { TEMPLATES } from "../src/templates/catalog.ts";
import { Builder, type Colors } from "../src/templates/builder.ts";
import { formatScript, parse } from "../../sdk/js/src/language.ts";

const root = new URL("../../", import.meta.url);
const langKeys = (lang: string) =>
  new Set(
    readFileSync(new URL(`lang/ilias_${lang}.lang`, root), "utf-8")
      .split("\n")
      .filter((l) => l.includes("#:#"))
      .map((l) => l.split("#:#")[0]),
  );
const langs = { de: langKeys("de"), en: langKeys("en"), fr: langKeys("fr") };

const colors: Colors = { ink: "#000000", muted: "#555555", yellow: "#fff3bf", blue: "#d0ebff", green: "#d3f9d8", red: "#ffe3e3", purple: "#e5dbff", orange: "#ffe8cc", grey: "#f1f3f5" };
const errors: string[] = [];
let count = 0;

for (const topic of TEMPLATE_TOPICS) {
  for (const key of [`tplcat_${topic.id}`]) {
    for (const [lang, keys] of Object.entries(langs)) if (!keys.has(key)) errors.push(`${lang}: ${key} missing`);
  }
  for (const id of topic.templates) {
    count++;
    const draw = TEMPLATES[id];
    if (!draw) {
      errors.push(`${id}: not in catalog.ts`);
      continue;
    }
    for (const key of [`tpl_${id}`, `tpl_${id}_info`]) {
      for (const [lang, keys] of Object.entries(langs)) if (!keys.has(key)) errors.push(`${lang}: ${key} missing`);
    }
    const used = new Set<string>();
    const t = (k: string) => (used.add(`tplt_${id}_${k}`), `text ${k}`);
    const tc = (k: string) => (used.add(`tplt_common_${k}`), `text ${k}`);
    const b = new Builder("x", colors);
    draw(b, t, tc);
    for (const key of used) {
      for (const [lang, keys] of Object.entries(langs)) if (!keys.has(key)) errors.push(`${lang}: ${key} missing`);
    }
    const result = parse(formatScript(b.commands));
    for (const p of result.problems) errors.push(`${id}: line ${p.line}: ${p.message}`);
    if (result.commands.length !== b.commands.length) errors.push(`${id}: ${b.commands.length} commands written, ${result.commands.length} read`);
  }
}
for (const id of Object.keys(TEMPLATES)) {
  if (!TEMPLATE_TOPICS.some((t) => t.templates.includes(id))) errors.push(`${id}: in catalog.ts but in no topic`);
}

if (errors.length > 0) {
  console.log(errors.join("\n"));
  process.exit(1);
}
console.log(`${count} templates OK`);
