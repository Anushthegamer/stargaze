"""Emit constellations.json: the 88 IAU figures as polylines of HIP numbers.

Polylines rather than segment pairs, because the renderer draws each one as a
single path: fewer draw calls, and the joins look right.
"""

from __future__ import annotations

import sys

from common import log, write_json
from sources import SKYCULTURE_LICENSE, load_constellations


def main() -> int:
    log("build_constellations")

    constellations = load_constellations()
    segments = sum(len(line) - 1 for c in constellations for line in c.lines)

    payload = {
        "source": SKYCULTURE_LICENSE,
        "vertexId": "hip",
        "constellations": [
            {"abbr": c.abbr, "name": c.name, **({"common": c.common} if c.common else {}), "lines": c.lines}
            for c in constellations
        ],
    }
    write_json(
        "constellations.json",
        payload,
        note=f"{len(constellations)} constellations, {segments:,} segments",
    )

    if len(constellations) != 88:
        log(f"  WARNING expected 88 constellations, got {len(constellations)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
