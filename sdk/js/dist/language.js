/**
 * Udon Whiteboard Script: parse, validate and write commands.
 * No dependencies – used by the board, the JS/TS library and the MCP server.
 */
import { COLORS, COMMAND_MAP, COMMANDS, LANGUAGE_NAME, LANGUAGE_VERSION } from "./spec.js";
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
// ----------------------------------------------------------------------
// Parsing
// ----------------------------------------------------------------------
/**
 * Parses a script (one command per line) or JSON (an array of command
 * objects, or {"commands": [...]}). Values are converted to their types and
 * checked against the specification.
 */
export function parse(input) {
    const body = stripCodeFence(input);
    const trimmed = body.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        return parseJson(trimmed);
    }
    return parseScript(body);
}
/**
 * AIs like to wrap their answer in ``` … ``` and write a sentence before or
 * after it. If there are code blocks, only their content counts; all other
 * lines become empty, so that line numbers still match the pasted text.
 */
function stripCodeFence(input) {
    const lines = input.split(/\r?\n/);
    if (!lines.some((l) => /^\s*```/.test(l))) {
        return input;
    }
    let inside = false;
    return lines
        .map((l) => {
        if (/^\s*```/.test(l)) {
            inside = !inside;
            return "";
        }
        return inside ? l : "";
    })
        .join("\n");
}
function parseScript(script) {
    const result = { commands: [], lines: [], problems: [] };
    script.split(/\r?\n/).forEach((raw, index) => {
        const line = index + 1;
        const tokens = tokenize(raw, line, result.problems);
        if (tokens === null || tokens.length === 0) {
            return;
        }
        const [name, ...rest] = tokens;
        const command = { cmd: name.value.toLowerCase() };
        const targets = [];
        for (const token of rest) {
            if (token.key === null) {
                targets.push(token.value);
            }
            else {
                command[token.key.toLowerCase()] = token.value;
            }
        }
        if (targets.length > 0) {
            command.targets = targets;
        }
        const checked = check(command, line, result.problems);
        if (checked !== null) {
            result.commands.push(checked);
            result.lines.push(line);
        }
    });
    return result;
}
/** Splits a line into words, key=value pairs and "quoted text". */
function tokenize(raw, line, problems) {
    const tokens = [];
    let i = 0;
    const s = raw;
    while (i < s.length) {
        while (i < s.length && /\s/.test(s[i]))
            i++;
        if (i >= s.length || s[i] === "#")
            break;
        let key = null;
        let start = i;
        while (i < s.length && !/[\s="]/.test(s[i]))
            i++;
        let word = s.slice(start, i);
        if (s[i] === "=") {
            key = word;
            i++;
            word = "";
        }
        if (s[i] === '"') {
            i++;
            let text = "";
            let closed = false;
            while (i < s.length) {
                const c = s[i];
                if (c === "\\" && i + 1 < s.length) {
                    const n = s[i + 1];
                    text += n === "n" ? "\n" : n === "t" ? "\t" : n;
                    i += 2;
                    continue;
                }
                if (c === '"') {
                    closed = true;
                    i++;
                    break;
                }
                text += c;
                i++;
            }
            if (!closed) {
                problems.push({ line, message: "Quotation mark \" is not closed." });
                return null;
            }
            word += text;
        }
        else if (key !== null) {
            start = i;
            while (i < s.length && !/\s/.test(s[i]))
                i++;
            word = s.slice(start, i);
        }
        tokens.push({ key, value: word });
    }
    return tokens;
}
function parseJson(text) {
    const result = { commands: [], lines: [], problems: [] };
    let data;
    try {
        data = JSON.parse(text);
    }
    catch (e) {
        result.problems.push({ line: 0, message: `Invalid JSON: ${e.message}` });
        return result;
    }
    const list = Array.isArray(data) ? data : data.commands;
    if (!Array.isArray(list)) {
        result.problems.push({ line: 0, message: 'JSON must be an array of commands or {"commands": [...]}.' });
        return result;
    }
    list.forEach((item, index) => {
        const line = index + 1;
        if (item === null || typeof item !== "object" || typeof item.cmd !== "string") {
            result.problems.push({ line, message: 'Each command needs "cmd".' });
            return;
        }
        const raw = item;
        const command = { cmd: String(raw.cmd).toLowerCase() };
        for (const [k, v] of Object.entries(raw)) {
            if (k === "cmd")
                continue;
            if (k === "targets") {
                command.targets = Array.isArray(v) ? v.map(String) : [String(v)];
            }
            else if (k === "points" && Array.isArray(v)) {
                command.points = v.map((p) => (Array.isArray(p) ? `${p[0]},${p[1]}` : String(p))).join(" ");
            }
            else {
                command[k.toLowerCase()] = typeof v === "number" || typeof v === "boolean" ? String(v) : v;
            }
        }
        const checked = check(command, line, result.problems);
        if (checked !== null) {
            result.commands.push(checked);
            result.lines.push(line);
        }
    });
    return result;
}
// ----------------------------------------------------------------------
// Checking against the specification
// ----------------------------------------------------------------------
function check(command, line, problems) {
    const spec = COMMAND_MAP.get(command.cmd);
    if (spec === undefined) {
        problems.push({ line, message: `Unknown command "${command.cmd}". Known: ${COMMANDS.map((c) => c.name).join(", ")}.` });
        return null;
    }
    let ok = true;
    const out = { cmd: spec.name };
    const targets = command.targets ?? [];
    if (spec.targets === undefined) {
        if (targets.length > 0) {
            problems.push({ line, message: `${spec.name}: unexpected "${targets.join(" ")}" (use key=value).` });
            ok = false;
        }
    }
    else {
        if (targets.length < spec.targets.min) {
            problems.push({ line, message: `${spec.name}: needs at least ${spec.targets.min} element id(s) after the command.` });
            ok = false;
        }
        if (spec.targets.max !== undefined && targets.length > spec.targets.max) {
            problems.push({ line, message: `${spec.name}: at most ${spec.targets.max} element id(s).` });
            ok = false;
        }
        for (const t of targets) {
            if (!ID_PATTERN.test(t)) {
                problems.push({ line, message: `${spec.name}: "${t}" is not a valid id (letters, digits, - and _).` });
                ok = false;
            }
        }
        if (targets.length > 0)
            out.targets = targets;
    }
    for (const [key, raw] of Object.entries(command)) {
        if (key === "cmd" || key === "targets" || raw === undefined)
            continue;
        const param = spec.params.find((p) => p.name === key);
        if (param === undefined) {
            problems.push({ line, message: `${spec.name}: unknown parameter "${key}". Allowed: ${spec.params.map((p) => p.name).join(", ") || "none"}.` });
            ok = false;
            continue;
        }
        const converted = convert(spec, param, String(raw), line, problems);
        if (converted === undefined) {
            ok = false;
        }
        else {
            out[key] = converted;
        }
    }
    for (const param of spec.params) {
        if (param.required && out[param.name] === undefined) {
            problems.push({ line, message: `${spec.name}: parameter "${param.name}" is required.` });
            ok = false;
        }
    }
    ok = ok && checkCombinations(spec, out, line, problems);
    return ok ? out : null;
}
function convert(spec, param, raw, line, problems) {
    const fail = (what) => {
        problems.push({ line, message: `${spec.name}: ${param.name}=${raw} – ${what}` });
        return undefined;
    };
    switch (param.type) {
        case "number": {
            const n = Number(raw);
            if (raw.trim() === "" || !Number.isFinite(n))
                return fail("expected a number.");
            if (param.min !== undefined && n < param.min)
                return fail(`must be at least ${param.min}.`);
            if (param.max !== undefined && n > param.max)
                return fail(`must be at most ${param.max}.`);
            return n;
        }
        case "id":
            return ID_PATTERN.test(raw) ? raw : fail("not a valid id (letters, digits, - and _).");
        case "color": {
            const name = raw.toLowerCase();
            if (COLORS[name] !== undefined)
                return COLORS[name];
            if (/^#[0-9a-f]{6}$/i.test(raw) || /^#[0-9a-f]{3}$/i.test(raw))
                return raw.toLowerCase();
            return fail(`unknown colour. Use #rrggbb or one of: ${Object.keys(COLORS).join(", ")}.`);
        }
        case "enum": {
            const values = param.values ?? [];
            const match = values.find((v) => v.toLowerCase() === raw.toLowerCase());
            return match ?? fail(`expected one of: ${values.join(", ")}.`);
        }
        case "boolean": {
            const v = raw.toLowerCase();
            if (["yes", "true", "1", "on"].includes(v))
                return true;
            if (["no", "false", "0", "off"].includes(v))
                return false;
            return fail("expected yes or no.");
        }
        case "points": {
            const pairs = raw.trim().split(/\s+/).map((p) => p.split(",").map(Number));
            if (pairs.length < 2 || pairs.some((p) => p.length !== 2 || !p.every(Number.isFinite))) {
                return fail('expected at least two points "x,y x,y".');
            }
            return pairs.map((p) => [p[0], p[1]]);
        }
        case "string":
            return raw;
    }
}
function checkCombinations(spec, c, line, problems) {
    const has = (k) => c[k] !== undefined;
    const fail = (m) => {
        problems.push({ line, message: `${spec.name}: ${m}` });
        return false;
    };
    const relative = ["right", "left", "below", "above"].filter(has);
    if (relative.length > 1)
        return fail("use only one of right/left/below/above.");
    if (relative.length === 1 && (has("x") || has("y")))
        return fail(`use either ${relative[0]} or x/y.`);
    if (spec.name === "arrow") {
        if (!has("from") && !(has("x1") && has("y1")))
            return fail("needs from=… or x1/y1.");
        if (!has("to") && !(has("x2") && has("y2")))
            return fail("needs to=… or x2/y2.");
    }
    if (spec.name === "line" && !has("points") && !(has("from") && has("to")))
        return fail('needs points="…" or from/to.');
    if (spec.name === "move") {
        const absolute = has("x") || has("y");
        if (!absolute && relative.length === 0 && !has("dx") && !has("dy"))
            return fail("needs dx/dy, x/y or right/left/below/above.");
        if ((absolute || relative.length > 0) && (c.targets?.length ?? 0) > 1)
            return fail("x/y and right/left/below/above work for one element only; use dx/dy for several.");
    }
    if (spec.name === "resize" && !has("w") && !has("h"))
        return fail("needs w and/or h.");
    if (spec.name === "style" && spec.params.every((p) => !has(p.name)))
        return fail("give at least one style parameter.");
    if (spec.name === "font" && !has("font") && !has("size") && !has("align"))
        return fail("give font, size or align.");
    return true;
}
// ----------------------------------------------------------------------
// Writing commands
// ----------------------------------------------------------------------
const COLOR_NAMES = new Map(Object.entries(COLORS).map(([name, hex]) => [hex, name]));
/** Writes one command as a script line. */
export function formatCommand(c) {
    const parts = [c.cmd, ...(c.targets ?? [])];
    const spec = COMMAND_MAP.get(c.cmd);
    for (const [key, value] of Object.entries(c)) {
        if (key === "cmd" || key === "targets" || value === undefined)
            continue;
        const isColor = spec?.params.find((p) => p.name === key)?.type === "color";
        const shown = isColor && typeof value === "string" ? (COLOR_NAMES.get(value.toLowerCase()) ?? value) : value;
        parts.push(`${key}=${formatValue(shown)}`);
    }
    return parts.join(" ");
}
function formatValue(value) {
    if (typeof value === "boolean")
        return value ? "yes" : "no";
    if (typeof value === "number")
        return String(Math.round(value * 100) / 100);
    if (Array.isArray(value))
        return `"${value.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(" ")}"`;
    if (value !== "" && /^#?[^\s"#=\\]+$/.test(value))
        return value;
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}
/** Writes commands as a script. */
export function formatScript(commands) {
    return commands.map(formatCommand).join("\n");
}
// ----------------------------------------------------------------------
// Reference and prompt for AIs
// ----------------------------------------------------------------------
const CATEGORY_TITLES = {
    create: "Create",
    change: "Change",
    arrange: "Arrange",
    view: "View and history",
};
/** The language reference as Markdown (for people and AIs). */
export function reference() {
    const out = [];
    out.push(`# ${LANGUAGE_NAME} ${LANGUAGE_VERSION}`);
    out.push("");
    out.push("One command per line: `command [ids…] key=value key=\"text with spaces\"`. Lines starting with # are comments.");
    out.push("Coordinates: x grows to the right, y grows downwards; sizes in pixels. Ids name elements so that later commands can refer to them.");
    out.push('Colours: a name (' + Object.keys(COLORS).join(", ") + ") or #rrggbb.");
    out.push('Booleans: yes/no. Line breaks in text: \\n.');
    for (const category of ["create", "change", "arrange", "view"]) {
        out.push("");
        out.push(`## ${CATEGORY_TITLES[category]}`);
        for (const c of COMMANDS.filter((x) => x.category === category)) {
            out.push("");
            const targets = c.targets ? (c.targets.min > 1 ? " <id> <id> …" : c.targets.max === 1 ? " <id>" : " <id> …") : "";
            out.push(`### ${c.name}${targets}`);
            out.push(c.description);
            if (c.params.length > 0) {
                out.push("");
                for (const p of c.params) {
                    const values = p.values ? ` (${p.values.join(" | ")})` : "";
                    out.push(`- \`${p.name}\`${p.required ? " (required)" : ""}: ${p.description}${values}`);
                }
            }
            out.push("");
            out.push("```");
            out.push(...c.examples);
            out.push("```");
        }
    }
    return out.join("\n");
}
/** End of the prompt when no task is given: the AI waits for it in the chat. */
const WAIT_FOR_TASK = [
    "The user gives the task in the next message, in any language. Reply to this message only with: OK – describe your task.",
    "Then answer every task with a ```udon code block as described above. If the user sends error messages from the board, answer with the complete corrected script.",
];
/** The prompt that makes any AI answer with valid commands. */
export function buildPrompt(options = {}) {
    const out = [];
    out.push(`You control a shared whiteboard with the command language "${LANGUAGE_NAME}". Your answer is pasted into the board and executed.`);
    out.push("");
    out.push("Rules for your answer:");
    out.push("- Answer ONLY with commands, one per line, inside one ```udon code block. No explanations outside the block; comments inside start with #.");
    out.push("- Give every element you create a short id (e.g. a1, goal, step2) so that arrows and later commands can refer to it.");
    out.push("- Prefer relative placement (right=, below=, gap=) over guessing coordinates; use x/y for the first element.");
    out.push("- Use arrow from=… to=… to connect elements, so the arrows follow when elements are moved.");
    out.push("- Write the texts on the board in the language of the task.");
    out.push("- Only use the commands and parameters listed in the reference. Existing elements can be changed by their id.");
    out.push("");
    out.push(reference());
    out.push("");
    if (options.board !== undefined && options.board.trim() !== "") {
        out.push("## Current board");
        out.push("These commands describe what is on the board now (use these ids to change existing elements; do not create them again):");
        out.push("```udon");
        out.push(options.board.trim());
        out.push("```");
        out.push("");
    }
    out.push("## Task");
    if (options.task !== undefined && options.task.trim() !== "") {
        out.push(options.task.trim());
    }
    else {
        // no task yet: the prompt is pasted into an AI chat and the task follows there
        out.push(...WAIT_FOR_TASK);
    }
    return out.join("\n");
}
