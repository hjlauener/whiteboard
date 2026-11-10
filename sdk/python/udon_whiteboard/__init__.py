"""Udon Whiteboard Script – Python library.

Write, check and convert commands for the Udon Whiteboard (ILIAS plugin),
e.g. to build a board from a script or to check what an AI has written.
The result is pasted into the board ("Befehle" -> "Befehle ausführen").

    from udon_whiteboard import Script, parse, build_prompt

    s = Script()
    s.note(id="n1", x=0, y=0, text="Idee")
    s.rect(id="a", right="n1", text="Schritt 1", fill="light-blue")
    s.arrow(**{"from": "n1", "to": "a"})      # "from" is a Python keyword
    s.move("a", dx=20)
    print(s)                                   # script text

    result = parse(ai_answer)
    for p in result.problems:
        print(p.line, p.message)

The language is defined in spec.json, generated from the same specification
as the board and the JavaScript library (sdk/js/src/spec.ts).
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from importlib import resources
from typing import Any

__all__ = [
    "SPEC",
    "COMMANDS",
    "COLORS",
    "Problem",
    "ParseResult",
    "parse",
    "validate",
    "format_command",
    "format_script",
    "reference",
    "build_prompt",
    "Script",
]

SPEC: dict[str, Any] = json.loads(resources.files(__package__).joinpath("spec.json").read_text(encoding="utf-8"))
COMMANDS: dict[str, dict[str, Any]] = {c["name"]: c for c in SPEC["commands"]}
COLORS: dict[str, str] = SPEC["colors"]
_COLOR_NAMES = {v: k for k, v in COLORS.items()}
_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

__version__ = SPEC["version"]


@dataclass
class Problem:
    """A mistake in a script: 1-based line (0 for JSON input) and message."""

    line: int
    message: str


@dataclass
class ParseResult:
    commands: list[dict[str, Any]] = field(default_factory=list)
    lines: list[int] = field(default_factory=list)
    problems: list[Problem] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.problems


# ----------------------------------------------------------------------
# parsing
# ----------------------------------------------------------------------


def parse(text: str) -> ParseResult:
    """Parses a script (one command per line) or JSON (list of command objects)."""
    body = _strip_code_fence(text)
    trimmed = body.strip()
    if trimmed.startswith("[") or trimmed.startswith("{"):
        return _parse_json(trimmed)
    return _parse_script(body)


def validate(text: str) -> list[Problem]:
    """Checks a script; returns the problems (empty list = fine)."""
    return parse(text).problems


def _strip_code_fence(text: str) -> str:
    """Only the content of ``` code blocks counts (other lines become empty, line numbers stay)."""
    lines = text.splitlines()
    if not any(re.match(r"^\s*```", l) for l in lines):
        return text
    inside = False
    out = []
    for l in lines:
        if re.match(r"^\s*```", l):
            inside = not inside
            out.append("")
        else:
            out.append(l if inside else "")
    return "\n".join(out)


def _tokenize(raw: str, line: int, problems: list[Problem]) -> list[tuple[str | None, str]] | None:
    tokens: list[tuple[str | None, str]] = []
    i, s = 0, raw
    while i < len(s):
        while i < len(s) and s[i].isspace():
            i += 1
        if i >= len(s) or s[i] == "#":
            break
        key: str | None = None
        start = i
        while i < len(s) and not (s[i].isspace() or s[i] in '="'):
            i += 1
        word = s[start:i]
        if i < len(s) and s[i] == "=":
            key, word = word, ""
            i += 1
        if i < len(s) and s[i] == '"':
            i += 1
            text, closed = "", False
            while i < len(s):
                c = s[i]
                if c == "\\" and i + 1 < len(s):
                    n = s[i + 1]
                    text += "\n" if n == "n" else "\t" if n == "t" else n
                    i += 2
                    continue
                if c == '"':
                    closed = True
                    i += 1
                    break
                text += c
                i += 1
            if not closed:
                problems.append(Problem(line, 'Quotation mark " is not closed.'))
                return None
            word += text
        elif key is not None:
            start = i
            while i < len(s) and not s[i].isspace():
                i += 1
            word = s[start:i]
        tokens.append((key, word))
    return tokens


def _parse_script(script: str) -> ParseResult:
    result = ParseResult()
    for index, raw in enumerate(script.splitlines()):
        line = index + 1
        tokens = _tokenize(raw, line, result.problems)
        if not tokens:
            continue
        name = tokens[0][1].lower()
        command: dict[str, Any] = {"cmd": name}
        targets: list[str] = []
        for key, value in tokens[1:]:
            if key is None:
                targets.append(value)
            else:
                command[key.lower()] = value
        if targets:
            command["targets"] = targets
        checked = _check(command, line, result.problems)
        if checked is not None:
            result.commands.append(checked)
            result.lines.append(line)
    return result


def _parse_json(text: str) -> ParseResult:
    result = ParseResult()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        result.problems.append(Problem(0, f"Invalid JSON: {e}"))
        return result
    items = data if isinstance(data, list) else data.get("commands") if isinstance(data, dict) else None
    if not isinstance(items, list):
        result.problems.append(Problem(0, 'JSON must be an array of commands or {"commands": [...]}.'))
        return result
    for index, item in enumerate(items):
        line = index + 1
        if not isinstance(item, dict) or not isinstance(item.get("cmd"), str):
            result.problems.append(Problem(line, 'Each command needs "cmd".'))
            continue
        command: dict[str, Any] = {"cmd": item["cmd"].lower()}
        for k, v in item.items():
            if k == "cmd":
                continue
            if k == "targets":
                command["targets"] = [str(t) for t in v] if isinstance(v, list) else [str(v)]
            elif k == "points" and isinstance(v, list):
                command["points"] = " ".join(f"{p[0]},{p[1]}" if isinstance(p, (list, tuple)) else str(p) for p in v)
            elif isinstance(v, bool):
                command[k.lower()] = "yes" if v else "no"
            else:
                command[k.lower()] = str(v)
        checked = _check(command, line, result.problems)
        if checked is not None:
            result.commands.append(checked)
            result.lines.append(line)
    return result


# ----------------------------------------------------------------------
# checking
# ----------------------------------------------------------------------


def _check(command: dict[str, Any], line: int, problems: list[Problem]) -> dict[str, Any] | None:
    spec = COMMANDS.get(command["cmd"])
    if spec is None:
        problems.append(Problem(line, f'Unknown command "{command["cmd"]}". Known: {", ".join(COMMANDS)}.'))
        return None
    name = spec["name"]
    ok = True
    out: dict[str, Any] = {"cmd": name}

    targets = command.get("targets", [])
    t_spec = spec.get("targets")
    if t_spec is None:
        if targets:
            problems.append(Problem(line, f'{name}: unexpected "{" ".join(targets)}" (use key=value).'))
            ok = False
    else:
        if len(targets) < t_spec["min"]:
            problems.append(Problem(line, f"{name}: needs at least {t_spec['min']} element id(s) after the command."))
            ok = False
        if "max" in t_spec and len(targets) > t_spec["max"]:
            problems.append(Problem(line, f"{name}: at most {t_spec['max']} element id(s)."))
            ok = False
        for t in targets:
            if not _ID.match(t):
                problems.append(Problem(line, f'{name}: "{t}" is not a valid id (letters, digits, - and _).'))
                ok = False
        if targets:
            out["targets"] = targets

    params = {p["name"]: p for p in spec["params"]}
    for key, raw in command.items():
        if key in ("cmd", "targets"):
            continue
        param = params.get(key)
        if param is None:
            allowed = ", ".join(params) or "none"
            problems.append(Problem(line, f'{name}: unknown parameter "{key}". Allowed: {allowed}.'))
            ok = False
            continue
        value, error = _convert(param, str(raw))
        if error:
            problems.append(Problem(line, f"{name}: {key}={raw} – {error}"))
            ok = False
        else:
            out[key] = value
    for p in spec["params"]:
        if p.get("required") and p["name"] not in out and p["name"] not in command:
            problems.append(Problem(line, f'{name}: parameter "{p["name"]}" is required.'))
            ok = False
    if ok:
        error = _check_combinations(spec, out)
        if error:
            problems.append(Problem(line, f"{name}: {error}"))
            ok = False
    return out if ok else None


def _convert(param: dict[str, Any], raw: str) -> tuple[Any, str | None]:
    kind = param["type"]
    if kind == "number":
        try:
            n = float(raw)
        except ValueError:
            return None, "expected a number."
        if not math.isfinite(n) or raw.strip() == "":
            return None, "expected a number."
        if "min" in param and n < param["min"]:
            return None, f"must be at least {param['min']}."
        if "max" in param and n > param["max"]:
            return None, f"must be at most {param['max']}."
        return (int(n) if n.is_integer() else n), None
    if kind == "id":
        return (raw, None) if _ID.match(raw) else (None, "not a valid id (letters, digits, - and _).")
    if kind == "color":
        name = raw.lower()
        if name in COLORS:
            return COLORS[name], None
        if re.fullmatch(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})", raw):
            return raw.lower(), None
        return None, f"unknown colour. Use #rrggbb or one of: {', '.join(COLORS)}."
    if kind == "enum":
        for v in param["values"]:
            if v.lower() == raw.lower():
                return v, None
        return None, f"expected one of: {', '.join(param['values'])}."
    if kind == "boolean":
        v = raw.lower()
        if v in ("yes", "true", "1", "on"):
            return True, None
        if v in ("no", "false", "0", "off"):
            return False, None
        return None, "expected yes or no."
    if kind == "points":
        try:
            pairs = [[float(n) for n in p.split(",")] for p in raw.split()]
        except ValueError:
            pairs = []
        if len(pairs) < 2 or any(len(p) != 2 for p in pairs):
            return None, 'expected at least two points "x,y x,y".'
        return [(p[0], p[1]) for p in pairs], None
    return raw, None


def _check_combinations(spec: dict[str, Any], c: dict[str, Any]) -> str | None:
    name = spec["name"]
    relative = [k for k in ("right", "left", "below", "above") if k in c]
    if len(relative) > 1:
        return "use only one of right/left/below/above."
    if relative and ("x" in c or "y" in c):
        return f"use either {relative[0]} or x/y."
    if name == "arrow":
        if "from" not in c and not ("x1" in c and "y1" in c):
            return "needs from=… or x1/y1."
        if "to" not in c and not ("x2" in c and "y2" in c):
            return "needs to=… or x2/y2."
    if name == "line" and "points" not in c and not ("from" in c and "to" in c):
        return 'needs points="…" or from/to.'
    if name == "move":
        absolute = "x" in c or "y" in c
        if not absolute and not relative and "dx" not in c and "dy" not in c:
            return "needs dx/dy, x/y or right/left/below/above."
        if (absolute or relative) and len(c.get("targets", [])) > 1:
            return "x/y and right/left/below/above work for one element only; use dx/dy for several."
    if name == "resize" and "w" not in c and "h" not in c:
        return "needs w and/or h."
    if name == "style" and not any(p["name"] in c for p in spec["params"]):
        return "give at least one style parameter."
    if name == "font" and not any(k in c for k in ("font", "size", "align")):
        return "give font, size or align."
    return None


# ----------------------------------------------------------------------
# writing
# ----------------------------------------------------------------------


def format_command(command: dict[str, Any]) -> str:
    """Writes one command (dict with "cmd", optional "targets") as a script line."""
    spec = COMMANDS.get(command["cmd"], {"params": []})
    kinds = {p["name"]: p["type"] for p in spec["params"]}
    parts = [command["cmd"], *command.get("targets", [])]
    for key, value in command.items():
        if key in ("cmd", "targets") or value is None:
            continue
        if kinds.get(key) == "color" and isinstance(value, str):
            value = _COLOR_NAMES.get(value.lower(), value)
        parts.append(f"{key}={_format_value(value)}")
    return " ".join(parts)


def _format_value(value: Any) -> str:
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, (int, float)):
        r = round(value, 2)
        return str(int(r)) if float(r).is_integer() else str(r)
    if isinstance(value, (list, tuple)):
        return '"' + " ".join(f"{round(p[0])},{round(p[1])}" for p in value) + '"'
    s = str(value)
    if s and re.fullmatch(r'#?[^\s"#=\\]+', s):
        return s
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n") + '"'


def format_script(commands: list[dict[str, Any]]) -> str:
    """Writes commands as a script."""
    return "\n".join(format_command(c) for c in commands)


# ----------------------------------------------------------------------
# reference and prompt
# ----------------------------------------------------------------------


def reference() -> str:
    """The language reference as Markdown (same text as in the board)."""
    return resources.files(__package__).joinpath("reference.md").read_text(encoding="utf-8").rstrip("\n")


def build_prompt(task: str = "", board: str = "") -> str:
    """The prompt that makes any AI answer with valid commands (same as in the board)."""
    head = resources.files(__package__).joinpath("prompt_head.md").read_text(encoding="utf-8").rstrip("\n")
    out = [head, ""]
    if board.strip():
        out += [
            "## Current board",
            "These commands describe what is on the board now (use these ids to change existing elements; do not create them again):",
            "```udon",
            board.strip(),
            "```",
            "",
        ]
    out += ["## Task"]
    # no task yet: the prompt is pasted into an AI chat and the task follows there
    out += [task.strip()] if task.strip() else _WAIT_FOR_TASK
    return "\n".join(out)


_WAIT_FOR_TASK = [
    "The user gives the task in the next message, in any language. Reply to this message only with: OK – describe your task.",
    "Then answer every task with a ```udon code block as described above. If the user sends error messages from the board, answer with the complete corrected script.",
]


# ----------------------------------------------------------------------
# building scripts
# ----------------------------------------------------------------------


class Script:
    """Builds a script step by step; every command is a method.

    Positional arguments are the element ids (targets), keyword arguments the
    parameters: ``s.move("a", "b", dx=10)``. Each command is checked when it
    is added; a mistake raises ValueError with the reason.
    """

    def __init__(self) -> None:
        self.commands: list[dict[str, Any]] = []

    def add(self, name: str, *targets: str, **params: Any) -> "Script":
        command: dict[str, Any] = {"cmd": name}
        if targets:
            command["targets"] = list(targets)
        command.update({k: v for k, v in params.items() if v is not None})
        result = parse(format_command(command))
        if result.problems:
            raise ValueError("\n".join(p.message for p in result.problems))
        self.commands.extend(result.commands)
        return self

    def __getattr__(self, name: str):
        if name in COMMANDS:
            return lambda *targets, **params: self.add(name, *targets, **params)
        raise AttributeError(name)

    def to_json(self) -> list[dict[str, Any]]:
        return [dict(c) for c in self.commands]

    def __str__(self) -> str:
        return format_script(self.commands)
