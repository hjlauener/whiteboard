/**
 * The templates: each one draws its starting layout with the building blocks
 * of builder.ts (boxes, columns, tables, notes, arrows), so that one can
 * start right away. t("key") is the text tplt_<template>_<key> of the
 * language files, tc("key") a common text tplt_common_<key>.
 * The topics and their order: ../../templates.ts.
 */
import type { Builder } from "./builder.ts";

export type TemplateText = (key: string) => string;
type Draw = (b: Builder, t: TemplateText, tc: TemplateText) => void;

// ----------------------------------------------------------------------
// recurring layouts
// ----------------------------------------------------------------------

/** columns with a coloured head and two sample notes in the first one */
function columns(b: Builder, titles: readonly string[], fills: readonly string[], sample: string, w = 260, h = 560): void {
  titles.forEach((title, i) => {
    b.column(i * (w + 24), 0, w, h, title, fills[i % fills.length]);
  });
  b.note(20, 80, sample);
  b.note(20, 210, sample);
}

/** 2 x 2 matrix with headings, sub texts and axis labels */
function matrix(
  b: Builder,
  cells: ReadonlyArray<[string, string, string]>,
  axes: { top: [string, string]; left: [string, string] } | null,
  size = 420,
): void {
  const off = axes ? 110 : 0;
  cells.forEach(([heading, sub, fill], i) => {
    const x = off + (i % 2) * (size + 16);
    const y = (axes ? 60 : 0) + Math.floor(i / 2) * (size + 16);
    b.area(x, y, size, size, heading, fill, sub);
  });
  if (axes) {
    b.text(off + size / 2 - 60, 10, axes.top[0], "M", b.c.muted);
    b.text(off + size + 16 + size / 2 - 60, 10, axes.top[1], "M", b.c.muted);
    b.text(0, 60 + size / 2 - 12, axes.left[0], "M", b.c.muted);
    b.text(0, 60 + size + 16 + size / 2 - 12, axes.left[1], "M", b.c.muted);
  }
}

/** a centre with boxes around it, connected by lines */
function hub(b: Builder, centre: string, branches: readonly string[], o: { radius?: number; note?: boolean; labels?: readonly string[] } = {}): void {
  const r = o.radius ?? 330;
  const c = b.box(-130, -60, 260, 120, centre, { shape: "ellipse", fill: b.c.blue, size: "L" });
  const fills = [b.c.yellow, b.c.green, b.c.orange, b.c.purple, b.c.red, b.c.grey];
  branches.forEach((text, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / branches.length;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r * 0.75;
    const id = o.note ? b.note(x - 85, y - 55, text) : b.box(x - 100, y - 45, 200, 90, text, { fill: fills[i % fills.length] });
    b.arrow(c, id, { head: o.labels ? "arrow" : "none", text: o.labels?.[i % o.labels.length] });
  });
}

/** tree: levels of boxes, each box connected to its parent(s) */
function tree(b: Builder, levels: ReadonlyArray<ReadonlyArray<{ text: string; parent?: number | number[] }>>, fills: readonly string[], w = 190, h = 80): void {
  const ids: string[][] = [];
  const widest = Math.max(...levels.map((l) => l.length));
  const span = widest * (w + 30);
  levels.forEach((level, depth) => {
    const step = span / level.length;
    ids.push(
      level.map((node, i) => {
        const id = b.box(i * step + (step - w) / 2, depth * (h + 90), w, h, node.text, { fill: fills[depth % fills.length] });
        if (depth > 0) {
          for (const p of Array.isArray(node.parent) ? node.parent : [node.parent ?? 0]) b.arrow(ids[depth - 1][p], id, { head: "none" });
        }
        return id;
      }),
    );
  });
}

/** row of steps connected by arrows */
function process(b: Builder, steps: readonly string[], y = 0, fill = b.c.blue, w = 220, h = 100): string[] {
  const ids = steps.map((text, i) => b.box(i * (w + 70), y, w, h, text, { fill }));
  for (let i = 1; i < ids.length; i++) b.arrow(ids[i - 1], ids[i]);
  return ids;
}

// ----------------------------------------------------------------------
// templates
// ----------------------------------------------------------------------

export const TEMPLATES: Readonly<Record<string, Draw>> = {
  // --- Didaktik ---
  lesson_plan: (b, t) => {
    b.title(t("title"));
    b.box(0, 0, 360, 80, t("topic"), { fill: b.c.blue, align: "left" });
    b.box(380, 0, 300, 80, t("group"), { fill: b.c.blue, align: "left" });
    b.box(700, 0, 300, 80, t("duration"), { fill: b.c.blue, align: "left" });
    b.area(0, 100, 1000, 150, t("goals"), b.c.green);
    b.table(0, 280, [140, 180, 320, 170, 190], [56, 110, 110, 110, 110], [
      [t("col_time"), t("col_phase"), t("col_activity"), t("col_form"), t("col_material")],
      ["", t("ph_intro"), "", "", ""],
      ["", t("ph_work"), "", "", ""],
      ["", t("ph_secure"), "", "", ""],
      ["", t("ph_close"), "", "", ""],
    ], b.c.yellow);
  },

  syllabus: (b, t) => {
    b.title(t("title"));
    b.box(0, 0, 480, 80, t("course"), { fill: b.c.blue, align: "left" });
    b.box(500, 0, 480, 80, t("lecturer"), { fill: b.c.blue, align: "left" });
    b.area(0, 100, 480, 160, t("goals"), b.c.green);
    b.area(500, 100, 480, 160, t("assessment"), b.c.orange);
    const rows = [1, 2, 3, 4, 5, 6].map((n) => [String(n), "", "", ""]);
    b.table(0, 290, [110, 170, 380, 320], [56, 70, 70, 70, 70, 70, 70], [[t("col_week"), t("col_date"), t("col_topic"), t("col_reading")], ...rows], b.c.yellow);
  },

  study_board: (b, t) => {
    b.title(t("title"));
    columns(b, [t("material"), t("todo"), t("doing"), t("done")], [b.c.blue, b.c.yellow, b.c.orange, b.c.green], t("sample"));
    b.area(0, 590, 1112, 150, t("exams"), b.c.red);
  },

  reflection: (b, t) => {
    b.title(t("title"));
    matrix(b, [
      [t("q1"), "", b.c.green],
      [t("q2"), "", b.c.blue],
      [t("q3"), "", b.c.orange],
      [t("q4"), "", b.c.purple],
    ], null, 460);
  },

  objectives: (b, t) => {
    b.title(t("title"));
    b.text(0, -50, t("hint"), "M", b.c.muted);
    const fills = [b.c.grey, b.c.blue, b.c.green, b.c.yellow, b.c.orange, b.c.red];
    ["l1", "l2", "l3", "l4", "l5", "l6"].forEach((key, i) => {
      const y = i * 116;
      b.box(0, y, 230, 100, t(key), { fill: fills[i], size: "L" });
      b.box(246, y, 820, 100, "", { dashed: true });
    });
    b.note(262, 5, t("sample"), b.c.yellow, 260, 90);
  },

  concept_map: (b, t) => {
    b.title(t("title"), -300, -380);
    const centre = b.box(-150, -60, 300, 120, t("centre"), { shape: "ellipse", fill: b.c.blue, size: "L" });
    const spots: Array<[number, number]> = [[-560, -300], [360, -300], [-560, 220], [360, 220]];
    spots.forEach(([x, y], i) => {
      const id = b.box(x, y, 220, 90, t("concept"), { fill: [b.c.yellow, b.c.green, b.c.orange, b.c.purple][i] });
      b.arrow(centre, id, { text: t(`rel${i + 1}`) });
    });
  },

  english_tenses: (b, t) => {
    b.title(t("title"));
    b.table(0, 0, [180, 300, 300, 300], [60, 110, 110, 110], [
      ["", t("simple"), t("progressive"), t("perfect")],
      [t("past"), t("past_simple"), t("past_progressive"), t("past_perfect")],
      [t("present"), t("present_simple"), t("present_progressive"), t("present_perfect")],
      [t("future"), t("future_simple"), t("future_progressive"), t("future_perfect")],
    ], b.c.blue, true);
    b.area(0, 420, 1080, 180, t("practice"), b.c.yellow);
  },

  clothes: (b, t) => {
    b.title(t("title"));
    // a simple figure in the middle
    const cx = 520;
    b.box(cx - 40, 0, 80, 80, "", { shape: "ellipse" });
    b.line([[cx, 80], [cx, 260]], { bold: true });
    b.line([[cx - 90, 140], [cx, 110], [cx + 90, 140]], { bold: true });
    b.line([[cx - 60, 400], [cx, 260], [cx + 60, 400]], { bold: true });
    const labels: Array<[string, number, number, number, number]> = [
      ["hat", 160, -10, cx - 40, 20],
      ["scarf", 160, 110, cx - 20, 95],
      ["shirt", 160, 230, cx - 20, 170],
      ["jacket", 760, 50, cx + 60, 130],
      ["trousers", 760, 230, cx + 20, 300],
      ["shoes", 760, 380, cx + 60, 395],
    ];
    labels.forEach(([key, x, y, px, py]) => {
      b.box(x, y, 200, 70, t(key), { fill: b.c.yellow });
      b.arrowXY(x < cx ? x + 200 : x, y + 35, px, py);
    });
    b.area(0, 480, 1040, 180, t("more"), b.c.green);
  },

  warm_up: (b, t) => {
    b.title(t("title"));
    b.text(0, -50, t("task"), "M", b.c.muted);
    for (let i = 0; i < 9; i++) {
      b.box((i % 3) * 300, Math.floor(i / 3) * 170, 284, 154, t(`p${i + 1}`), { fill: [b.c.yellow, b.c.blue, b.c.green][(i + Math.floor(i / 3)) % 3] });
    }
  },

  family_tree: (b, t) => {
    b.title(t("title"));
    tree(b, [
      [{ text: t("grandmother") }, { text: t("grandfather") }, { text: t("grandmother") }, { text: t("grandfather") }],
      [{ text: t("mother"), parent: [0, 1] }, { text: t("father"), parent: [2, 3] }],
      [{ text: t("me"), parent: [0, 1] }, { text: t("sibling"), parent: [0, 1] }],
    ], [b.c.purple, b.c.blue, b.c.green]);
  },

  book_outline: (b, t) => {
    b.title(t("title"));
    b.box(0, 0, 300, 80, t("book_title"), { fill: b.c.blue, size: "L" });
    b.area(0, 100, 300, 200, t("message"), b.c.green);
    b.area(0, 320, 300, 200, t("audience"), b.c.orange);
    const ids = ["intro", "ch1", "ch2", "ch3", "end"].map((key, i) => b.box(340 + i * 230, 0, 210, 80, t(key), { fill: b.c.yellow }));
    ids.forEach((_, i) => b.box(340 + i * 230, 96, 210, 424, "", { dashed: true }));
    b.note(360, 112, t("sample"));
  },

  icebreaker: (b, t) => {
    b.title(t("title"), -330, -420);
    hub(b, t("welcome"), [t("q1"), t("q2"), t("q3"), t("q4")], { radius: 420 });
  },

  onboarding: (b, t) => {
    b.title(t("title"));
    process(b, [t("s1"), t("s2"), t("s3"), t("s4")]);
    const x = (i: number) => i * 290;
    b.area(x(0), 150, 270, 300, t("links"), b.c.blue);
    b.area(x(1), 150, 270, 300, t("people"), b.c.green);
    b.area(x(2), 150, 270, 300, t("dates"), b.c.yellow);
    b.area(x(3), 150, 270, 300, t("rules"), b.c.orange);
  },

  // --- Brainstorming ---
  brainstorming: (b, t, tc) => {
    b.title(t("title"), -300, -420);
    hub(b, t("question"), Array.from({ length: 8 }, () => tc("idea")), { radius: 460, note: true });
  },

  reverse_brainstorming: (b, t, tc) => {
    b.title(t("title"));
    b.box(0, 0, 1000, 90, t("problem"), { fill: b.c.blue, size: "L" });
    const left = b.column(0, 130, 470, 520, t("worse"), b.c.red);
    const right = b.column(530, 130, 470, 520, t("solutions"), b.c.green);
    b.arrow(left.head, right.head, { text: t("reverse") });
    b.note(20, 210, tc("idea"), b.c.red);
    b.note(550, 210, tc("idea"), b.c.green);
  },

  clustering: (b, t, tc) => {
    b.title(t("title"));
    b.area(0, 0, 420, 640, t("ideas"), "transparent");
    for (let i = 0; i < 8; i++) b.note(20 + (i % 2) * 195, 70 + Math.floor(i / 2) * 140, tc("idea"));
    [t("cluster_a"), t("cluster_b"), t("cluster_c")].forEach((title, i) => {
      b.area(460, i * 220, 620, 200, title, [b.c.blue, b.c.green, b.c.orange][i]);
    });
  },

  // --- Organigramme ---
  org_chart: (b, t) => {
    b.title(t("title"));
    tree(b, [
      [{ text: t("lead") }],
      [{ text: t("area") }, { text: t("area") }, { text: t("area") }],
      [0, 0, 1, 1, 2, 2].map((parent) => ({ text: t("team"), parent })),
    ], [b.c.blue, b.c.green, b.c.yellow]);
  },

  // --- Diagramme ---
  flowchart: (b, t) => {
    b.title(t("title"));
    const start = b.box(0, 0, 200, 90, t("start"), { shape: "ellipse", fill: b.c.green });
    const step = b.box(270, 0, 220, 90, t("step"), { fill: b.c.blue });
    const decision = b.box(550, -45, 300, 180, t("decision"), { shape: "diamond", fill: b.c.yellow, size: "S" });
    const yes = b.box(920, 0, 220, 90, t("step"), { fill: b.c.blue });
    const end = b.box(1210, 0, 200, 90, t("end"), { shape: "ellipse", fill: b.c.red });
    const no = b.box(590, 240, 220, 90, t("step"), { fill: b.c.blue });
    b.arrow(start, step);
    b.arrow(step, decision);
    b.arrow(decision, yes, { text: t("yes") });
    b.arrow(yes, end);
    b.arrow(decision, no, { text: t("no") });
    b.arrow(no, step);
  },

  swot: (b, t) => {
    b.title(t("title"), 110);
    matrix(b, [
      [t("s"), t("s_sub"), b.c.green],
      [t("w"), t("w_sub"), b.c.red],
      [t("o"), t("o_sub"), b.c.blue],
      [t("th"), t("th_sub"), b.c.orange],
    ], { top: [t("helpful"), t("harmful")], left: [t("internal"), t("external")] });
  },

  decision_matrix: (b, t) => {
    b.title(t("title"));
    b.text(0, -50, t("hint"), "S", b.c.muted);
    b.table(0, 0, [260, 160, 200, 200, 200], [60, 80, 80, 80, 80, 70], [
      [t("criterion"), t("weight"), t("option") + " A", t("option") + " B", t("option") + " C"],
      [t("criterion") + " 1", "", "", "", ""],
      [t("criterion") + " 2", "", "", "", ""],
      [t("criterion") + " 3", "", "", "", ""],
      [t("criterion") + " 4", "", "", "", ""],
      [t("total"), "", "", "", ""],
    ], b.c.blue, true);
  },

  timeline: (b, t) => {
    b.title(t("title"));
    b.arrowXY(0, 200, 1400, 200, { bold: true });
    for (let i = 0; i < 5; i++) {
      const x = 120 + i * 280;
      b.box(x - 14, 186, 28, 28, "", { shape: "ellipse", fill: b.c.ink });
      const up = i % 2 === 0;
      b.text(x - 40, up ? 140 : 236, t("date"), "S", b.c.muted);
      b.box(x - 110, up ? 0 : 290, 220, 110, t("milestone"), { fill: [b.c.blue, b.c.green, b.c.yellow, b.c.orange, b.c.purple][i] });
      b.line([[x, up ? 110 : 214], [x, up ? 186 : 290]], { dashed: true });
    }
  },

  wireframe: (b, t) => {
    b.title(t("title"));
    b.box(0, 0, 1000, 680, "", { round: false });
    b.box(0, 0, 1000, 44, "", { fill: b.c.grey, round: false });
    b.box(16, 12, 640, 20, "", { fill: "transparent" });
    b.box(30, 70, 140, 50, t("logo"), { fill: b.c.grey });
    ["nav1", "nav2", "nav3"].forEach((key, i) => b.text(560 + i * 140, 82, t(key), "M"));
    b.box(30, 140, 940, 250, t("image"), { fill: b.c.grey });
    b.text(30, 410, t("headline"), "L");
    [0, 1, 2].forEach((i) => b.box(30, 460 + i * 34, 600 - i * 120, 16, "", { fill: b.c.grey }));
    b.box(30, 570, 180, 56, t("button"), { fill: b.c.blue });
    b.box(700, 410, 270, 216, t("sidebar"), { dashed: true });
  },

  moodboard: (b, t) => {
    b.title(t("title"));
    const keys = ["images", "colours", "fonts", "mood", "examples", "notes"];
    keys.forEach((key, i) => {
      b.area((i % 3) * 400, Math.floor(i / 3) * 340, 380, 320, t(key), [b.c.grey, b.c.yellow, b.c.blue, b.c.purple, b.c.green, b.c.orange][i]);
    });
  },

  // --- Mapping ---
  mind_map: (b, t) => {
    b.title(t("title"), -300, -420);
    hub(b, t("topic"), [1, 2, 3, 4, 5, 6].map((n) => `${t("branch")} ${n}`), { radius: 440 });
  },

  customer_journey: (b, t) => {
    b.title(t("title"));
    const stages = ["st1", "st2", "st3", "st4", "st5"].map((k) => t(k));
    const rows = ["actions", "thoughts", "feelings", "touchpoints", "chances"].map((k) => t(k));
    b.table(0, 0, [200, 220, 220, 220, 220, 220], [60, 110, 110, 110, 110, 110], [
      ["", ...stages],
      ...rows.map((r) => [r, "", "", "", "", ""]),
    ], b.c.blue, true);
  },

  user_story_map: (b, t) => {
    b.title(t("title"));
    b.text(0, -50, t("hint"), "S", b.c.muted);
    const acts = [1, 2, 3, 4].map((n) => b.box((n - 1) * 260, 0, 240, 80, `${t("activity")} ${n}`, { fill: b.c.blue }));
    for (let i = 1; i < acts.length; i++) b.arrow(acts[i - 1], acts[i]);
    [1, 2, 3, 4].forEach((n) => b.box((n - 1) * 260, 100, 240, 70, t("task"), { fill: b.c.green }));
    [t("release1"), t("release2")].forEach((label, i) => {
      const y = 200 + i * 220;
      b.line([[0, y], [1020, y]], { dashed: true });
      b.text(1040, y - 14, label, "M", b.c.muted);
      b.note(0, y + 20, t("story"));
      b.note(260, y + 20, t("story"));
    });
  },

  roadmap: (b, t) => {
    b.title(t("title"));
    b.table(0, 0, [220, 260, 260, 260, 260], [60, 140, 140, 140], [
      ["", t("now"), t("next"), t("later"), t("vision")],
      [t("lane1"), "", "", "", ""],
      [t("lane2"), "", "", "", ""],
      [t("lane3"), "", "", "", ""],
    ], b.c.blue, true);
    b.note(236, 76, t("item"), b.c.yellow, 220, 100);
  },

  business_model_canvas: (b, t) => {
    b.title(t("title"));
    const w = 250;
    const h = 460;
    const fills = { a: b.c.blue, b: b.c.green, c: b.c.yellow };
    b.area(0, 0, w, h, t("partners"), fills.a, "", "M");
    b.area(w, 0, w, h / 2, t("activities"), fills.a, "", "M");
    b.area(w, h / 2, w, h / 2, t("resources"), fills.a, "", "M");
    b.area(2 * w, 0, w, h, t("value"), fills.c, "", "M");
    b.area(3 * w, 0, w, h / 2, t("relationships"), fills.b, "", "M");
    b.area(3 * w, h / 2, w, h / 2, t("channels"), fills.b, "", "M");
    b.area(4 * w, 0, w, h, t("segments"), fills.b, "", "M");
    b.area(0, h, 2.5 * w, 220, t("costs"), b.c.red, "", "M");
    b.area(2.5 * w, h, 2.5 * w, 220, t("revenue"), b.c.green, "", "M");
  },

  diagram_mapping: (b, t) => {
    b.title(t("title"));
    b.text(0, -50, t("process"), "L");
    process(b, [t("step") + " 1", t("step") + " 2", t("step") + " 3"], 0, b.c.blue, 200, 90);
    b.text(0, 170, t("cycle"), "L");
    const cyc: Array<[number, number]> = [[200, 220], [400, 360], [200, 500], [0, 360]];
    const ids = cyc.map(([x, y], i) => b.box(x, y, 180, 80, `${t("phase")} ${i + 1}`, { shape: "ellipse", fill: b.c.green }));
    ids.forEach((id, i) => b.arrow(id, ids[(i + 1) % ids.length]));
    b.text(760, 170, t("compare"), "L");
    b.box(700, 230, 320, 320, t("a"), { shape: "ellipse", align: "left" });
    b.box(900, 230, 320, 320, t("b"), { shape: "ellipse", align: "right" });
    b.text(915, 375, t("both"), "S");
  },

  // --- Workshops ---
  retrospective: (b, t) => {
    b.title(t("title"));
    columns(b, [t("good"), t("bad"), t("try"), t("actions")], [b.c.green, b.c.red, b.c.yellow, b.c.blue], t("sample"));
  },

  agenda: (b, t) => {
    b.title(t("title"));
    b.box(0, 0, 500, 80, t("goal"), { fill: b.c.blue, align: "left" });
    b.box(520, 0, 230, 80, t("date"), { fill: b.c.blue, align: "left" });
    b.box(770, 0, 330, 80, t("people"), { fill: b.c.blue, align: "left" });
    b.table(0, 110, [150, 430, 270, 250], [56, 80, 80, 80, 80, 80], [
      [t("col_time"), t("col_item"), t("col_method"), t("col_who")],
      ["", t("i1"), "", ""],
      ["", t("i2"), "", ""],
      ["", t("i3"), "", ""],
      ["", t("i4"), "", ""],
      ["", t("i5"), "", ""],
    ], b.c.yellow);
  },

  // --- Arbeitstools ---
  eisenhower: (b, t) => {
    b.title(t("title"), 110);
    matrix(b, [
      [t("do"), t("do_sub"), b.c.red],
      [t("plan"), t("plan_sub"), b.c.green],
      [t("delegate"), t("delegate_sub"), b.c.yellow],
      [t("drop"), t("drop_sub"), b.c.grey],
    ], { top: [t("urgent"), t("not_urgent")], left: [t("important"), t("not_important")] });
  },

  impact_effort: (b, t) => {
    b.title(t("title"), 110);
    matrix(b, [
      [t("quick"), t("quick_sub"), b.c.green],
      [t("major"), t("major_sub"), b.c.blue],
      [t("fill"), t("fill_sub"), b.c.yellow],
      [t("thankless"), t("thankless_sub"), b.c.red],
    ], { top: [t("low_effort"), t("high_effort")], left: [t("high_impact"), t("low_impact")] });
  },

  moscow: (b, t) => {
    b.title(t("title"));
    columns(b, [t("must"), t("should"), t("could"), t("wont")], [b.c.red, b.c.orange, b.c.blue, b.c.grey], t("sample"));
  },

  smart: (b, t) => {
    b.title(t("title"));
    b.box(0, 0, 1080, 90, t("goal"), { fill: b.c.blue, size: "L", align: "left" });
    const fills = [b.c.yellow, b.c.green, b.c.orange, b.c.purple, b.c.red];
    ["s", "m", "a", "r", "t"].forEach((key, i) => {
      const y = 116 + i * 116;
      b.box(0, y, 260, 100, t(key), { fill: fills[i], size: "L" });
      b.box(276, y, 804, 100, t(`${key}_q`), { dashed: true, size: "S", align: "left" });
    });
  },

  todo: (b, t) => {
    b.title(t("title"));
    b.table(0, 0, [60, 520, 180, 180], [56, 64, 64, 64, 64, 64, 64, 64, 64], [
      ["✓", t("task"), t("due"), t("status")],
      ...Array.from({ length: 8 }, () => ["☐", "", "", ""]),
    ], b.c.yellow);
  },

  week_planner: (b, t) => {
    b.title(t("title"));
    const days = ["mo", "tu", "we", "th", "fr", "sa", "su"];
    days.forEach((key, i) => b.column(i * 186, 0, 176, 480, t(key), i < 5 ? b.c.blue : b.c.green));
    b.area(0, 500, 1292, 160, t("goals"), b.c.yellow);
  },

  pomodoro: (b, t) => {
    b.title(t("title"));
    const steps: Array<[string, string]> = [];
    for (let i = 1; i <= 4; i++) {
      steps.push([`${t("work")} ${i}\n25 min`, b.c.red]);
      if (i < 4) steps.push([`${t("short_break")}\n5 min`, b.c.green]);
    }
    steps.push([`${t("long_break")}\n15–30 min`, b.c.blue]);
    const ids = steps.map(([text, fill], i) => b.box(i * 150, 0, 130, 110, text, { fill, size: "S" }));
    for (let i = 1; i < ids.length; i++) b.arrow(ids[i - 1], ids[i]);
    b.area(0, 160, 640, 380, t("tasks"), b.c.yellow);
    b.area(670, 160, 640, 380, t("done"), b.c.green);
  },

  kanban: (b, t) => {
    b.title(t("title"));
    columns(b, [t("backlog"), t("todo"), t("doing"), t("done")], [b.c.grey, b.c.yellow, b.c.blue, b.c.green], t("sample"));
  },
};
