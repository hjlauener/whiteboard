"""Tests: python3 -m unittest discover sdk/python/tests (from the repository root)."""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from udon_whiteboard import Script, build_prompt, format_script, parse, reference, validate  # noqa: E402

SCRIPT = """# Mindmap
note id=thema x=0 y=0 text="Rechtsstaat"
rect id=a below=thema gap=80 text="Gewaltenteilung" fill=light-blue
rect id=b right=a text="Grund-\\nrechte"
arrow from=thema to=a text="führt zu"
move a b dx=10
group a b id=g1
undo"""


class LanguageTest(unittest.TestCase):
    def test_valid_script(self):
        r = parse(SCRIPT)
        self.assertEqual(r.problems, [])
        self.assertEqual(len(r.commands), 7)
        self.assertEqual(r.lines[0], 2)
        self.assertEqual(r.commands[1]["fill"], "#a5d8ff")
        self.assertEqual(r.commands[2]["text"], "Grund-\nrechte")
        self.assertEqual(r.commands[4]["targets"], ["a", "b"])
        self.assertEqual(r.commands[4]["dx"], 10)

    def test_round_trip(self):
        r = parse(SCRIPT)
        self.assertEqual(parse(format_script(r.commands)).commands, r.commands)

    def test_errors(self):
        bad = parse('rect id=a x=1 colour=red\narrow from=a\nmove dx=5\ncircle id=c\nstyle a fill=pinkish\ntext id=t x=0 y=0 text="offen')
        self.assertEqual(len(bad.problems), 6, bad.problems)
        self.assertEqual([p.line for p in bad.problems], [1, 2, 3, 4, 5, 6])

    def test_json_and_fence(self):
        j = parse(json.dumps([{"cmd": "rect", "id": "a", "x": 0, "y": 0}, {"cmd": "move", "targets": ["a"], "dx": 5}, {"cmd": "draw", "points": [[0, 0], [5, 5]]}]))
        self.assertEqual(j.problems, [])
        self.assertEqual(len(parse("```udon\nrect id=a x=0 y=0\nrect id=b right=a\n```").commands), 2)
        prose = parse("Gerne! Hier ist es:\n\n```udon\nrect id=a x=0 y=0\nmove a dx=x\n```\n\nViel Erfolg!")
        self.assertEqual([p.line for p in prose.problems], [5])

    def test_builder(self):
        s = Script()
        s.rect(id="a", x=0, y=0, text="Ziel", fill="light-blue")
        s.arrow(**{"from": "a", "to": "b"})
        s.move("a", dx=5)
        self.assertEqual(str(s), "rect id=a x=0 y=0 text=Ziel fill=light-blue\narrow from=a to=b\nmove a dx=5")
        with self.assertRaises(ValueError):
            s.rect(id="a b")

    def test_same_as_javascript(self):
        # reference and prompt come from the same specification as the board
        self.assertIn("### arrow", reference())
        p = build_prompt("Mindmap", "rect id=x")
        self.assertIn("## Current board", p)
        self.assertTrue(p.endswith("Mindmap"))
        self.assertEqual(validate("view all"), [])
        self.assertEqual(validate("convert a b to=ellipse"), [])
        self.assertEqual(len(validate("convert a to=circle")), 1)
        waiting = build_prompt(board="rect id=x")
        self.assertIn("OK – describe your task.", waiting)
        self.assertTrue(waiting.endswith("answer with the complete corrected script."))


if __name__ == "__main__":
    unittest.main()
