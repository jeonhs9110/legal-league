"""
Legal League — firm detail collection from firms' own websites.

    python backend/pipelines/directory/fetch_firm_details.py
    python backend/pipelines/directory/fetch_firm_details.py --jurisdiction south-korea
    python backend/pipelines/directory/fetch_firm_details.py --limit 5 --dry-run

Wikipedia gave us 224 names and nothing else, and it gave us nothing at all for
twelve jurisdictions — Brazil, Indonesia, the UAE, Saudi Arabia and others whose
firms have no English Wikipedia presence. Those are exactly the markets that
distinguish this directory from Chambers and Legal 500, so the source has to
change. This reads each firm's own website instead.

Three rules, all of them load-bearing:

  * A candidate in firm_seeds.json is not a firm. It becomes one only when its
    domain resolves and the page identifies itself as that firm. Failures are
    written to `rejected` with a reason, not silently dropped, because a
    directory that quietly loses entries cannot be audited.

  * Every published field carries the URL it was read from. A phone number or a
    headcount on a directory page is a factual claim about a real business, and
    a reader disputing it needs to see where it came from.

  * Nothing is inferred. If a firm does not publish its headcount, the firm is
    listed without one. An estimate would be indistinguishable from a fact on
    the page and worse than a blank.

Award and revenue figures are deliberately NOT collected here. Awards live in
Chambers, Legal 500 and Law.asia tables, and copying those reproduces their
compilation; only a firm's own announcement is usable, which is a separate pass.
Revenue is published by UK LLPs at Companies House and by almost nobody else, so
a revenue column would be empty for most of the world.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
SEEDS_FILE = Path(__file__).resolve().parent / "firm_seeds.json"
OUTPUT_FILE = REPO / "frontend" / "src" / "data" / "firm_details.json"
RAW_DIR = ROOT / "data" / "raw" / "firms"

USER_AGENT = "LegalLeagueBot/0.1 (+https://legalleague.org/about; directory listing)"
TIMEOUT = 25
CRAWL_DELAY = 4

# Pages worth trying beyond the homepage. Ordered by how often each one carries
# the fields we want; the crawl stops early once everything is found.
SUBPAGES = [
    "", "/contact", "/contact-us", "/contacts", "/about", "/about-us",
    "/offices", "/firm", "/en/contact", "/en/about",
]

TAG_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.S | re.I)
STRIP_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.S | re.I)

MAILTO_RE = re.compile(r'href=["\']mailto:([^"\'?]+)', re.I)
TEL_RE = re.compile(r'href=["\']tel:([^"\']+)', re.I)
EMAIL_TEXT_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b")
# International dialling only. A bare local number is ambiguous across the 35
# jurisdictions here, and a wrong phone number is worse than none.
PHONE_TEXT_RE = re.compile(r"\+\d[\d\s().-]{7,20}\d")

# "over 700 professionals", "150+ lawyers", "more than 200 attorneys"
HEADCOUNT_RE = re.compile(
    r"(?:(over|more than|nearly|approximately|about|around)\s+)?"
    # Thousands separators are not optional to handle: the largest firms are
    # exactly the ones who write "1,200 professionals", and without this the
    # match lands on "200".
    r"([1-9]\d{0,2}(?:,\d{3})+|[1-9]\d{1,3})\s*\+?\s*"
    r"(lawyers|attorneys|professionals|fee[- ]earners|solicitors|advocates)",
    re.I,
)

# Award and ranking language. A count sitting in any of this is counting
# recognitions, not people.
AWARD_CONTEXT_RE = re.compile(
    r"\b(recogni[sz]ed|recommended|ranked|ranking|rankings|award|awards|awarded|"
    r"honou?red|listed|selected|named|band \d|tier \d|leading (?:practitioner|individual)|"
    r"chambers|legal ?500|benchmark|lexology|iflr|asialaw|who's who|best lawyers)\b",
    re.I,
)
# Language that makes the number a claim about the firm itself.
FIRM_CONTEXT_RE = re.compile(
    r"\b(our|we|us|the firm|firm(?:'s|s')|comprising|consists? of|made up of|"
    r"team of|staffed|employs?|home to|numbering|with (?:over |more than |nearly |some )?\d|"
    r"has (?:over |more than |nearly |approximately |around )?\d)\b",
    re.I,
)

# Trunk prefixes are dropped when a country code is added; a directory covering
# 35 jurisdictions cannot publish a bare local number and expect it to dial.
DIALLING_CODE = {
    "south-korea": "82", "japan": "81", "taiwan": "886", "china": "86",
    "hong-kong": "852", "philippines": "63", "india": "91", "malaysia": "60",
    "indonesia": "62", "vietnam": "84", "thailand": "66", "singapore": "65",
    "macao": "853", "united-kingdom": "44", "united-states": "1",
    "canada": "1", "australia": "61", "new-zealand": "64", "ireland": "353",
    "germany": "49", "france": "33", "italy": "39", "spain": "34",
    "netherlands": "31", "sweden": "46", "switzerland": "41", "russia": "7",
    "turkey": "90", "israel": "972", "united-arab-emirates": "971",
    "saudi-arabia": "966", "south-africa": "27", "nigeria": "234",
    "brazil": "55", "mexico": "52", "argentina": "54",
}

PRACTICE_VOCAB = [
    "Antitrust", "Competition", "Arbitration", "Aviation", "Banking",
    "Bankruptcy", "Capital Markets", "Compliance", "Construction",
    "Corporate", "Data Protection", "Dispute Resolution", "Employment",
    "Energy", "Environment", "Family", "Finance", "Fintech", "Healthcare",
    "Immigration", "Insolvency", "Insurance", "Intellectual Property",
    "International Trade", "Investigations", "Labour", "Litigation",
    "Maritime", "Mergers and Acquisitions", "Private Client", "Private Equity",
    "Project Finance", "Real Estate", "Regulatory", "Restructuring",
    "Securities", "Shipping", "Tax", "Technology", "Telecommunications",
    "Venture Capital", "White Collar",
]

# Addresses and switchboards on a shared-hosting or CMS boilerplate page are not
# the firm's. These substrings in an extracted value drop it.
JUNK_EMAIL = ("example.com", "sentry.io", "wordpress", "@2x", "domain.com")


def log(message: str) -> None:
    print(f"  {message}", flush=True)


def clean(html: str) -> str:
    return WS_RE.sub(" ", STRIP_RE.sub(" ", TAG_RE.sub(" ", html))).strip()


class Robots:
    """One robots.txt per host, fetched once. A host that refuses is skipped."""

    def __init__(self) -> None:
        self._cache: dict[str, urllib.robotparser.RobotFileParser | None] = {}

    def allows(self, url: str) -> bool:
        host = urllib.parse.urlsplit(url).netloc
        if host not in self._cache:
            parser = urllib.robotparser.RobotFileParser()
            parser.set_url(f"https://{host}/robots.txt")
            try:
                parser.read()
                self._cache[host] = parser
            except Exception:  # noqa: BLE001
                # No readable robots.txt is not permission to ignore it, but it
                # is also not a prohibition. Treated as open, as the RFC says.
                self._cache[host] = None
        parser = self._cache[host]
        if parser is None:
            return True
        try:
            return parser.can_fetch(USER_AGENT, url)
        except Exception:  # noqa: BLE001
            return True


def fetch(url: str) -> tuple[str | None, str | None]:
    """
    Returns (html, failure_reason). The reason is specific on purpose: "did not
    resolve" covered four different problems on the first run — a certificate
    whose hostname wanted www, a domain that does not exist, a site that only
    renders in a browser, and a host that refuses us. Those need different
    fixes, so they need different names.
    """
    request = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en,*;q=0.5",
    })
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            if "html" not in response.headers.get("Content-Type", "text/html"):
                return None, "response was not HTML"
            return response.read(1_500_000).decode("utf-8", errors="replace"), None
    except urllib.error.HTTPError as error:
        return None, f"HTTP {error.code}"
    except urllib.error.URLError as error:
        text = str(error.reason)
        if "CERTIFICATE_VERIFY_FAILED" in text:
            return None, "TLS certificate did not match this hostname"
        if "getaddrinfo" in text or "Name or service not known" in text:
            return None, "domain does not exist in DNS"
        return None, f"connection failed ({text[:60]})"
    except Exception as error:  # noqa: BLE001
        return None, f"{type(error).__name__}"


def resolve_base(domain: str) -> tuple[str | None, str | None]:
    """
    Try the bare domain, then www. Korean and Japanese firms in particular hold
    certificates issued only for the www host, which fails verification on the
    apex — a real mismatch, not something to skip verification over.
    """
    reason = None
    for host in (domain, f"www.{domain}") if not domain.startswith("www.") else (domain,):
        base = f"https://{host}"
        html, failure = fetch(base)
        if html is not None:
            return base, None
        reason = reason or failure
        if failure == "domain does not exist in DNS" and host == domain:
            continue
    return None, reason


def name_tokens(name: str) -> list[str]:
    """Distinctive words from a firm name, for the identity check."""
    stop = {
        "and", "the", "law", "firm", "llp", "llc", "lpc", "co", "partners",
        "associates", "offices", "office", "attorneys", "at", "advocates",
        "solicitors", "international", "legal", "&", "de", "los",
    }
    words = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", name.lower())
    return [w for w in words if w not in stop]


def identifies_as(html: str, name: str, aliases: list[str] | None = None) -> bool:
    """
    Does this page claim to be this firm? Without this check a parked domain or
    a squatter would be published as a law firm.

    Aliases carry the firm's name in its own language. A Korean or Japanese
    firm's homepage is written in Korean or Japanese and may never print the
    English name we know it by; requiring the English name would reject the
    firm for the crime of being Korean, which is exactly the bias that made the
    Wikipedia-sourced directory useless outside the anglophone markets.
    """
    title = TITLE_RE.search(html)
    title_text = title.group(1) if title else ""
    haystack = (title_text + " " + clean(html)[:6000]).lower()

    for alias in aliases or []:
        if alias.lower() in haystack:
            return True

    tokens = name_tokens(name)
    if not tokens:
        return False
    hits = sum(1 for token in tokens if token in haystack)
    return hits >= min(2, len(tokens))


def extract_emails(html: str) -> list[str]:
    found = [m.lower() for m in MAILTO_RE.findall(html)]
    if not found:
        found = [m.lower() for m in EMAIL_TEXT_RE.findall(clean(html))]
    out: list[str] = []
    for email in found:
        email = email.strip().rstrip(".")
        if any(junk in email for junk in JUNK_EMAIL):
            continue
        if email not in out:
            out.append(email)
    return out[:3]


def extract_phones(html: str, jurisdiction: str) -> list[str]:
    """
    Normalised to +CC form. tel: hrefs are preferred because they are the
    firm's own machine-readable number, but they arrive dirty — one Korean
    firm's markup yielded "+82-2-563-0298o" — and a local number like
    "0262001600" does not dial from anywhere else, which on a directory
    spanning 35 jurisdictions makes it useless.
    """
    code = DIALLING_CODE.get(jurisdiction)
    raw = TEL_RE.findall(html) or PHONE_TEXT_RE.findall(clean(html))

    out: list[str] = []
    seen: set[str] = set()
    for phone in raw:
        phone = WS_RE.sub("", phone.strip())
        international = phone.startswith("+")
        digits = re.sub(r"\D", "", phone)
        if not digits:
            continue
        if not international:
            if not code:
                continue
            if digits.startswith(code):
                pass                      # already carries the country code
            else:
                digits = code + digits.lstrip("0")
        if not 9 <= len(digits) <= 15:
            continue
        formatted = "+" + digits
        if formatted in seen:
            continue
        seen.add(formatted)
        out.append(formatted)
    return out[:3]


def extract_headcount(html: str) -> tuple[int, str] | None:
    """
    Returns (count, the sentence it came from) so the claim stays traceable.

    The context filter is the whole job here. The first run read "169
    Professionals Recommended in the 2026 Lexology Index" off Kim & Chang's
    homepage and published 169 as their headcount; the firm has over 1,200.
    Every legal website is covered in sentences counting how many of its
    lawyers some directory ranked, and those numbers sit in exactly the same
    grammar as a headcount. So a match inside award language is discarded
    outright rather than scored down.
    """
    text = clean(html)
    best: tuple[int, str] | None = None
    for match in HEADCOUNT_RE.finditer(text):
        count = int(match.group(2).replace(",", ""))
        # Under 10 is usually page furniture; over 8000 is not one firm.
        if not 10 <= count <= 8000:
            continue
        start, end = max(0, match.start() - 110), min(len(text), match.end() + 110)
        context = text[start:end].strip()
        if AWARD_CONTEXT_RE.search(context):
            continue
        if not FIRM_CONTEXT_RE.search(context):
            # Needs to read as a statement about the firm ("our 300 lawyers",
            # "the firm has 300 lawyers"), not a bare number near the word.
            continue
        if best is None or count > best[0]:
            best = (count, context)
    return best


def extract_practices(html: str) -> list[str]:
    text = clean(html)
    return [area for area in PRACTICE_VOCAB if re.search(
        r"\b" + re.escape(area) + r"\b", text, re.I)][:12]


class Renderer:
    """
    Headless-browser fallback for sites that ship an empty shell and build the
    page in JavaScript. Three of Korea's largest firms do exactly that, and a
    static fetch reads zero characters from them.

    Opened lazily and reused, because launching Chromium per firm would cost
    more than the crawl. The same identified User-Agent is used — rendering the
    page the way a browser would is not the same as pretending to be one.
    """

    def __init__(self) -> None:
        self._playwright = None
        self._browser = None
        self.available = True

    def _ensure(self) -> bool:
        if self._browser is not None:
            return True
        if not self.available:
            return False
        try:
            from playwright.sync_api import sync_playwright

            self._playwright = sync_playwright().start()
            self._browser = self._playwright.chromium.launch(headless=True)
            return True
        except Exception as error:  # noqa: BLE001
            log(f"    headless browser unavailable ({type(error).__name__}); "
                "client-rendered sites will be recorded as such")
            self.available = False
            return False

    def render(self, url: str) -> str | None:
        if not self._ensure():
            return None
        page = None
        try:
            page = self._browser.new_page(user_agent=USER_AGENT)
            page.goto(url, timeout=30000, wait_until="networkidle")
            return page.content()
        except Exception:  # noqa: BLE001
            return None
        finally:
            if page is not None:
                try:
                    page.close()
                except Exception:  # noqa: BLE001
                    pass

    def close(self) -> None:
        for closer in (getattr(self._browser, "close", None),
                       getattr(self._playwright, "stop", None)):
            if closer:
                try:
                    closer()
                except Exception:  # noqa: BLE001
                    pass


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return re.sub(r"-+", "-", slug)


LINK_RE = re.compile(r'<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', re.S | re.I)
WANTED_LINK_RE = re.compile(
    r"\b(about|overview|who we are|our firm|the firm|profile|introduction|"
    r"contact|offices?|locations?|people|professionals)\b", re.I)


def discover_links(html: str, base: str, limit: int = 6) -> list[str]:
    """
    Follow the site's own navigation instead of guessing paths.

    Guessed paths assume an English CMS convention. Kim & Chang publishes its
    headcount at /en/about/overview.kc, Japanese firms use /firm/ or Japanese
    slugs entirely, and no list of guesses reaches any of them. The firm's own
    nav does, because every one of these sites links to its About and Contact
    pages from the homepage.
    """
    host = urllib.parse.urlsplit(base).netloc
    scored: list[tuple[int, str]] = []
    seen: set[str] = set()

    for href, anchor in LINK_RE.findall(html):
        label = clean(anchor)[:80]
        target = urllib.parse.urljoin(base + "/", href.strip())
        parts = urllib.parse.urlsplit(target)
        if parts.scheme not in ("http", "https") or parts.netloc != host:
            continue
        target = urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
        if target.rstrip("/") == base.rstrip("/") or target in seen:
            continue
        # Match on the visible label first, then the URL — a Japanese nav label
        # will not match, but its /about/ path often will.
        if WANTED_LINK_RE.search(label):
            score = 0
        elif WANTED_LINK_RE.search(parts.path):
            score = 1
        else:
            continue
        # Deep paths are usually individual profiles, not firm-level pages.
        score += parts.path.strip("/").count("/")
        seen.add(target)
        scored.append((score, target))

    scored.sort()
    return [url for _, url in scored[:limit]]


def record_is_complete(pages: list[tuple[str, str]]) -> bool:
    """Cheap check so the crawl can stop early without re-running extraction."""
    joined = " ".join(html for _, html in pages)
    return bool(
        MAILTO_RE.search(joined) and TEL_RE.search(joined)
        and extract_headcount(joined)
    )


def get(url: str, renderer: Renderer) -> str | None:
    """Static fetch, falling back to a rendered one when the shell is empty."""
    html, _ = fetch(url)
    if html is not None and len(clean(html)) >= 400:
        return html
    rendered = renderer.render(url)
    return rendered or html


def collect(candidate: dict, jurisdiction: str, robots: Robots,
            renderer: Renderer, dry: bool) -> tuple[dict | None, str | None]:
    """Returns (record, rejection_reason). Exactly one of the two is set."""
    name, domain = candidate["name"], candidate["domain"]
    aliases = candidate.get("aliases") or []

    if not robots.allows(f"https://{domain}/"):
        return None, "robots.txt disallows this crawler"

    base, failure = resolve_base(domain)
    if not base:
        return None, failure or "could not be reached"

    homepage = get(base, renderer)
    if not homepage:
        return None, "no readable HTML at this domain"
    if len(clean(homepage)) < 200:
        return None, "site renders only in a browser and did not render here"
    if not identifies_as(homepage, name, aliases):
        return None, "page does not identify itself as this firm"

    record = {
        "slug": slugify(name),
        "name": name,
        "jurisdiction": jurisdiction,
        "website": base,
        "emails": [], "phones": [], "practiceAreas": [],
        "headcount": None, "headcountQuote": None,
        "sources": {},
        "checkedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    pages = [(base, homepage)]
    if not dry:
        # The site's own nav first, then the conventional paths as a fallback
        # for homepages that hide navigation behind script.
        targets = discover_links(homepage, base)
        targets += [base + path for path in SUBPAGES[1:]
                    if base + path not in targets]
        for url in targets[:8]:
            if not robots.allows(url):
                continue
            time.sleep(CRAWL_DELAY)
            html = get(url, renderer)
            if html and identifies_as(html, name, aliases):
                pages.append((url, html))
            # Stop once the record is complete; no reason to keep hitting a
            # firm's server for fields we already have.
            if record_is_complete(pages):
                break

    for url, html in pages:
        if not record["emails"]:
            emails = extract_emails(html)
            if emails:
                record["emails"] = emails
                record["sources"]["emails"] = url
        if not record["phones"]:
            phones = extract_phones(html, jurisdiction)
            if phones:
                record["phones"] = phones
                record["sources"]["phones"] = url
        if not record["headcount"]:
            head = extract_headcount(html)
            if head:
                record["headcount"], record["headcountQuote"] = head
                record["sources"]["headcount"] = url
        if not record["practiceAreas"]:
            areas = extract_practices(html)
            if len(areas) >= 4:
                record["practiceAreas"] = areas
                record["sources"]["practiceAreas"] = url

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    (RAW_DIR / f"{record['slug']}.txt").write_text(
        "\n\n".join(f"### {u}\n{clean(h)[:20000]}" for u, h in pages), "utf-8"
    )
    return record, None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--jurisdiction", help="restrict to one seed jurisdiction")
    parser.add_argument("--limit", type=int, help="max firms per jurisdiction")
    parser.add_argument("--dry-run", action="store_true",
                        help="homepage only; no subpage crawl")
    args = parser.parse_args()

    seeds = json.loads(SEEDS_FILE.read_text("utf-8"))["jurisdictions"]
    robots = Robots()
    renderer = Renderer()
    run_started = datetime.now(timezone.utc)

    firms: list[dict] = []
    rejected: list[dict] = []
    if OUTPUT_FILE.exists():
        prior = json.loads(OUTPUT_FILE.read_text("utf-8"))
        firms = prior.get("firms", [])
    done = {f["slug"] for f in firms}

    for jurisdiction, candidates in seeds.items():
        if args.jurisdiction and jurisdiction != args.jurisdiction:
            continue
        pending = [c for c in candidates if slugify(c["name"]) not in done]
        if args.limit:
            pending = pending[: args.limit]
        if not pending:
            continue

        log(f"{jurisdiction}: {len(pending)} candidates")
        for candidate in pending:
            time.sleep(CRAWL_DELAY)
            record, reason = collect(candidate, jurisdiction, robots, renderer, args.dry_run)
            if reason:
                rejected.append({
                    "name": candidate["name"],
                    "domain": candidate["domain"],
                    "jurisdiction": jurisdiction,
                    "reason": reason,
                })
                log(f"    rejected {candidate['name']}: {reason}")
                continue
            firms.append(record)
            done.add(record["slug"])
            bits = []
            if record["headcount"]:
                bits.append(f"{record['headcount']} professionals")
            if record["phones"]:
                bits.append("phone")
            if record["emails"]:
                bits.append("email")
            if record["practiceAreas"]:
                bits.append(f"{len(record['practiceAreas'])} practices")
            log(f"    {record['name']}: {', '.join(bits) or 'verified, no fields found'}")

    renderer.close()

    # Headcount descending, then name. This is the ordering the site uses, and
    # it is a fact each firm publishes about itself rather than anyone's tiering.
    firms.sort(key=lambda f: (-(f.get("headcount") or 0), f["name"]))

    OUTPUT_FILE.write_text(json.dumps({
        "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
        "method": "Fields read from each firm's own website; every field records "
                  "the page it came from. Firms are ordered by the professional "
                  "headcount they publish, and firms that publish none are listed "
                  "without a figure. No ranking is implied.",
        "firmCount": len(firms),
        "rejected": rejected,
        "firms": firms,
    }, indent=2, ensure_ascii=False), "utf-8")

    with_phone = sum(1 for f in firms if f["phones"])
    with_head = sum(1 for f in firms if f["headcount"])
    print()
    log(f"{len(firms)} firms verified, {len(rejected)} rejected this run")
    log(f"  {with_phone} with a phone number, {with_head} with a published headcount")
    log(f"wrote -> {OUTPUT_FILE.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    print("Legal League firm detail collection")
    sys.exit(main())
