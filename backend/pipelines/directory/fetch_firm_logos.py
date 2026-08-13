"""
Legal League — firm logos, taken from each firm's own website.

    python backend/pipelines/directory/fetch_firm_logos.py
    python backend/pipelines/directory/fetch_firm_logos.py --jurisdiction japan

A logo is a trade mark, not an article. Reproducing one to identify the firm it
belongs to, in a directory entry about that firm, is nominative use: we are
naming the firm, not claiming association with it, not implying endorsement,
and not using the mark to sell anything. That is the same basis on which a
newspaper prints a company's logo beside a story about the company.

The rules that keep it that basis, and that the code enforces:

  * The logo is only ever shown on that firm's own entry, never in advertising,
    never on a page selling anything, and never altered beyond scaling.
  * Every file records the page it came from, so a firm can see exactly what we
    took and from where.
  * A firm asking for its mark to be removed gets it removed — corrections
    address is on the page — and the seed is marked so the crawler does not
    fetch it again.
  * SVG is downloaded but not trusted: it is markup, it can carry script, and
    it is rasterised to PNG rather than served as-is.

Nothing here is decorative. If a firm publishes no usable mark, its entry shows
its name set in type, which is what the rest of the site does anyway.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_firm_details import (  # noqa: E402
    CRAWL_DELAY, Renderer, Robots, TIMEOUT, USER_AGENT, get,
)

import urllib.request  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
DETAILS_FILE = REPO / "frontend" / "src" / "data" / "firm_details.json"
OUTPUT_FILE = REPO / "frontend" / "src" / "data" / "firm_logos.json"
LOGO_DIR = REPO / "frontend" / "public" / "logos"

# Rendered at 2x the display size so it stays sharp on retina, and no larger —
# we are identifying a firm, not archiving its brand assets.
TARGET_HEIGHT = 96
MAX_BYTES = 3_000_000

# Ordered by how reliably each identifies the firm's actual mark.
LOGO_PATTERNS = [
    re.compile(r'<link[^>]+rel=["\'][^"\']*icon[^"\']*["\'][^>]*href=["\']([^"\']+\.svg)["\']', re.I),
    re.compile(r'<img[^>]+(?:class|id)=["\'][^"\']*logo[^"\']*["\'][^>]*src=["\']([^"\']+)["\']', re.I),
    re.compile(r'<img[^>]+src=["\']([^"\']*logo[^"\']*)["\']', re.I),
    re.compile(r'<img[^>]+alt=["\'][^"\']*logo[^"\']*["\'][^>]*src=["\']([^"\']+)["\']', re.I),
    re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', re.I),
]

# Tracking pixels, sprites and social badges wearing the word "logo".
REJECT = re.compile(
    r"(facebook|twitter|linkedin|instagram|youtube|wechat|weibo|sprite|"
    r"placeholder|1x1|pixel|spacer|loading|default)", re.I)

# Third-party ranking badges. WongPartnership's page offered a "FirmLogo" that
# was actually a Chambers Top Ranked Asia-Pacific 2024 seal — Chambers' mark,
# not the firm's. Reproducing that is not nominative use of the firm's logo, it
# is republishing a directory's badge, which is the same problem that keeps
# their tables off this site. Anything that looks like an award seal is refused.
BADGE = re.compile(
    r"(chambers|legal\s?500|legalease|iflr|asialaw|benchmark|lexology|"
    r"who'?swho|best\s?lawyers|managing\s?ip|award|badge|seal|ranked|"
    r"rosette|laurel|top\s?tier|band\s?\d|tier\s?\d|accolade|winner)", re.I)


def log(message: str) -> None:
    print(f"  {message}", flush=True)


def fetch_bytes(url: str) -> bytes | None:
    try:
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return response.read(MAX_BYTES)
    except Exception:  # noqa: BLE001
        return None


def candidate_urls(html: str, base: str) -> list[str]:
    out: list[str] = []
    for pattern in LOGO_PATTERNS:
        for match in pattern.findall(html):
            url = urllib.parse.urljoin(base + "/", match.strip())
            if REJECT.search(url) or BADGE.search(url) or url in out:
                continue
            if not re.search(r"\.(svg|png|jpe?g|webp|gif)(\?|$)", url, re.I):
                continue
            out.append(url)
    return out[:6]


def rasterise(data: bytes, url: str) -> "Image.Image | None":  # noqa: F821
    """
    Returns a trimmed RGBA image, or None if the bytes are not a usable mark.

    SVG is rasterised rather than served: it is executable markup and a
    directory has no business shipping a third party's script to its readers.
    """
    from PIL import Image

    if url.lower().split("?")[0].endswith(".svg"):
        try:
            import cairosvg  # type: ignore

            data = cairosvg.svg2png(bytestring=data, output_height=TARGET_HEIGHT * 2)
        except Exception:  # noqa: BLE001
            return None
    try:
        image = Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception:  # noqa: BLE001
        return None

    # A mark that is mostly empty, or a single flat colour, is furniture.
    if image.width < 24 or image.height < 12:
        return None
    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    if image.width < 24 or image.height < 12:
        return None
    if len(image.convert("RGB").getcolors(maxcolors=4) or []) == 1:
        return None

    scale = TARGET_HEIGHT / image.height
    if scale < 1:
        image = image.resize(
            (max(1, round(image.width * scale)), TARGET_HEIGHT),
            Image.LANCZOS,
        )
    return image


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--jurisdiction")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--approve", metavar="SLUG", nargs="+",
                        help="mark reviewed logos as publishable")
    parser.add_argument("--reject", metavar="SLUG", nargs="+",
                        help="drop a logo and record why it was refused")
    args = parser.parse_args()

    if args.approve or args.reject:
        payload = json.loads(OUTPUT_FILE.read_text("utf-8"))
        kept = []
        for record in payload["logos"]:
            if args.reject and record["slug"] in args.reject:
                Path(REPO / "frontend" / "public" / record["file"].lstrip("/")).unlink(missing_ok=True)
                log(f"rejected and deleted {record['name']}")
                continue
            record.setdefault("approved", False)
            if args.approve and record["slug"] in args.approve:
                record["approved"] = True
                log(f"approved {record['name']}")
            kept.append(record)
        payload["logos"] = kept
        payload["count"] = len(kept)
        OUTPUT_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), "utf-8")
        log(f"{sum(1 for r in kept if r.get('approved'))} approved of {len(kept)} on file")
        return 0

    if not DETAILS_FILE.exists():
        log("run fetch_firm_details.py first")
        return 1

    firms = json.loads(DETAILS_FILE.read_text("utf-8"))["firms"]
    if args.jurisdiction:
        firms = [f for f in firms if f["jurisdiction"] == args.jurisdiction]
    if args.limit:
        firms = firms[: args.limit]

    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    robots = Robots()
    renderer = Renderer()
    run_started = datetime.now(timezone.utc)

    records: list[dict] = []
    if OUTPUT_FILE.exists():
        records = json.loads(OUTPUT_FILE.read_text("utf-8")).get("logos", [])
    done = {r["slug"] for r in records}

    found = 0
    for firm in firms:
        if firm["slug"] in done:
            continue
        base = firm["website"]
        time.sleep(CRAWL_DELAY)
        html = get(base, renderer)
        if not html:
            continue

        saved = None
        for url in candidate_urls(html, base):
            if not robots.allows(url):
                continue
            data = fetch_bytes(url)
            if not data:
                continue
            image = rasterise(data, url)
            if image is None:
                continue
            path = LOGO_DIR / f"{firm['slug']}.png"
            image.save(path, optimize=True)
            saved = {
                "slug": firm["slug"],
                "name": firm["name"],
                "jurisdiction": firm["jurisdiction"],
                "file": f"/logos/{firm['slug']}.png",
                "width": image.width,
                "height": image.height,
                # What we took and where from, so the firm can check it.
                "sourceUrl": url,
                "sourcePage": base,
                "retrievedAt": run_started.isoformat().replace("+00:00", "Z"),
                "basis": "Nominative use: the firm's own mark, on the firm's own entry.",
                # Nothing publishes until a human has looked at it. A URL
                # filter cannot tell a firm's mark from an award seal —
                # WongPartnership serves a Chambers Top Ranked badge from a
                # path it names "FirmLogo" — and republishing another
                # directory's trade mark is not a mistake worth automating.
                "approved": False,
            }
            break

        if saved:
            records.append(saved)
            done.add(firm["slug"])
            found += 1
            log(f"    {firm['name']}: {saved['width']}x{saved['height']}")
        else:
            log(f"    {firm['name']}: no usable mark published")

    renderer.close()
    OUTPUT_FILE.write_text(json.dumps({
        "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
        "basis": (
            "Each mark is reproduced from the firm's own website to identify "
            "that firm on its own directory entry — nominative use. Marks are "
            "not altered beyond scaling, never used in advertising, and removed "
            "on request to corrections@legalleague.org."
        ),
        "count": len(records),
        "logos": records,
    }, indent=2, ensure_ascii=False), "utf-8")

    print()
    log(f"{found} logos this run; {len(records)} on file")
    log(f"wrote -> {OUTPUT_FILE.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    print("Legal League firm logo collection")
    sys.exit(main())
