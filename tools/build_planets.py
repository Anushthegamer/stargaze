"""Emit planets.json: JPL's approximate Keplerian elements for the 8 planets.

Scraped from JPL rather than transcribed, because a single mistyped digit in a
per-century rate is a bug you would chase for a very long time.

The table used is the 1800 AD - 2050 AD fit, good to roughly an arcminute.
A phone magnetometer is off by degrees, so the ephemeris is nowhere near the
limiting factor here.
"""

from __future__ import annotations

import html
import re
import sys

from common import fetch, log, write_json

JPL_URL = "https://ssd.jpl.nasa.gov/planets/approx_pos.html"
JPL_FILE = "jpl_approx_pos.html"

# The page carries two tables; this is the header of the 1800-2050 one.
EXPECTED = [
    "Mercury", "Venus", "EM Bary", "Mars",
    "Jupiter", "Saturn", "Uranus", "Neptune",
]

# JPL calls it "EM Bary"; everything downstream wants Earth by name.
RENAME = {"EM Bary": "Earth"}

ELEMENTS = ["a", "e", "i", "L", "peri", "node"]


def parse_table(text: str) -> dict[str, dict[str, list[float]]]:
    """Read the two-line-per-planet element/rate block."""
    lines = [ln.rstrip() for ln in text.splitlines()]
    planets: dict[str, dict[str, list[float]]] = {}

    number = re.compile(r"-?\d+\.?\d*(?:[eE][-+]?\d+)?")

    index = 0
    while index < len(lines):
        line = lines[index]
        name = next((p for p in EXPECTED if line.startswith(p)), None)
        if name is None or index + 1 >= len(lines):
            index += 1
            continue

        values = [float(v) for v in number.findall(line[len(name):])]
        rates = [float(v) for v in number.findall(lines[index + 1])]
        # The page ends with a legend line ("EM Bary = Earth/Moon Barycenter")
        # that starts with a planet name but carries no elements.
        if len(values) != 6 or len(rates) != 6:
            index += 1
            continue

        planets[RENAME.get(name, name)] = {
            "elements": values,
            "rates": rates,
        }
        index += 2

    return planets


def main() -> int:
    log("build_planets")

    page = fetch(JPL_URL, JPL_FILE).decode("utf-8", "replace")
    blocks = re.findall(r"<pre[^>]*>(.*?)</pre>", page, re.S | re.I)

    table = None
    for block in blocks:
        text = html.unescape(re.sub(r"<[^>]+>", "", block))
        # The 1800-2050 fit is the one where Neptune's mean longitude is negative;
        # the 3000 BC - 3000 AD table has it at +304 degrees.
        if "Mercury" in text and "Neptune" in text and re.search(r"Neptune\s+30\.069\d+\s+0\.00859", text):
            table = parse_table(text)
            break

    if table is None:
        log("  ERROR could not find the 1800-2050 element table on the JPL page")
        return 1

    missing = [p for p in EXPECTED if RENAME.get(p, p) not in table]
    if missing:
        log(f"  ERROR missing planets: {', '.join(missing)}")
        return 1

    payload = {
        "source": "JPL Solar System Dynamics, Approximate Positions of the Planets",
        "url": JPL_URL,
        "validFrom": 1800,
        "validTo": 2050,
        "epoch": "J2000 (JD 2451545.0)",
        "elementOrder": ELEMENTS,
        "units": {
            "a": "au",
            "e": "dimensionless",
            "i": "degrees",
            "L": "degrees (mean longitude)",
            "peri": "degrees (longitude of perihelion)",
            "node": "degrees (longitude of ascending node)",
            "rates": "per Julian century",
        },
        "planets": {
            name: {
                "elements": dict(zip(ELEMENTS, body["elements"])),
                "rates": dict(zip(ELEMENTS, body["rates"])),
            }
            for name, body in table.items()
        },
    }

    write_json("planets.json", payload, note=f"{len(table)} bodies including Earth")

    # A cheap guard against having grabbed the wrong table.
    earth_L = payload["planets"]["Earth"]["elements"]["L"]
    if not (100.0 < earth_L < 101.0):
        log(f"  WARNING Earth mean longitude {earth_L} is not the expected ~100.46")

    return 0


if __name__ == "__main__":
    sys.exit(main())
