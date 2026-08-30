"""Upstream catalogue sources, and the parsing each one needs.

Both star positions and constellation figures are read here because
`build_stars.py` needs to know which stars the constellation lines reference:
a line vertex that is fainter than the magnitude cutoff must still ship, or the
figure comes out with holes in it.
"""

from __future__ import annotations

import csv
import io
import json
import re
from typing import Iterator, NamedTuple

from common import fetch

# HYG v4.0 — Hipparcos/Yale/Gliese merge. The GitHub copy is frozen but intact;
# the maintained repo moved to Codeberg and serves its CSVs through Git LFS,
# which is not worth the fragility for positions that do not change.
HYG_URL = "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v40.csv.gz"
HYG_FILE = "hygdata_v40.csv.gz"
HYG_LICENSE = "CC BY-SA 4.0 - HYG Database, David Nash / astronexus"

# Stellarium's IAU sky culture: the 88 official constellations as polylines of
# HIP numbers. Stellarium replaced the old constellationship.fab files with a
# single index.json per sky culture.
SKYCULTURE_URL = "https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/modern_iau/index.json"
SKYCULTURE_FILE = "modern_iau.json"
SKYCULTURE_LICENSE = "CC BY-SA 4.0 - Stellarium sky culture 'modern_iau'"


# A handful of stars reach HYG without a Hipparcos number, because HYG
# catalogues them under another designation. Stellarium's constellation lines
# still refer to them by HIP, so the figure breaks unless the two are rejoined.
#
# HD number -> the HIP number Stellarium uses.
HD_TO_HIP = {
    98231: 55203,  # Xi Ursae Majoris (Alula Australis) -- HYG files it as Gl 423
}


class Star(NamedTuple):
    hip: int
    ra_deg: float       # J2000 right ascension, degrees
    dec_deg: float      # J2000 declination, degrees
    mag: float          # apparent visual magnitude
    ci: float           # B-V colour index (0.0 when the catalogue has none)
    proper: str         # proper name, or ""
    bayer: str          # Bayer designation, or ""
    flamsteed: str      # Flamsteed number, or ""
    con: str            # IAU 3-letter constellation abbreviation, or ""
    dist_pc: float      # distance in parsecs (0.0 when unknown)


def _float(value: str, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def iter_hyg() -> Iterator[Star]:
    """Yield every HYG row that has a usable HIP number and position."""
    text = fetch(HYG_URL, HYG_FILE, decompress=True).decode("utf-8", "replace")
    reader = csv.DictReader(io.StringIO(text))

    for row in reader:
        hip_raw = row.get("hip", "").strip()
        if hip_raw:
            try:
                hip = int(hip_raw)
            except ValueError:
                continue
        else:
            # No HIP number: keep it only if it is one of the stars a
            # constellation line needs (see HD_TO_HIP).
            try:
                hd = int(row.get("hd", "").strip())
            except ValueError:
                continue
            hip = HD_TO_HIP.get(hd, 0)
            if not hip:
                continue

        mag_raw = row.get("mag", "").strip()
        if not mag_raw:
            continue

        # HYG stores right ascension in HOURS. Everything downstream is degrees.
        yield Star(
            hip=hip,
            ra_deg=_float(row["ra"]) * 15.0,
            dec_deg=_float(row["dec"]),
            mag=_float(mag_raw),
            ci=_float(row.get("ci", "")),
            proper=row.get("proper", "").strip(),
            bayer=row.get("bayer", "").strip(),
            flamsteed=row.get("flam", "").strip(),
            con=row.get("con", "").strip(),
            dist_pc=_float(row.get("dist", "")),
        )


class Constellation(NamedTuple):
    abbr: str                     # "Ori"
    name: str                     # "Orion" -- the Latin IAU name
    common: str                   # "Hunter" -- the English translation, or ""
    lines: list[list[int]]        # polylines of HIP numbers


def load_constellations() -> list[Constellation]:
    """Parse Stellarium's IAU sky culture into constellation polylines."""
    raw = json.loads(fetch(SKYCULTURE_URL, SKYCULTURE_FILE).decode("utf-8"))
    out: list[Constellation] = []

    for entry in raw.get("constellations", []):
        # ids look like "CON modern_iau Ori"
        match = re.search(r"([A-Za-z]{3})$", entry.get("id", ""))
        if not match:
            continue

        # Stellarium's "native" is the Latin IAU name (Orion, Ursa Major) and
        # "english" is the translation (Hunter, Great Bear). The Latin name is
        # the label; the translation is a nice secondary line, not a substitute.
        names = entry.get("common_name") or {}
        native = names.get("native") or ""
        english = names.get("english") or ""
        name = native or english or match.group(1)
        common = english if english and english != name else ""

        lines = [
            [int(h) for h in polyline]
            for polyline in entry.get("lines", [])
            if len(polyline) >= 2
        ]
        if lines:
            out.append(Constellation(abbr=match.group(1), name=name, common=common, lines=lines))

    return sorted(out, key=lambda c: c.abbr)


def constellation_line_hips() -> set[int]:
    """Every HIP number a constellation figure draws through."""
    return {hip for c in load_constellations() for line in c.lines for hip in line}
