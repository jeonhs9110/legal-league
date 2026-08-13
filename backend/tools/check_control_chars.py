"""Replace smuggled control characters with the regex escapes that were meant."""
from pathlib import Path

ROOT = Path(r"c:/Users/jeonh/OneDrive/Documentos/Judicature")
REPLACEMENTS = {
    "\x08": "\\b",   # word boundary
    "\x07": "\\a",
    "\x0c": "\\f",
    "\x0b": "\\v",
}

targets = list((ROOT / "backend").rglob("*.py")) + \
          list((ROOT / "frontend/src").rglob("*.ts")) + \
          list((ROOT / "frontend/src").rglob("*.tsx"))

for path in targets:
    if "scratchpad" in str(path):
        continue
    text = path.read_text(encoding="utf-8")
    original = text
    for ch, escape in REPLACEMENTS.items():
        if ch in text:
            print(f"  {path.relative_to(ROOT)}: {text.count(ch)}x -> {escape}")
            text = text.replace(ch, escape)
    if text != original:
        path.write_text(text, encoding="utf-8")

# Verify nothing remains.
remaining = []
for path in targets:
    if "scratchpad" in str(path):
        continue
    t = path.read_text(encoding="utf-8")
    if any(c in t for c in REPLACEMENTS):
        remaining.append(path)
print("remaining files with control characters:", remaining or "none")
