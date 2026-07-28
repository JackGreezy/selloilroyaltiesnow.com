#!/usr/bin/env python3
"""Project-specific release gate for visible-copy and media rules."""

import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup


PROJECT = Path(__file__).resolve().parents[1]
PAGES = sorted(PROJECT.joinpath("public").rglob("*.html"))
FAILURES = []
MAP_COUNT = 0
ADDRESS_FRAGMENTS = (
    "113 4th St E",
    "4th St E, Williston",
    "Williston, ND 58801",
)


def visible_text(soup):
    for node in soup.select("script,style,template,svg,noscript"):
        node.decompose()
    return " ".join(soup.get_text(" ", strip=True).split())


for page in PAGES:
    soup = BeautifulSoup(page.read_text(errors="ignore"), "html.parser")
    visible = visible_text(BeautifulSoup(str(soup), "html.parser"))
    relative = page.relative_to(PROJECT)

    singular = re.search(r"\b(?:I|me|my|mine|myself)\b", visible, flags=re.I)
    if singular:
        FAILURES.append(f"{relative}: singular first-person copy: {singular.group(0)!r}")

    for fragment in ADDRESS_FRAGMENTS:
        if fragment.lower() in visible.lower():
            FAILURES.append(f"{relative}: visible address fragment: {fragment}")

    footer = soup.select_one("footer")
    if footer and footer.select("img,picture,svg,video,canvas,iframe,source"):
        FAILURES.append(f"{relative}: footer media must be zero")

    for image in soup.select("img"):
        src = str(image.get("src", ""))
        if src and not src.startswith(("/ours/", "data:")):
            FAILURES.append(f"{relative}: non-mapped image source: {src}")
        for attr in ("width", "height"):
            value = str(image.get(attr, "")).strip()
            if value.isdigit() and 0 < int(value) <= 64:
                FAILURES.append(
                    f"{relative}: miniature image dimension {attr}={value}: {src}"
                )

    maps = soup.select('iframe[src*="google.com/maps"]')
    MAP_COUNT += len(maps)
    if page.name == "contact.html" and len(maps) != 1:
        FAILURES.append(f"{relative}: expected exactly one Google Maps embed")

    for form in soup.select("form"):
        if form.select("input:not([type='search']),textarea,select"):
            if form.get("action") != "/api/contact":
                FAILURES.append(
                    f"{relative}: inquiry form posts to {form.get('action')!r}"
                )

home = BeautifulSoup(
    PROJECT.joinpath("public", "home.html").read_text(errors="ignore"),
    "html.parser",
)
home_h1 = [" ".join(node.get_text(" ", strip=True).split()) for node in home.select("h1")]
if (
    len(home_h1) != 1
    or "sell oil royalties" not in home_h1[0].lower()
    or "williston" not in home_h1[0].lower()
    or "north dakota" not in home_h1[0].lower()
):
    FAILURES.append(f"homepage SEO H1 is invalid: {home_h1}")

hero_images = home.select(".page-entry-content > .hero .hero__media img")
if not hero_images or not any(
    str(image.get("src", "")).startswith("/ours/") for image in hero_images
):
    FAILURES.append("homepage hero does not contain a mapped, nonblank image")

if MAP_COUNT != 1:
    FAILURES.append(f"sitewide Google Maps embed count is {MAP_COUNT}, expected 1")

if FAILURES:
    print("COMPLIANCE: FAIL")
    print("\n".join(f"  {failure}" for failure in FAILURES))
    sys.exit(1)

print(
    f"COMPLIANCE: PASS — {len(PAGES)} pages, one SEO H1, mapped hero, "
    "zero singular first-person copy, zero visible addresses, zero miniature images, "
    "zero footer media, one map, and canonical form routing"
)
