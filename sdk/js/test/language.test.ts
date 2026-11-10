import { parse, formatScript, buildPrompt, reference, Script, validate } from "../src/index.ts";

let failed = 0;
const ok = (cond: boolean, msg: string) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) failed++; };

const script = `# Mindmap
note id=thema x=0 y=0 text="Rechtsstaat"
rect id=a below=thema gap=80 text="Gewaltenteilung" fill=light-blue
rect id=b right=a text="Grund-\\nrechte"
arrow from=thema to=a text="führt zu"
move a b dx=10
group a b id=g1
undo`;
const r = parse(script);
ok(r.problems.length === 0, "gültiges Skript ohne Fehler: " + JSON.stringify(r.problems));
ok(r.commands.length === 7 && r.lines[0] === 2, "7 Befehle, Zeilennummern stimmen");
ok(r.commands[1].fill === "#a5d8ff", "Farbname wird zu Hex");
ok(r.commands[2].text === "Grund-\nrechte", "Zeilenumbruch \\n im Text");
ok(JSON.stringify(r.commands[4].targets) === '["a","b"]' && r.commands[4].dx === 10, "Ziele und Zahl");

const again = parse(formatScript(r.commands));
ok(JSON.stringify(again.commands) === JSON.stringify(r.commands), "formatScript → parse ergibt dasselbe");

const bad = parse(`rect id=a x=1 colour=red
arrow from=a
move dx=5
circle id=c
style a fill=pinkish
text id=t x=0 y=0 text="offen`);
ok(bad.problems.length === 6, "6 Fehler erkannt: " + bad.problems.map(p => p.line + ":" + p.message).join(" | "));

const json = parse(JSON.stringify([{ cmd: "rect", id: "a", x: 0, y: 0, text: "A" }, { cmd: "move", targets: ["a"], dx: 5 }, { cmd: "draw", points: [[0,0],[5,5]] }]));
ok(json.problems.length === 0 && json.commands.length === 3, "JSON-Form: " + JSON.stringify(json.problems));

const fenced = parse("Gerne! Hier ist es:\n\n```udon\nrect id=a x=0 y=0\nmove a dx=x\n```\n\nViel Erfolg!");
ok(fenced.problems.length === 1 && fenced.problems[0].line === 5, "Text um den Code-Block wird ignoriert, Zeilennummer stimmt: " + JSON.stringify(fenced.problems));
const fenced2 = parse("```udon\nrect id=a x=0 y=0\nrect id=b right=a\n```");
ok(fenced2.problems.length === 0 && fenced2.commands.length === 2, "nur Code-Block: " + JSON.stringify(fenced2.problems));

const s = new Script();
(s as any).rect({ id: "a", x: 0, y: 0, text: "Ziel" });
(s as any).arrow({ from: "a", to: "b" });
(s as any).move(["a"], { dx: 5 });
ok(s.toString() === 'rect id=a x=0 y=0 text=Ziel\narrow from=a to=b\nmove a dx=5', "Script-Builder: " + JSON.stringify(s.toString()));
let threw = false; try { (s as any).rect({ id: "a b" }); } catch { threw = true; }
ok(threw, "Builder wirft bei ungültiger id");
ok(validate("view all").length === 0, "view all");
ok(reference().includes("### arrow") && buildPrompt({ task: "Mindmap", board: "rect id=x" }).includes("## Current board"), "Referenz und Prompt");
ok(buildPrompt({ board: "rect id=x" }).endsWith("answer with the complete corrected script.") && buildPrompt({ board: "rect id=x" }).includes("## Current board"), "ohne Aufgabe: KI wartet auf die Aufgabe");
ok(validate("convert a b to=ellipse").length === 0 && validate("convert a to=circle").length === 1, "convert");
console.log(failed === 0 ? "ALLE OK" : failed + " FEHLGESCHLAGEN");
process.exit(failed === 0 ? 0 : 1);
