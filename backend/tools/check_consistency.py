"""
League of Legals — consistency audit.

    python backend/tools/check_consistency.py

The site's one claim is that it publishes its method. That claim fails the
moment the method described on the page stops matching the method the scorer
ran — and it fails silently, because nothing crashes when a weight is changed
in one file and not the other.

So this compares every place the same fact is stated and exits non-zero when
they disagree. It runs as the last stage of update.py, which means a run that
would have shipped a contradiction stops instead.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_METHOD = ROOT / "backend/pipelines/rankings/methodology.json"
FRONTEND_METHOD = ROOT / "frontend/src/lib/fixtures/methodology.ts"
RANKINGS = ROOT / "frontend/src/data/rankings.json"
SITE = ROOT / "frontend/src/lib/site.ts"

failures: list[str] = []
notes: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {label}{('  — ' + detail) if detail and not ok else ''}")
    if not ok:
        failures.append(f"{label}: {detail}")


def main() -> int:
    backend = json.loads(BACKEND_METHOD.read_text("utf-8"))
    ts = FRONTEND_METHOD.read_text(encoding="utf-8")
    rankings = json.loads(RANKINGS.read_text("utf-8"))
    site = SITE.read_text(encoding="utf-8")

    print("methodology")
    bv = backend["version"]
    fv = re.search(r'version: "([^"]+)"', ts).group(1)
    rv = rankings.get("methodologyVersion")
    check("version matches across backend, page and data",
          bv == fv == rv, f"backend={bv} page={fv} data={rv}")

    bw = {s["key"]: s["weight"] for s in backend["signals"]}
    keys = re.findall(r'key: "(\w+)"', ts)
    weights = [float(x) for x in re.findall(r"weight: ([\d.]+),", ts)]
    fw = dict(zip(keys, weights))
    check("signal weights match the published page", bw == fw, f"{bw} vs {fw}")
    check("weights sum to 1", abs(sum(bw.values()) - 1.0) < 1e-9,
          f"sum={sum(bw.values())}")

    evidence_keys = set(rankings["jurisdictions"][0]["evidence"])
    check("evidence keys match signal keys", evidence_keys == set(bw),
          f"{sorted(evidence_keys)} vs {sorted(bw)}")

    print("\nranking claims")
    published = [j for j in rankings["jurisdictions"] if j["status"] == "ranked"]
    for j in rankings["jurisdictions"]:
        reconciled = sum(1 for f in j["firms"] if f.get("consensus") is not None)
        stated = j["methodology"]["reconciledFirms"]
        if reconciled != stated:
            failures.append(f"{j['slug']}: {reconciled} reconciled but page says {stated}")
    check("each jurisdiction's stated reconciled count matches its firms",
          not any("reconciled but page says" in f for f in failures))

    for j in rankings["jurisdictions"]:
        ranked_firms = [f for f in j["firms"] if f.get("rank")]
        if ranked_firms and j["methodology"]["reconciledFirms"] == 0:
            failures.append(f"{j['slug']}: firms carry ranks but methodology says none")
    check("no jurisdiction ranks firms it says it cannot rank",
          not any("carry ranks" in f for f in failures))

    print("\nbrand and domain")
    url = re.search(r'url: "([^"]+)"', site).group(1)
    name = re.search(r'name: "([^"]+)"', site).group(1)
    check("canonical host is the www host that the apex redirects to",
          url.startswith("https://www."), url)
    check("no stale brand name anywhere in src",
          not any("Legal League" in p.read_text(encoding="utf-8")
                  for p in (ROOT / "frontend/src").rglob("*.ts*")),
          "'Legal League' still present")
    notes.append(f"publication: {name} at {url}")

    print("\ndata freshness")
    for label, path in [("rankings", RANKINGS),
                        ("news", ROOT / "frontend/src/data/news.json"),
                        ("importance", ROOT / "frontend/src/data/news_importance.json")]:
        if path.exists():
            stamp = json.loads(path.read_text("utf-8")).get("generatedAt", "?")
            print(f"  ..   {label} generated {stamp[:16]}")

    print()
    for note in notes:
        print(f"  {note}")
    if failures:
        print(f"\n{len(failures)} inconsistency(ies):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("\nconsistent: the method published is the method that ran")
    return 0


if __name__ == "__main__":
    print("League of Legals consistency audit\n")
    sys.exit(main())
