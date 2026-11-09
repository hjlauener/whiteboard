# Udon Whiteboard Script – Bibliotheken für KIs und Programme

Das Udon Whiteboard hat eine eigene Befehlssprache, **Udon Whiteboard Script**:
ein Befehl pro Zeile, für jede Aktion auf dem Board ein Befehl (Formen,
Notizzettel, Text, Pfeile mit Bindung, Linien, Freihand, Rahmen, Verschieben,
Grösse, Drehen, Stil, Text, Schrift, Löschen, Link, Sperren, Gruppieren,
Ebenen, Ausrichten, Verteilen, Auswahl, Ansicht, Rückgängig/Wiederholen).

```udon
note id=topic x=0 y=0 text="Gewaltenteilung"
rect id=leg right=topic gap=120 text="Legislative" fill=light-blue
rect id=exe below=leg gap=40 text="Exekutive" fill=light-green
arrow from=topic to=leg
arrow from=topic to=exe
group leg exe id=gewalten
```

Ausgeführt werden die Befehle **im Board**: Knopf **Befehle** oben rechts →
einfügen → „Ausführen“. „Für eine KI kopieren“ liefert den passenden Text für
eine beliebige KI. Von aussen ist
das Board nicht erreichbar; die Bibliotheken hier **schreiben und prüfen**
Skripte, die dann im Board eingefügt werden.

| Ordner | Inhalt |
|---|---|
| [`spec/`](spec/) | Die Sprache als Daten und Text: [`LANGUAGE.md`](spec/LANGUAGE.md) (Referenz), [`PROMPT.md`](spec/PROMPT.md) (Prompt für KIs), [`commands.json`](spec/commands.json), [`udon-whiteboard-script.schema.json`](spec/udon-whiteboard-script.schema.json) (JSON Schema der JSON-Form) |
| [`js/`](js/) | JavaScript/TypeScript-Bibliothek (`dist/` gebaut, `src/` Quelle; die Quelle der Sprache ist `js/src/spec.ts`) |
| [`python/`](python/) | Python-Bibliothek `udon_whiteboard` (ohne Abhängigkeiten, Python ≥ 3.9) |
| [`mcp/`](mcp/) | MCP-Server für KI-Programme (`dist/server.mjs`, eine Datei, Node ≥ 18) |

Alles wird aus **einer** Spezifikation erzeugt (`js/src/spec.ts`), genau wie
die Referenz und der Prompt im Board: `./dev/npm.sh run build`.

## Zwei Schreibweisen

Skript (für Menschen und KIs):

```udon
move a b dx=50
style a fill=light-red stroke=red
```

JSON (für Programme, Schema in `spec/`):

```json
[{"cmd": "move", "targets": ["a", "b"], "dx": 50},
 {"cmd": "style", "targets": ["a"], "fill": "light-red", "stroke": "red"}]
```

Beides kann im Board eingefügt werden. Antworten von KIs dürfen in einem
```` ``` ````-Block stehen; Text davor und danach wird ignoriert.

## JavaScript / TypeScript

```js
import { Script, parse, validate, buildPrompt, reference } from "./sdk/js/dist/index.js";

const s = new Script();
s.note({ id: "n1", x: 0, y: 0, text: "Idee" });
s.rect({ id: "a", right: "n1", text: "Schritt 1", fill: "light-blue" });
s.arrow({ from: "n1", to: "a" });
s.move(["a"], { dx: 20 });          // Ziel-ids als Liste, dann Parameter
console.log(s.toString());          // Skript zum Einfügen

const result = parse(aiAnswer);     // { commands, lines, problems }
for (const p of result.problems) console.log(p.line, p.message);

const prompt = buildPrompt({ task: "Mindmap zur Gewaltenteilung" });
```

Jeder Befehl ist eine Methode von `Script` und wird beim Hinzufügen geprüft
(Fehler → Exception mit Grund).

## Python

```python
import sys; sys.path.insert(0, "sdk/python")     # oder: pip install sdk/python
from udon_whiteboard import Script, parse, build_prompt

s = Script()
s.note(id="n1", x=0, y=0, text="Idee")
s.rect(id="a", right="n1", text="Schritt 1", fill="light-blue")
s.arrow(**{"from": "n1", "to": "a"})             # "from" ist in Python reserviert
s.move("a", dx=20)                               # Ziel-ids zuerst, dann Parameter
print(s)

for p in parse(ai_answer).problems:
    print(p.line, p.message)

print(build_prompt("Mindmap zur Gewaltenteilung"))
```

Tests: `python3 -m unittest discover -s sdk/python/tests`

## MCP-Server

Für KI-Programme mit MCP (z.B. Claude Desktop, Claude Code, Cursor,
ChatGPT-Desktop mit MCP). Werkzeuge:

| Werkzeug | Wozu |
|---|---|
| `whiteboard_language` | Referenz der Sprache |
| `whiteboard_validate` | Skript prüfen; Fehler mit Zeilennummer oder das bereinigte Skript |
| `whiteboard_from_json` | Befehle als JSON → geprüftes Skript |
| `whiteboard_prompt` | Kompletter Prompt (Regeln, Referenz, Board, Aufgabe) für eine andere KI |

Dazu der Prompt `draw_on_whiteboard` und die Ressource
`udon-whiteboard://language`.

Einrichten (Beispiel Claude Desktop, `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "udon-whiteboard": {
      "command": "node",
      "args": ["/Pfad/zu/UdonWhiteboard/sdk/mcp/dist/server.mjs"]
    }
  }
}
```

Claude Code:

```bash
claude mcp add udon-whiteboard -- node /Pfad/zu/UdonWhiteboard/sdk/mcp/dist/server.mjs
```

Die KI schreibt und prüft damit das Skript; Sie fügen es im Board ein.

## Lizenz

Die Bibliotheken in `sdk/` stehen unter der MIT-Lizenz. Der gebündelte
MCP-Server enthält das MCP-SDK (MIT) und zod (MIT).
