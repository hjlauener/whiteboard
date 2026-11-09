/**
 * Writes the board as Udon Whiteboard Script: the context for an AI, so that
 * it can change existing elements by their ids.
 */
import { FONT_FAMILY } from "@excalidraw/excalidraw";
import { COLORS } from "../../../sdk/js/src/spec.ts";
import { formatScript, type Command } from "../../../sdk/js/src/language.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type El = Record<string, any>;

const SERIF = (FONT_FAMILY as Record<string, number>)["Source Serif"] ?? FONT_FAMILY.Nunito;
const FONT_NAMES = new Map<number, string>([
  [SERIF, "serif"],
  [FONT_FAMILY.Nunito, "sans"],
  [FONT_FAMILY.Excalifont, "hand"],
  [FONT_FAMILY.Virgil, "hand"],
  [FONT_FAMILY["Comic Shanns"], "code"],
  [FONT_FAMILY.Cascadia, "code"],
]);
const COLOR_NAMES = new Map(Object.entries(COLORS).map(([name, hex]) => [hex, name]));

const round = (n: number) => Math.round(n);
const color = (hex: string) => COLOR_NAMES.get(hex.toLowerCase()) ?? hex;

function size(fontSize: number): string {
  if (fontSize <= 18) return "S";
  if (fontSize <= 24) return "M";
  if (fontSize <= 32) return "L";
  return "XL";
}

function width(strokeWidth: number): string {
  if (strokeWidth <= 1) return "thin";
  if (strokeWidth <= 2.5) return "bold";
  return "extra";
}

function styleOf(el: El, c: Command): void {
  if (el.strokeColor && el.strokeColor !== "#1e1e1e") c.stroke = color(el.strokeColor);
  if (el.backgroundColor && el.backgroundColor !== "transparent" && "fill" in c === false) c.fill = color(el.backgroundColor);
  if (el.fillStyle && el.fillStyle !== "solid" && el.backgroundColor !== "transparent") c.fillstyle = el.fillStyle;
  if (el.strokeWidth !== undefined && el.strokeWidth !== 2) c.width = width(el.strokeWidth);
  if (el.strokeStyle && el.strokeStyle !== "solid") c.linestyle = el.strokeStyle;
  if (el.roughness) c.rough = String(el.roughness);
  if (el.opacity !== undefined && el.opacity !== 100) c.opacity = el.opacity;
}

function fontOf(text: El, c: Command, defaultAlign: string): void {
  const family = FONT_NAMES.get(text.fontFamily);
  if (family && family !== "serif") c.font = family;
  if (text.fontSize && size(text.fontSize) !== "M") c.size = size(text.fontSize);
  if (text.textAlign && text.textAlign !== defaultAlign) c.align = text.textAlign;
}

export function exportBoard(elements: readonly El[]): string {
  const alive = elements.filter((e) => !e.isDeleted);
  const byId = new Map(alive.map((e) => [e.id, e]));
  const textOf = (el: El): El | undefined => {
    const ref = (el.boundElements ?? []).find((b: El) => b.type === "text");
    return ref ? byId.get(ref.id) : undefined;
  };

  const commands: Command[] = [];
  const extra: Command[] = [];

  for (const el of alive) {
    if (el.type === "text" && el.containerId && byId.has(el.containerId)) continue; // part of its container
    const c: Command = { cmd: "rect" };
    switch (el.type) {
      case "rectangle":
      case "ellipse":
      case "diamond": {
        c.cmd = el.type === "rectangle" ? "rect" : el.type;
        Object.assign(c, { id: el.id, x: round(el.x), y: round(el.y), w: round(el.width), h: round(el.height) });
        const text = textOf(el);
        if (text) c.text = text.originalText ?? text.text;
        styleOf(el, c);
        if (el.type === "rectangle" && !el.roundness) c.round = false;
        if (text) fontOf(text, c, "center");
        break;
      }
      case "text":
        Object.assign(c, { cmd: "text", id: el.id, x: round(el.x), y: round(el.y), text: el.originalText ?? el.text });
        if (el.strokeColor !== "#1e1e1e") c.stroke = color(el.strokeColor);
        if (el.opacity !== 100) c.opacity = el.opacity;
        fontOf(el, c, "left");
        break;
      case "arrow":
      case "line": {
        const pts = (el.points as number[][]).map(([px, py]) => [el.x + px, el.y + py] as [number, number]);
        const from = el.startBinding?.elementId && byId.has(el.startBinding.elementId) ? el.startBinding.elementId : undefined;
        const to = el.endBinding?.elementId && byId.has(el.endBinding.elementId) ? el.endBinding.elementId : undefined;
        c.cmd = el.type;
        c.id = el.id;
        if (el.type === "arrow" && pts.length === 2 || (el.type === "arrow" && (from || to))) {
          if (from) c.from = from; else { c.x1 = round(pts[0][0]); c.y1 = round(pts[0][1]); }
          const last = pts[pts.length - 1];
          if (to) c.to = to; else { c.x2 = round(last[0]); c.y2 = round(last[1]); }
        } else {
          c.points = pts;
        }
        if (el.type === "arrow") {
          const text = textOf(el);
          if (text) c.text = text.originalText ?? text.text;
          if (el.endArrowhead !== "arrow") c.head = el.endArrowhead ?? "none";
          if (el.startArrowhead) c.tail = el.startArrowhead;
        }
        styleOf(el, c);
        delete c.fill;
        delete c.fillstyle;
        break;
      }
      case "freedraw": {
        const pts = (el.points as number[][]).map(([px, py]) => [el.x + px, el.y + py] as [number, number]);
        // every 4th point is enough to describe the stroke
        const thin = pts.filter((_, i) => i % 4 === 0 || i === pts.length - 1);
        Object.assign(c, { cmd: "draw", id: el.id, points: thin.length >= 2 ? thin : pts });
        if (el.strokeColor !== "#1e1e1e") c.stroke = color(el.strokeColor);
        if (el.strokeWidth !== 2) c.width = width(el.strokeWidth);
        break;
      }
      case "frame": {
        Object.assign(c, { cmd: "frame", id: el.id, x: round(el.x), y: round(el.y), w: round(el.width), h: round(el.height) });
        if (el.name) c.title = el.name;
        const children = alive.filter((e) => e.frameId === el.id && !(e.type === "text" && e.containerId)).map((e) => e.id);
        if (children.length > 0) c.contains = children.join(" ");
        break;
      }
      default:
        continue; // images, embeds: not part of the language
    }
    commands.push(c);
    if (el.angle) extra.push({ cmd: "rotate", targets: [el.id], angle: Math.round((el.angle * 180) / Math.PI) });
    if (el.link) extra.push({ cmd: "link", targets: [el.id], url: el.link });
    if (el.locked) extra.push({ cmd: "lock", targets: [el.id] });
  }

  // so that the script also runs on an empty board: shapes and texts first,
  // then arrows and lines (they refer to shapes), frames last (they contain them)
  const rank = (c: Command) => (c.cmd === "frame" ? 2 : c.cmd === "arrow" || c.cmd === "line" ? 1 : 0);
  commands.sort((a, b) => rank(a) - rank(b));

  // groups, innermost first
  const groups = new Map<string, { members: string[]; depth: number }>();
  for (const el of alive) {
    if (el.type === "text" && el.containerId) continue;
    (el.groupIds as string[]).forEach((gid, depth) => {
      const g = groups.get(gid) ?? { members: [], depth };
      g.members.push(el.id);
      g.depth = Math.min(g.depth, depth);
      groups.set(gid, g);
    });
  }
  const groupCommands = [...groups.entries()]
    .filter(([, g]) => g.members.length >= 2)
    .sort((a, b) => a[1].depth - b[1].depth)
    .map(([gid, g]) => ({ cmd: "group", targets: g.members, id: gid }) as Command);

  const header = commands.length === 0 ? "# The board is empty." : `# ${commands.length} element(s) on the board`;
  return [header, formatScript([...commands, ...groupCommands, ...extra])].filter(Boolean).join("\n");
}
