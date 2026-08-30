"""Emit stars.json and names.json from the HYG catalogue.

Only stars a phone can plausibly photograph from the ground -- see MAG_LIMIT.

stars.json uses parallel arrays rather than an array of objects: the client
loads them straight into Float32Array/Int32Array and transforms all of them
in one pass every frame.

The arrays are sorted brightest-first, so a magnitude cutoff is a slice
(`count` entries) rather than a filter.
"""

from __future__ import annotations

import sys

from common import log, rounded, write_json
from sources import HYG_LICENSE, SKYCULTURE_LICENSE, constellation_line_hips, iter_hyg

# What a phone camera can actually record, handheld, from the ground.
#
# 5.5 is the naked-eye limit under a dark sky, but the eye is not the sensor
# here. A phone in night mode reaches roughly this in a genuinely dark place and
# nothing like it in a town -- so the catalogue stops here and the magnitude
# slider lets a user in a city pull it back further.
#
# Lowering this costs no constellation figures: line vertices ship regardless of
# brightness (see `required` below), so all 88 stay complete.
MAG_LIMIT = 4.5


def main() -> int:
    log("build_stars")

    # Constellation vertices ship regardless of brightness, otherwise the
    # figures render with gaps where a faint joining star was dropped.
    required = constellation_line_hips()

    best: dict[int, object] = {}
    for star in iter_hyg():
        if star.mag > MAG_LIMIT and star.hip not in required:
            continue
        # HYG carries multiple rows for components of the same system; keep the
        # brightest so a double does not render as two overlapping dots.
        current = best.get(star.hip)
        if current is None or star.mag < current.mag:
            best[star.hip] = star

    stars = sorted(best.values(), key=lambda s: (s.mag, s.hip))
    forced = sum(1 for s in stars if s.mag > MAG_LIMIT)

    payload = {
        "epoch": "J2000",
        "magLimit": MAG_LIMIT,
        "count": len(stars),
        "order": "magnitude ascending",
        "units": {"ra": "degrees", "dec": "degrees"},
        "source": HYG_LICENSE,
        "hip": [s.hip for s in stars],
        "ra": [rounded(s.ra_deg, 4) for s in stars],
        "dec": [rounded(s.dec_deg, 4) for s in stars],
        "mag": [rounded(s.mag, 2) for s in stars],
        "ci": [rounded(s.ci, 2) for s in stars],
    }
    write_json("stars.json", payload, note=f"{len(stars):,} stars, {forced} below the cutoff kept for constellation lines")

    # Names are a separate, much smaller file: the sky renderer never needs
    # them, only the info card and search do.
    names = {}
    for star in stars:
        if not (star.proper or star.bayer or star.flamsteed):
            continue
        entry: dict[str, object] = {}
        if star.proper:
            entry["n"] = star.proper
        if star.bayer:
            entry["b"] = star.bayer
        if star.flamsteed:
            entry["f"] = star.flamsteed
        if star.con:
            entry["c"] = star.con
        if star.dist_pc > 0:
            entry["ly"] = rounded(star.dist_pc * 3.261563777, 1)
        names[str(star.hip)] = entry

    proper_count = sum(1 for s in stars if s.proper)
    write_json(
        "names.json",
        {"source": HYG_LICENSE, "stars": names},
        note=f"{len(names):,} designated, {proper_count} with proper names",
    )

    log(f"  note    constellation figures: {SKYCULTURE_LICENSE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
