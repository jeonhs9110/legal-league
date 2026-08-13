"""
League of Legals — the daily update.

    python backend/update.py                  # everything
    python backend/update.py --news-only      # news and briefs
    python backend/update.py --firms-only     # directory, details, recognitions
    python backend/update.py --dry-run        # show the plan, run nothing

One command, run when you say "update". It collects the new news, rebuilds the
briefs, refreshes the directory, pulls court records, rebuilds the rankings —
and then, the part that matters, tells you what actually CHANGED.

A pipeline that prints "done" teaches you nothing. This snapshots the ranking
inputs before the run and diffs them after, so the report says which firms
entered or left a jurisdiction, whose published headcount moved, which firms
gained or lost external recognition, and whether any jurisdiction crossed the
evidence threshold that would let a ranking be published at all. Those are the
things you would otherwise have to notice by eye across 35 jurisdictions, and
you would not notice them.

Stages run in dependency order and a failure is reported, not fatal: if the
news collector dies, the directory refresh still runs. Each stage is skippable,
because on most days you do not need to re-crawl 352 firm websites.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
DATA = REPO / "frontend" / "src" / "data"
HISTORY = ROOT / "data" / "update_history.jsonl"

PY = sys.executable


class Stage:
    def __init__(self, key: str, title: str, script: str,
                 args: list[str] | None = None, group: str = "all"):
        self.key, self.title, self.script = key, title, script
        self.args = args or []
        self.group = group


STAGES = [
    Stage("news", "Collect news from permitted feeds",
          "pipelines/news/fetch_news.py", group="news"),
    Stage("briefs", "Cluster coverage and write briefs",
          "pipelines/news/synthesize.py", ["--write"], group="news"),
    Stage("importance", "Score article importance and pick the highlights",
          "pipelines/news/score_importance.py", group="news"),
    Stage("courts", "Collect court and ministry records",
          "pipelines/courts/fetch_court_records.py", group="courts"),
    Stage("firms", "Refresh firm details from firms' own sites",
          "pipelines/directory/fetch_firm_details.py", group="firms"),
    Stage("awards", "Refresh external recognition",
          "pipelines/directory/fetch_firm_awards.py", group="firms"),
    Stage("rankings", "Rebuild rankings from current evidence",
          "pipelines/rankings/build_rankings.py", group="firms"),
    Stage("guides", "Collect practice guides published by firms",
          "pipelines/directory/fetch_practice_guides.py", group="firms"),
    # Last, and deliberately so: a run that would ship a method the page does
    # not describe should end in a failure, not a deploy.
    Stage("consistency", "Verify the published method matches the one that ran",
          "tools/check_consistency.py", group="all"),
]


def log(message: str = "") -> None:
    print(message, flush=True)


def load(name: str) -> dict:
    path = DATA / name
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text("utf-8"))
    except json.JSONDecodeError:
        return {}


def snapshot() -> dict:
    """
    Everything the change report needs to compare against, flattened so the
    diff is a set operation rather than a tree walk.
    """
    rankings = load("rankings.json")
    details = load("firm_details.json")
    awards = load("firm_awards.json")
    news = load("news.json")
    briefs = load("briefs.json")
    courts = load("court_records.json")

    firms_by_jurisdiction: dict[str, set] = {}
    scores: dict[str, float] = {}
    published: set[str] = set()
    for jurisdiction in rankings.get("jurisdictions", []):
        slug = jurisdiction.get("slug", "")
        names = {f.get("name") for f in jurisdiction.get("firms") or []}
        firms_by_jurisdiction[slug] = names
        if jurisdiction.get("published"):
            published.add(slug)
        for firm in jurisdiction.get("firms") or []:
            if firm.get("score") is not None:
                scores[f"{slug}/{firm.get('name')}"] = firm["score"]

    return {
        "firmsByJurisdiction": firms_by_jurisdiction,
        "scores": scores,
        "published": published,
        "headcounts": {f["name"]: f.get("headcount")
                       for f in details.get("firms", []) if f.get("headcount")},
        "contactable": {f["name"] for f in details.get("firms", [])
                        if f.get("phones") or f.get("emails")},
        "recognitions": {f["name"]: len(f.get("recognitions") or [])
                         for f in awards.get("firms", [])},
        "articleIds": {a["id"] for a in news.get("articles", [])},
        "briefIds": {b["id"] for b in briefs.get("briefs", [])},
        "courtIds": {r["id"] for r in courts.get("records", [])},
    }


def diff(before: dict, after: dict) -> list[str]:
    """The change report. Only differences; silence means nothing moved."""
    lines: list[str] = []

    new_articles = after["articleIds"] - before["articleIds"]
    new_briefs = after["briefIds"] - before["briefIds"]
    new_courts = after["courtIds"] - before["courtIds"]
    if new_articles:
        lines.append(f"{len(new_articles)} new articles "
                     f"({len(after['articleIds'])} in the corpus)")
    if new_briefs:
        lines.append(f"{len(new_briefs)} new briefs written")
    if new_courts:
        lines.append(f"{len(new_courts)} new court records")

    # Directory movement, per jurisdiction.
    for slug in sorted(set(before["firmsByJurisdiction"]) | set(after["firmsByJurisdiction"])):
        was = before["firmsByJurisdiction"].get(slug, set())
        now = after["firmsByJurisdiction"].get(slug, set())
        entered, left = now - was, was - now
        if entered:
            lines.append(f"{slug}: +{len(entered)} firms — {', '.join(sorted(entered)[:5])}"
                         + ("…" if len(entered) > 5 else ""))
        if left:
            lines.append(f"{slug}: -{len(left)} firms — {', '.join(sorted(left)[:5])}"
                         + ("…" if len(left) > 5 else ""))

    # The headline event: a jurisdiction crossing into publishable.
    newly_published = after["published"] - before["published"]
    unpublished = before["published"] - after["published"]
    for slug in sorted(newly_published):
        lines.append(f"** {slug}: ranking now PUBLISHED — evidence threshold met")
    for slug in sorted(unpublished):
        lines.append(f"** {slug}: ranking WITHDRAWN — evidence fell below threshold")

    # Score movement on already-published rankings.
    for key in sorted(set(before["scores"]) | set(after["scores"])):
        old, new = before["scores"].get(key), after["scores"].get(key)
        if old is None and new is not None:
            lines.append(f"score: {key} scored {new} for the first time")
        elif old is not None and new is not None and abs(new - old) >= 0.5:
            lines.append(f"score: {key} {old} -> {new}")

    for name in sorted(set(before["headcounts"]) | set(after["headcounts"])):
        old, new = before["headcounts"].get(name), after["headcounts"].get(name)
        if old != new and new is not None:
            lines.append(f"headcount: {name} "
                         f"{old if old is not None else 'none'} -> {new}")

    gained = after["contactable"] - before["contactable"]
    if gained:
        lines.append(f"{len(gained)} firms gained contact details")

    for name in sorted(set(before["recognitions"]) | set(after["recognitions"])):
        old = before["recognitions"].get(name, 0)
        new = after["recognitions"].get(name, 0)
        if new != old:
            lines.append(f"recognition: {name} {old} -> {new}")

    return lines


def run_stage(stage: Stage, dry: bool) -> tuple[bool, float, str]:
    script = ROOT / stage.script
    if not script.exists():
        return False, 0.0, "script not found"
    if dry:
        return True, 0.0, "dry run"

    started = time.monotonic()
    try:
        result = subprocess.run(
            [PY, str(script), *stage.args],
            cwd=str(REPO), capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=7200,
        )
    except subprocess.TimeoutExpired:
        return False, time.monotonic() - started, "timed out after 2h"

    elapsed = time.monotonic() - started
    if result.returncode != 0:
        tail = (result.stderr or result.stdout or "").strip().splitlines()
        return False, elapsed, (tail[-1][:160] if tail else f"exit {result.returncode}")

    # Last meaningful line of the stage's own reporting.
    lines = [l.strip() for l in (result.stdout or "").splitlines() if l.strip()]
    summary = next((l for l in reversed(lines) if not l.startswith("wrote ->")), "")
    return True, elapsed, summary[:160]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--news-only", action="store_true")
    parser.add_argument("--firms-only", action="store_true")
    parser.add_argument("--courts-only", action="store_true")
    parser.add_argument("--skip", default="", help="comma-separated stage keys")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    groups = {"all"}
    if args.news_only:
        groups = {"news"}
    elif args.firms_only:
        groups = {"firms"}
    elif args.courts_only:
        groups = {"courts"}

    skip = {s.strip() for s in args.skip.split(",") if s.strip()}
    stages = [s for s in STAGES
              if (groups == {"all"} or s.group in groups) and s.key not in skip]

    started = datetime.now(timezone.utc)
    log(f"League of Legals update — {started:%Y-%m-%d %H:%M} UTC")
    log(f"{len(stages)} stages" + (" (dry run)" if args.dry_run else ""))
    log()

    before = snapshot()
    results = []

    for index, stage in enumerate(stages, 1):
        log(f"[{index}/{len(stages)}] {stage.title}")
        ok, elapsed, note = run_stage(stage, args.dry_run)
        results.append((stage, ok, elapsed))
        mark = "ok " if ok else "FAILED"
        log(f"        {mark} {elapsed:>6.0f}s  {note}")
        log()

    after = snapshot()
    changes = diff(before, after)

    log("=" * 68)
    log("WHAT CHANGED")
    log("=" * 68)
    if changes:
        for line in changes:
            log(f"  {line}")
    else:
        log("  Nothing. No new articles, no directory movement, no score change.")
    log()

    failed = [s.key for s, ok, _ in results if not ok]
    total = sum(e for _, _, e in results)
    log(f"{len(results) - len(failed)}/{len(results)} stages ok in {total / 60:.1f} min")
    if failed:
        log(f"failed: {', '.join(failed)}")

    if not args.dry_run:
        HISTORY.parent.mkdir(parents=True, exist_ok=True)
        with HISTORY.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({
                "startedAt": started.isoformat().replace("+00:00", "Z"),
                "durationSeconds": round(total),
                "stages": {s.key: ok for s, ok, _ in results},
                "changes": changes,
            }, ensure_ascii=False) + "\n")
        log(f"logged -> {HISTORY.relative_to(REPO)}")

    log()
    log("Next: cd frontend && npm run build")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
