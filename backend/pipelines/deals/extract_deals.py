"""
Legal League — deal extraction.

Third pillar, alongside news and rankings: the significant matters and deals
law firms advised on, bucketed by quarter across 2025 and 2026.

    python backend/pipelines/deals/extract_deals.py
    python backend/pipelines/deals/extract_deals.py --limit 40

Reads the news corpus, asks the model to identify articles that report a real
transaction or matter, and pulls a structured record from each. Every value is
normalised to USD at extraction time so the front end never converts — a deal
table that mixes GBP, INR and USD is unreadable in any language, and doing the
conversion once at ingest means the Chinese, Korean and Japanese renderings all
show the same number.

Two rules that shape the whole file:

  * A deal is recorded only when the article names at least one law firm as
    adviser. Without that it is business news, not legal news, and it belongs
    in the news feed rather than here.
  * Every field traces to the article it came from. Nothing is inferred from
    the model's own knowledge — the prompt says so explicitly and the source
    URL rides on every record, because a deal table asserting a firm advised
    on a transaction is a factual claim about a real business.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except ImportError:
    pass

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
NEWS_FILE = REPO / "frontend" / "src" / "data" / "news.json"
OUTPUT_FILE = REPO / "frontend" / "src" / "data" / "deals.json"
# Bodies the archive backfill already stored privately. Headline plus a
# 320-char excerpt cannot tell you which firm advised which party; the body
# can. Read from staging, never published.
BODY_DIRS = [ROOT / "data" / "raw" / "archive", ROOT / "data" / "raw" / "articles"]

ARCHIVE_CUTOFF = "2026-04-01"
ARCHIVE_MODEL = "gpt-4o-mini"
CURRENT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Indicative rates, applied at extraction so the stored figure is always USD.
# Deliberately static: a deal announced in Q1 2025 should not change value on
# the page because a rate moved. Recorded alongside each figure so the
# conversion is auditable rather than magic.
FX_TO_USD = {
    "USD": 1.00, "GBP": 1.27, "EUR": 1.09, "INR": 0.012,
    "KRW": 0.00072, "JPY": 0.0065, "CNY": 0.14, "SGD": 0.74,
    "AUD": 0.66, "HKD": 0.128, "CAD": 0.73,
}

SHAPE = {
    "is_deal": True,
    "headline": "short neutral description of the transaction",
    "deal_type": "M&A | financing | IPO | restructuring | litigation | regulatory | other",
    "parties": ["party one", "party two"],
    "value_amount": 0,
    "value_currency": "USD",
    "advising_firms": [{"firm": "firm name", "acting_for": "which party"}],
    "jurisdiction": "country or market",
    "announced_on": "YYYY-MM-DD",
}

SYSTEM = (
    "You extract structured deal records from legal trade press. You report only "
    "what the article states. You never infer a value, a party, or an advising "
    "firm from your own knowledge, and you never guess. If the article does not "
    "name at least one law firm advising on the matter, it is not a deal record."
)


def log(message: str) -> None:
    print(f"  {message}", flush=True)


def quarter_of(iso_date: str) -> str:
    """Bucket label used by the front end: 2025-Q1 … 2026-Q4."""
    year, month = int(iso_date[:4]), int(iso_date[5:7])
    return f"{year}-Q{(month - 1) // 3 + 1}"


def to_usd(amount: float | int | None, currency: str | None) -> tuple[int | None, str | None]:
    """Returns (usd_amount, note). Unknown currency yields no figure at all."""
    if not amount or amount <= 0:
        return None, None
    code = (currency or "USD").upper()
    rate = FX_TO_USD.get(code)
    if rate is None:
        return None, f"unconvertible currency {code}"
    if code == "USD":
        return int(amount), None
    return int(amount * rate), f"converted from {code} at {rate}"


def load_body(article: dict) -> str:
    """
    The archive backfill already stored article bodies privately. A headline
    plus a 320-character excerpt cannot tell you which firm advised which
    party; the body can. Read from staging, never published.
    """
    import hashlib

    key = hashlib.sha256(article["canonicalUrl"].encode()).hexdigest()[:16]
    for directory in BODY_DIRS:
        candidate = directory / f"{key}.txt"
        if candidate.exists():
            return candidate.read_text("utf-8", errors="replace")[:6000]
    return ""


def extract(client, article: dict, model: str) -> dict | None:
    body = f"{article['title']}\n\n{load_body(article) or article.get('excerpt') or ''}"
    try:
        response = client.chat.completions.create(
            model=model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content":
                    f"Article ({article['sourceName']}, {article['publishedAt'][:10]}):\n{body}\n\n"
                    "Does this report a specific transaction or legal matter with at least one "
                    "named advising law firm? If not, return {\"is_deal\": false}.\n\n"
                    "If it does, return JSON in exactly this shape. Use null for anything the "
                    "article does not state. value_amount is a plain number with no separators, "
                    "in the currency the article uses:\n" + json.dumps(SHAPE)},
            ],
        )
    except Exception as error:  # noqa: BLE001
        log(f"    failed: {error}")
        return None

    try:
        data = json.loads(response.choices[0].message.content)
    except (json.JSONDecodeError, TypeError):
        return None

    if not data.get("is_deal"):
        return None
    firms = [f for f in (data.get("advising_firms") or []) if isinstance(f, dict) and f.get("firm")]
    if not firms:
        # The gate: no named adviser means this is business news, not a legal deal.
        return None

    announced = data.get("announced_on") or article["publishedAt"][:10]
    usd, note = to_usd(data.get("value_amount"), data.get("value_currency"))

    return {
        "id": article["id"],
        "headline": (data.get("headline") or article["title"])[:200],
        "dealType": data.get("deal_type") or "other",
        "parties": [p for p in (data.get("parties") or []) if isinstance(p, str)][:6],
        "valueUsd": usd,
        "valueNote": note,
        "originalCurrency": (data.get("value_currency") or None),
        "advisingFirms": firms[:8],
        "jurisdiction": data.get("jurisdiction"),
        "announcedOn": announced,
        "quarter": quarter_of(announced),
        "sourceName": article["sourceName"],
        "sourceUrl": article["canonicalUrl"],
        "model": model,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=60)
    args = parser.parse_args()

    if not os.getenv("OPENAI_API_KEY"):
        log("OPENAI_API_KEY is not set")
        return 1
    try:
        from openai import OpenAI
    except ImportError:
        log("pip install openai")
        return 1

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    run_started = datetime.now(timezone.utc)

    articles = json.loads(NEWS_FILE.read_text("utf-8"))["articles"]
    articles = [a for a in articles if (a.get("language") or "en") == "en"]

    existing: list[dict] = []
    if OUTPUT_FILE.exists():
        existing = json.loads(OUTPUT_FILE.read_text("utf-8")).get("deals", [])
    seen = {d["id"] for d in existing}

    pending = [a for a in articles if a["id"] not in seen][: args.limit]
    log(f"{len(articles)} English articles, {len(pending)} to scan this run")

    found = 0
    for i, article in enumerate(pending, 1):
        model = ARCHIVE_MODEL if article["publishedAt"] < ARCHIVE_CUTOFF else CURRENT_MODEL
        deal = extract(client, article, model)
        seen.add(article["id"])
        if deal:
            existing.append(deal)
            found += 1
            value = f"${deal['valueUsd']:,}" if deal["valueUsd"] else "undisclosed"
            log(f"  [{deal['quarter']}] {value} — {deal['headline'][:56]}")
        if i % 20 == 0:
            log(f"  scanned {i}/{len(pending)}…")

    existing.sort(key=lambda d: (d["announcedOn"], d["valueUsd"] or 0), reverse=True)

    quarters: dict[str, dict] = {}
    for deal in existing:
        q = quarters.setdefault(deal["quarter"], {"quarter": deal["quarter"], "count": 0, "totalUsd": 0})
        q["count"] += 1
        q["totalUsd"] += deal["valueUsd"] or 0

    OUTPUT_FILE.write_text(json.dumps({
        "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
        "currency": "USD",
        "fxNote": "Non-USD values converted at fixed indicative rates recorded per deal.",
        "quarters": sorted(quarters.values(), key=lambda q: q["quarter"], reverse=True),
        "deals": existing,
    }, indent=2, ensure_ascii=False), "utf-8")

    print()
    log(f"found {found} deals this run; {len(existing)} on file across {len(quarters)} quarters")
    log(f"wrote -> {OUTPUT_FILE.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    print("Legal League deal extraction")
    sys.exit(main())
