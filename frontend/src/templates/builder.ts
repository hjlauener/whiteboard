/**
 * Building blocks for the templates: they write commands of the command
 * language (Udon Whiteboard Script), so a template is carried out like any
 * other command list (one undoable step, synchronised).
 */
import type { Command } from "../../../sdk/js/src/language.ts";

/** colours of the template, from the colour palette of the board */
export interface Colors {
  ink: string;
  muted: string;
  yellow: string;
  blue: string;
  green: string;
  red: string;
  purple: string;
  orange: string;
  grey: string;
}

export type Size = "S" | "M" | "L" | "XL" | "XXL";

export interface BoxOptions {
  shape?: "rect" | "ellipse" | "diamond";
  fill?: string;
  stroke?: string;
  size?: Size;
  align?: "left" | "center" | "right";
  dashed?: boolean;
  bold?: boolean;
  round?: boolean;
}

export class Builder {
  readonly commands: Command[] = [];
  private n = 0;

  private readonly prefix: string;
  readonly c: Colors;

  constructor(prefix: string, c: Colors) {
    this.prefix = prefix;
    this.c = c;
  }

  private nextId(): string {
    return `${this.prefix}${++this.n}`;
  }

  private push(command: Command): string {
    this.commands.push(command);
    return String(command.id);
  }

  /** rectangle (or ellipse/diamond) with optional text inside */
  box(x: number, y: number, w: number, h: number, text = "", o: BoxOptions = {}): string {
    const shape = o.shape ?? "rect";
    const command: Command = {
      cmd: shape,
      id: this.nextId(),
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h),
      fill: o.fill ?? "transparent",
      stroke: o.stroke ?? this.c.ink,
      size: o.size ?? "M",
    };
    if (text !== "") command.text = text;
    if (o.align) command.align = o.align;
    if (o.dashed) command.linestyle = "dashed";
    if (o.bold) command.width = "bold";
    if (shape === "rect") command.round = o.round ?? true;
    return this.push(command);
  }

  /** sticky note */
  note(x: number, y: number, text: string, fill = this.c.yellow, w = 170, h = 110): string {
    return this.push({ cmd: "note", id: this.nextId(), x: Math.round(x), y: Math.round(y), w, h, text, fill, stroke: this.c.ink, size: "S" });
  }

  /** free text */
  text(x: number, y: number, text: string, size: Size = "M", stroke = this.c.ink): string {
    return this.push({ cmd: "text", id: this.nextId(), x: Math.round(x), y: Math.round(y), text, size, stroke });
  }

  /** heading of the template, above its content */
  title(text: string, x = 0, y = -110): string {
    return this.text(x, y, text, "XL");
  }

  /** arrow between two elements (stays attached when they are moved) */
  arrow(from: string, to: string, o: { text?: string; dashed?: boolean; head?: "arrow" | "none" } = {}): string {
    const command: Command = { cmd: "arrow", id: this.nextId(), from, to, stroke: this.c.ink };
    if (o.text) command.text = o.text;
    if (o.dashed) command.linestyle = "dashed";
    if (o.head) command.head = o.head;
    return this.push(command);
  }

  /** free arrow between two points */
  arrowXY(x1: number, y1: number, x2: number, y2: number, o: { dashed?: boolean; head?: "arrow" | "none"; bold?: boolean } = {}): string {
    const command: Command = { cmd: "arrow", id: this.nextId(), x1, y1, x2, y2, stroke: this.c.ink };
    if (o.dashed) command.linestyle = "dashed";
    if (o.head) command.head = o.head;
    if (o.bold) command.width = "bold";
    return this.push(command);
  }

  /** line through points */
  line(points: Array<[number, number]>, o: { dashed?: boolean; stroke?: string; bold?: boolean } = {}): string {
    const command: Command = { cmd: "line", id: this.nextId(), points, stroke: o.stroke ?? this.c.ink };
    if (o.dashed) command.linestyle = "dashed";
    if (o.bold) command.width = "bold";
    return this.push(command);
  }

  /** an area with a heading in its top left corner (notes go inside) */
  area(x: number, y: number, w: number, h: number, heading: string, fill = "transparent", sub = "", size: Size = "L"): string {
    const id = this.box(x, y, w, h, "", { fill });
    this.text(x + 16, y + 14, heading, size);
    if (sub !== "") this.text(x + 16, y + (size === "L" ? 50 : 42), sub, "S", this.c.muted);
    return id;
  }

  /** column: coloured head with title, body below (notes go inside) */
  column(x: number, y: number, w: number, h: number, heading: string, fill: string): { head: string; body: string } {
    const head = this.box(x, y, w, 60, heading, { fill, size: "L" });
    const body = this.box(x, y + 60, w, h - 60, "", { fill: "transparent" });
    return { head, body };
  }

  /** table of boxes; the first row (and the first column if headColumn) coloured */
  table(x: number, y: number, widths: readonly number[], heights: readonly number[], cells: ReadonlyArray<ReadonlyArray<string>>, headFill: string, headColumn = false): string[][] {
    const ids: string[][] = [];
    let yy = y;
    heights.forEach((h, r) => {
      let xx = x;
      const row: string[] = [];
      widths.forEach((w, col) => {
        const head = r === 0 || (headColumn && col === 0);
        row.push(this.box(xx, yy, w, h, cells[r]?.[col] ?? "", { fill: head ? headFill : "transparent", size: head ? "M" : "S", round: false }));
        xx += w;
      });
      ids.push(row);
      yy += h;
    });
    return ids;
  }
}
