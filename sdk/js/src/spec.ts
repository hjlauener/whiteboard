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

export const LANGUAGE_NAME = "Udon Whiteboard Script";
export const LANGUAGE_VERSION = "1.0";

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
  targets?: { min: number; max?: number; description: string };
  params: readonly ParamSpec[];
  examples: readonly string[];
}

export const COLORS: Readonly<Record<string, string>> = {
  black: "#1e1e1e",
  white: "#ffffff",
  gray: "#868e96",
  red: "#e03131",
  pink: "#c2255c",
  violet: "#6741d9",
  blue: "#1971c2",
  cyan: "#0c8599",
  teal: "#099268",
  green: "#2f9e44",
  yellow: "#f08c00",
  orange: "#e8590c",
  "light-gray": "#e9ecef",
  "light-red": "#ffc9c9",
  "light-pink": "#fcc2d7",
  "light-violet": "#d0bfff",
  "light-blue": "#a5d8ff",
  "light-cyan": "#99e9f2",
  "light-teal": "#96f2d7",
  "light-green": "#b2f2bb",
  "light-yellow": "#ffec99",
  "light-orange": "#ffd8a8",
  transparent: "transparent",
};

const ID: ParamSpec = { name: "id", type: "id", description: "Name for the new element, used by later commands (letters, digits, - and _). Optional." };

const PLACE: readonly ParamSpec[] = [
  { name: "x", type: "number", description: "Left edge in board coordinates (y grows downwards)." },
  { name: "y", type: "number", description: "Top edge." },
  { name: "w", type: "number", min: 1, description: "Width." },
  { name: "h", type: "number", min: 1, description: "Height." },
  { name: "right", type: "id", description: "Place to the right of this element (instead of x/y)." },
  { name: "left", type: "id", description: "Place to the left of this element." },
  { name: "below", type: "id", description: "Place below this element." },
  { name: "above", type: "id", description: "Place above this element." },
  { name: "gap", type: "number", min: 0, description: "Distance for right/left/below/above (default 60)." },
];

const STYLE: readonly ParamSpec[] = [
  { name: "stroke", type: "color", description: "Line and text colour: a colour name or #rrggbb." },
  { name: "fill", type: "color", description: "Background colour: a colour name, #rrggbb or transparent." },
  { name: "fillstyle", type: "enum", values: ["solid", "hachure", "cross-hatch"], description: "How the background is filled." },
  { name: "width", type: "enum", values: ["thin", "bold", "extra"], description: "Line width." },
  { name: "linestyle", type: "enum", values: ["solid", "dashed", "dotted"], description: "Line style." },
  { name: "rough", type: "enum", values: ["0", "1", "2"], description: "Sloppiness: 0 clean, 1 sketchy, 2 very sketchy." },
  { name: "opacity", type: "number", min: 0, max: 100, description: "Opacity in percent." },
  { name: "round", type: "boolean", description: "Rounded corners (yes/no)." },
];

/** shape of lines and arrows (the same names as in frontend/src/linePatterns.ts) */
const PATTERN: ParamSpec = {
  name: "pattern",
  type: "enum",
  values: ["straight", "zigzag", "wave", "saw", "lightning", "curl", "organic", "mixed", "loops"],
  description: "Shape of the line along its course: straight (default), zigzag, wave, saw (saw tooth), lightning, curl (small curls), organic (irregular, hand-drawn), mixed (teeth and bumps), loops. Start and end stay in place.",
};

const FONT: readonly ParamSpec[] = [
  { name: "font", type: "enum", values: ["serif", "sans", "hand", "code"], description: "Font family (default serif)." },
  { name: "size", type: "enum", values: ["S", "M", "L", "XL", "XXL"], description: "Font size." },
  { name: "align", type: "enum", values: ["left", "center", "right"], description: "Text alignment." },
];

const TEXT: ParamSpec = { name: "text", type: "string", description: 'Text inside the element. Use "\\n" for a line break.' };

const shape = (name: string, what: string): CommandSpec => ({
  name,
  category: "create",
  description: `Creates a ${what}. Default size 160 x 80.`,
  params: [ID, ...PLACE, TEXT, ...STYLE, ...FONT],
  examples: [`${name} id=a x=0 y=0 w=200 h=100 text="Goal"`, `${name} id=b right=a text="Next step" fill=light-blue`],
});

const ARROW_HEADS = ["arrow", "triangle", "bar", "dot", "none"] as const;

export const COMMANDS: readonly CommandSpec[] = [
  shape("rect", "rectangle"),
  shape("ellipse", "ellipse"),
  shape("diamond", "diamond (rhombus), e.g. for decisions"),
  {
    name: "note",
    category: "create",
    description: "Creates a sticky note: a light-yellow square with text. Default size 180 x 180.",
    params: [ID, ...PLACE, TEXT, ...STYLE, ...FONT],
    examples: ['note id=n1 x=0 y=0 text="Idea:\\nask the students"', "note id=n2 right=n1 fill=light-green text=\"Done\""],
  },
  {
    name: "text",
    category: "create",
    description: "Creates free text without a frame.",
    params: [ID, ...PLACE.filter((p) => p.name !== "w" && p.name !== "h"), { ...TEXT, required: true, description: "The text." }, { name: "stroke", type: "color", description: "Text colour." }, { name: "opacity", type: "number", min: 0, max: 100, description: "Opacity in percent." }, ...FONT],
    examples: ['text id=title x=0 y=-120 text="Introduction to law" size=XL'],
  },
  {
    name: "arrow",
    category: "create",
    description: "Creates an arrow. With from/to it is attached to both elements and follows them when they are moved; otherwise give x1/y1/x2/y2.",
    params: [
      ID,
      { name: "from", type: "id", description: "Element where the arrow starts." },
      { name: "to", type: "id", description: "Element where the arrow ends." },
      { name: "x1", type: "number", description: "Start point x (without from)." },
      { name: "y1", type: "number", description: "Start point y." },
      { name: "x2", type: "number", description: "End point x (without to)." },
      { name: "y2", type: "number", description: "End point y." },
      { name: "text", type: "string", description: "Label on the arrow." },
      { name: "head", type: "enum", values: ARROW_HEADS, description: "Head at the end (default arrow)." },
      { name: "tail", type: "enum", values: ARROW_HEADS, description: "Head at the start (default none)." },
      ...STYLE.filter((p) => p.name !== "fill" && p.name !== "fillstyle" && p.name !== "round"),
      PATTERN,
    ],
    examples: ["arrow from=a to=b", 'arrow from=a to=b text="leads to" linestyle=dashed', "arrow x1=0 y1=0 x2=200 y2=0 head=triangle", "arrow from=a to=b pattern=wave"],
  },
  {
    name: "line",
    category: "create",
    description: "Creates a line through points, or between two elements with from/to.",
    params: [
      ID,
      { name: "points", type: "points", description: 'Points as "x,y x,y …" (at least two).' },
      { name: "from", type: "id", description: "Element where the line starts." },
      { name: "to", type: "id", description: "Element where the line ends." },
      ...STYLE.filter((p) => p.name !== "fill" && p.name !== "fillstyle" && p.name !== "round"),
      PATTERN,
    ],
    examples: ['line points="0,300 600,300" linestyle=dashed stroke=gray', 'line points="0,0 400,0" pattern=zigzag'],
  },
  {
    name: "draw",
    category: "create",
    description: "Creates a freehand stroke through the given points.",
    params: [
      ID,
      { name: "points", type: "points", required: true, description: 'Points as "x,y x,y …" (at least two).' },
      { name: "stroke", type: "color", description: "Colour." },
      { name: "width", type: "enum", values: ["thin", "bold", "extra"], description: "Line width." },
      { name: "opacity", type: "number", min: 0, max: 100, description: "Opacity in percent." },
      PATTERN,
    ],
    examples: ['draw points="0,0 10,5 20,0 30,5" stroke=red', 'draw points="0,0 120,40 240,0" pattern=wave'],
  },
  {
    name: "frame",
    category: "create",
    description: "Creates a named frame (area). Elements listed in contains are put into the frame.",
    params: [ID, ...PLACE, { name: "title", type: "string", description: "Name shown above the frame." }, { name: "contains", type: "string", description: 'Ids of elements inside the frame, separated by spaces, e.g. "a b c".' }],
    examples: ['frame id=f1 x=-40 y=-40 w=600 h=400 title="Group 1" contains="a b"'],
  },
  {
    name: "move",
    category: "change",
    description: "Moves elements by dx/dy, or one element to x/y (top-left corner). Attached arrows follow.",
    targets: { min: 1, description: "Elements to move." },
    params: [
      { name: "dx", type: "number", description: "Horizontal distance." },
      { name: "dy", type: "number", description: "Vertical distance." },
      { name: "x", type: "number", description: "New left edge (one element only)." },
      { name: "y", type: "number", description: "New top edge (one element only)." },
      { name: "right", type: "id", description: "Place to the right of this element." },
      { name: "left", type: "id", description: "Place to the left of this element." },
      { name: "below", type: "id", description: "Place below this element." },
      { name: "above", type: "id", description: "Place above this element." },
      { name: "gap", type: "number", min: 0, description: "Distance for right/left/below/above (default 60)." },
    ],
    examples: ["move a dx=100 dy=0", "move a b c dy=-50", "move b below=a gap=40"],
  },
  {
    name: "resize",
    category: "change",
    description: "Changes the size of an element (top-left corner stays).",
    targets: { min: 1, description: "Elements to resize." },
    params: [{ name: "w", type: "number", min: 1, description: "New width." }, { name: "h", type: "number", min: 1, description: "New height." }],
    examples: ["resize a w=300 h=120"],
  },
  {
    name: "rotate",
    category: "change",
    description: "Rotates elements to the given angle (degrees, clockwise).",
    targets: { min: 1, description: "Elements to rotate." },
    params: [{ name: "angle", type: "number", required: true, description: "Angle in degrees." }],
    examples: ["rotate a angle=15"],
  },
  {
    name: "style",
    category: "change",
    description: "Changes colours and line style of elements. pattern only changes lines, arrows and freehand strokes.",
    targets: { min: 1, description: "Elements to change." },
    params: [...STYLE, PATTERN],
    examples: ["style a b fill=light-red stroke=red", "style c linestyle=dashed width=bold rough=0", "style arrow1 pattern=loops"],
  },
  {
    name: "settext",
    category: "change",
    description: "Replaces the text of an element (shape, note, text or arrow label).",
    targets: { min: 1, max: 1, description: "The element." },
    params: [{ ...TEXT, required: true, description: 'New text. Use "\\n" for a line break.' }],
    examples: ['settext a text="Revised goal"'],
  },
  {
    name: "font",
    category: "change",
    description: "Changes font, size or alignment of the text of elements.",
    targets: { min: 1, description: "Elements with text." },
    params: FONT,
    examples: ["font title size=XL font=serif", "font a b align=left"],
  },
  {
    name: "convert",
    category: "change",
    description: "Turns elements into another kind of shape; position, size, text, colours and attached arrows stay. Shapes (rect, ellipse, diamond, note) change among each other, arrows and lines among each other.",
    targets: { min: 1, description: "Elements to convert." },
    params: [{ name: "to", type: "enum", required: true, values: ["rect", "ellipse", "diamond", "note", "arrow", "line"], description: "New kind of element." }],
    examples: ["convert a to=ellipse", "convert b c to=note", "convert link1 to=line"],
  },
  {
    name: "delete",
    category: "change",
    description: "Deletes elements (and their text). Arrows attached to them stay but are detached.",
    targets: { min: 1, description: "Elements to delete." },
    params: [],
    examples: ["delete a", "delete b c"],
  },
  {
    name: "link",
    category: "change",
    description: "Adds a web link to an element (empty url removes it).",
    targets: { min: 1, description: "Elements." },
    params: [{ name: "url", type: "string", required: true, description: "https:// address, or empty." }],
    examples: ['link a url="https://www.unibe.ch"'],
  },
  {
    name: "lock",
    category: "change",
    description: "Locks elements so that they cannot be moved or changed by mistake.",
    targets: { min: 1, description: "Elements." },
    params: [],
    examples: ["lock title"],
  },
  {
    name: "unlock",
    category: "change",
    description: "Unlocks elements.",
    targets: { min: 1, description: "Elements." },
    params: [],
    examples: ["unlock title"],
  },
  {
    name: "group",
    category: "arrange",
    description: "Groups elements so that they are selected and moved together.",
    targets: { min: 2, description: "Elements to group." },
    params: [{ name: "id", type: "id", description: "Name of the group; can be used like an element id afterwards." }],
    examples: ["group a b c id=g1"],
  },
  {
    name: "ungroup",
    category: "arrange",
    description: "Removes the outermost group of the elements (or of the named group).",
    targets: { min: 1, description: "Elements or a group id." },
    params: [],
    examples: ["ungroup g1"],
  },
  {
    name: "front",
    category: "arrange",
    description: "Brings elements to the front.",
    targets: { min: 1, description: "Elements." },
    params: [],
    examples: ["front a"],
  },
  {
    name: "back",
    category: "arrange",
    description: "Sends elements to the back.",
    targets: { min: 1, description: "Elements." },
    params: [],
    examples: ["back f1"],
  },
  {
    name: "align",
    category: "arrange",
    description: "Aligns elements to each other.",
    targets: { min: 2, description: "Elements to align." },
    params: [{ name: "edge", type: "enum", required: true, values: ["left", "center", "right", "top", "middle", "bottom"], description: "Edge or centre line to align on." }],
    examples: ["align a b c edge=top"],
  },
  {
    name: "distribute",
    category: "arrange",
    description: "Distributes elements evenly between the first and the last one.",
    targets: { min: 3, description: "Elements to distribute." },
    params: [{ name: "axis", type: "enum", required: true, values: ["x", "y"], description: "x = horizontally, y = vertically." }],
    examples: ["distribute a b c d axis=x"],
  },
  {
    name: "select",
    category: "view",
    description: "Selects elements on the board (only for you, not for the others).",
    targets: { min: 1, description: "Elements." },
    params: [],
    examples: ["select a b"],
  },
  {
    name: "view",
    category: "view",
    description: 'Scrolls and zooms your view to elements, or to the whole board with "all" (only for you).',
    targets: { min: 1, description: 'Elements, or "all".' },
    params: [],
    examples: ["view all", "view a b"],
  },
  {
    name: "undo",
    category: "view",
    description: "Undoes your last change on the board (a whole script counts as one change).",
    params: [],
    examples: ["undo"],
  },
  {
    name: "redo",
    category: "view",
    description: "Redoes what undo has undone.",
    params: [],
    examples: ["redo"],
  },
];

export const COMMAND_MAP: ReadonlyMap<string, CommandSpec> = new Map(COMMANDS.map((c) => [c.name, c]));
