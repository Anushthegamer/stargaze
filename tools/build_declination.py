"""Emit declination.json: a grid of magnetic declination from IGRF-14.

A phone's magnetometer points at MAGNETIC north. The sky is indexed from TRUE
north. The difference is magnetic declination, and it reaches 20 degrees or more
in populated places - so skipping this correction does not nudge the overlay,
it puts the wrong constellation under the crosshair.

IGRF-14 is used rather than the WMM because NOAA puts the WMM coefficient file
behind a survey form, while IGRF's coefficients are served openly. The two
models agree on declination to a small fraction of a degree - far inside the
several-degree error of the magnetometer itself.

The client bilinearly interpolates the grid, which is why the grid stops at
+/-85 degrees latitude: declination changes far too fast near the magnetic poles
for interpolation to mean anything, and a compass is useless there anyway.

Run this file directly to build the grid; it verifies itself against NOAA's
published WMM2025 test values on the way.
"""

from __future__ import annotations

import math
import re
import sys

from common import fetch, log, rounded, write_json

IGRF_URL = "https://www.ngdc.noaa.gov/IAGA/vmod/coeffs/igrf14coeffs.txt"
IGRF_FILE = "igrf14coeffs.txt"

# NOAA's published test values. They are WMM, not IGRF, so they are a sanity
# check on the spherical-harmonic machinery rather than an exact expectation.
TEST_URL = "https://www.ncei.noaa.gov/sites/default/files/2025-02/WMM2025_TEST_VALUES.txt"
TEST_FILE = "wmm2025_test_values.txt"
TEST_TOLERANCE_DEG = 0.6

MODEL_EPOCH = 2025.0
NMAX = 13

# WGS84
WGS84_A = 6378.137        # km, semi-major axis
WGS84_F = 1.0 / 298.257223563
WGS84_B = WGS84_A * (1.0 - WGS84_F)
EARTH_RADIUS = 6371.2     # km, IGRF geomagnetic reference radius

LAT_MIN, LAT_MAX, LAT_STEP = -85.0, 85.0, 5.0
LON_MIN, LON_STEP, LON_COUNT = -180.0, 5.0, 72


# --------------------------------------------------------------------------
# Coefficients
# --------------------------------------------------------------------------

def load_coefficients() -> tuple[list[list[float]], list[list[float]], list[list[float]], list[list[float]]]:
    """Return (g, h, dg, dh) as [n][m] tables for the 2025.0 epoch."""
    text = fetch(IGRF_URL, IGRF_FILE).decode("utf-8", "replace")
    lines = [ln for ln in text.splitlines() if ln.strip()]

    # The file has two header rows: "c/s ..." names each model (DGRF/IGRF/SV),
    # and "g/h n m ..." carries the epochs those columns belong to.
    header = next((ln for ln in lines if ln.split() and ln.split()[0] == "g/h"), None)
    if header is None:
        raise ValueError("no 'g/h' epoch header row in the IGRF coefficient file")

    epochs = header.split()[3:]
    try:
        main_col = epochs.index(f"{MODEL_EPOCH:.1f}")
    except ValueError:
        raise ValueError(f"IGRF file has no {MODEL_EPOCH:.1f} epoch column; found {epochs[-4:]}")

    # The secular-variation column is labelled as a span, e.g. "2025-30".
    sv_col = next(
        (i for i, label in enumerate(epochs) if re.fullmatch(r"\d{4}-\d{2,4}", label)),
        len(epochs) - 1,
    )

    size = NMAX + 1
    g = [[0.0] * size for _ in range(size)]
    h = [[0.0] * size for _ in range(size)]
    dg = [[0.0] * size for _ in range(size)]
    dh = [[0.0] * size for _ in range(size)]

    for line in lines:
        parts = line.split()
        if not parts or parts[0] not in ("g", "h"):
            continue
        n, m = int(parts[1]), int(parts[2])
        if n > NMAX:
            continue
        values = parts[3:]
        main = float(values[main_col])
        rate = float(values[sv_col])
        if parts[0] == "g":
            g[n][m], dg[n][m] = main, rate
        else:
            h[n][m], dh[n][m] = main, rate

    if g[1][0] == 0.0:
        raise ValueError("IGRF g(1,0) came out zero; the column indexing is wrong")

    return g, h, dg, dh


# --------------------------------------------------------------------------
# Field evaluation
# --------------------------------------------------------------------------

def _schmidt_factors() -> list[list[float]]:
    """Gauss-normalised -> Schmidt quasi-normalised conversion factors.

    The Legendre recursion below is the plain Gauss-normalised one; IGRF's
    coefficients assume Schmidt quasi-normalisation, so each term is rescaled
    by S[n][m] before it is used.
    """
    size = NMAX + 1
    s = [[0.0] * size for _ in range(size)]
    s[0][0] = 1.0

    for n in range(1, size):
        s[n][0] = s[n - 1][0] * (2 * n - 1) / n
        for m in range(1, n + 1):
            # The m == 1 term picks up the extra factor of 2 that separates
            # Schmidt quasi-normalisation from full normalisation.
            extra = 2.0 if m == 1 else 1.0
            s[n][m] = s[n][m - 1] * math.sqrt((n - m + 1) * extra / (n + m))

    return s


SCHMIDT = _schmidt_factors()


def _legendre(theta: float) -> tuple[list[list[float]], list[list[float]]]:
    """Schmidt quasi-normalised associated Legendre functions and d/dtheta."""
    size = NMAX + 1
    p = [[0.0] * size for _ in range(size)]
    dp = [[0.0] * size for _ in range(size)]

    cos_t, sin_t = math.cos(theta), math.sin(theta)
    p[0][0] = 1.0

    # Gauss-normalised recursion.
    for n in range(1, size):
        for m in range(0, n + 1):
            if m == n:
                p[n][n] = sin_t * p[n - 1][n - 1]
                dp[n][n] = sin_t * dp[n - 1][n - 1] + cos_t * p[n - 1][n - 1]
            else:
                k = 0.0 if n == 1 else ((n - 1) ** 2 - m * m) / ((2 * n - 1) * (2 * n - 3))
                p[n][m] = cos_t * p[n - 1][m] - k * p[n - 2][m]
                dp[n][m] = cos_t * dp[n - 1][m] - sin_t * p[n - 1][m] - k * dp[n - 2][m]

    # Rescale to Schmidt.
    for n in range(1, size):
        for m in range(0, n + 1):
            factor = SCHMIDT[n][m]
            p[n][m] *= factor
            dp[n][m] *= factor

    return p, dp


def _field(lat_deg: float, lon_deg: float, year: float, coeffs) -> tuple[float, float, float, float]:
    """Geomagnetic field vector at sea level: (x, y, z, x_geo).

    x, y, z are the geocentric north/east/down components; x_geo is x rotated
    back to geodetic north, which only declination (the horizontal bearing)
    needs -- total intensity is rotation-invariant, so callers that only want
    that can ignore it.
    """
    g, h, dg, dh = coeffs
    dt = year - MODEL_EPOCH

    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    sin_lat, cos_lat = math.sin(lat), math.cos(lat)

    # Geodetic (WGS84 surface) to geocentric spherical.
    a2, b2 = WGS84_A ** 2, WGS84_B ** 2
    rho = math.sqrt(a2 * cos_lat ** 2 + b2 * sin_lat ** 2)
    r = math.sqrt((a2 * a2 * cos_lat ** 2 + b2 * b2 * sin_lat ** 2) / (rho ** 2))
    cd = rho / r                                        # cos(geodetic - geocentric)
    sd = (a2 - b2) / rho * sin_lat * cos_lat / r        # sin(same)

    sin_gc = sin_lat * cd - cos_lat * sd
    cos_gc = cos_lat * cd + sin_lat * sd
    theta = math.atan2(cos_gc, sin_gc)                  # geocentric colatitude
    p, dp = _legendre(theta)

    ratio = EARTH_RADIUS / r
    x = y = z = 0.0

    for n in range(1, NMAX + 1):
        f = ratio ** (n + 2)
        for m in range(0, n + 1):
            gnm = g[n][m] + dt * dg[n][m]
            hnm = h[n][m] + dt * dh[n][m]
            cos_m, sin_m = math.cos(m * lon), math.sin(m * lon)

            common = gnm * cos_m + hnm * sin_m
            x += f * common * dp[n][m]
            y += f * m * (gnm * sin_m - hnm * cos_m) * p[n][m]
            z -= f * (n + 1) * common * p[n][m]

    y /= math.sin(theta)

    # Rotate the geocentric north/down components back to geodetic.
    x_geo = x * cd + z * sd
    return x, y, z, x_geo


def declination(lat_deg: float, lon_deg: float, year: float, coeffs) -> float:
    """Magnetic declination in degrees east of true north, at sea level."""
    _x, y, _z, x_geo = _field(lat_deg, lon_deg, year, coeffs)
    return math.degrees(math.atan2(y, x_geo))


def total_intensity(lat_deg: float, lon_deg: float, year: float, coeffs) -> float:
    """Total magnetic field strength, nanotesla, at sea level.

    What a magnetometer actually measures the magnitude of. Comparing this
    against a live reading is how the app tells "your compass heading is
    probably fine" from "there is a speaker magnet three centimetres from the
    sensor" -- a discrepancy here means the reading is not to be trusted,
    regardless of what heading it implies.
    """
    x, y, z, _x_geo = _field(lat_deg, lon_deg, year, coeffs)
    return math.sqrt(x * x + y * y + z * z)


# --------------------------------------------------------------------------
# Verification
# --------------------------------------------------------------------------

def verify(coeffs) -> float:
    """Compare against NOAA's WMM test values. Returns the worst deviation."""
    text = fetch(TEST_URL, TEST_FILE).decode("utf-8", "replace")
    worst = 0.0
    checked = 0

    for line in text.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        parts = line.split()
        if len(parts) < 11:
            continue
        try:
            year, height, lat, lon = (float(parts[i]) for i in range(4))
            expected = float(parts[10])
        except ValueError:
            continue

        if height != 0.0 or abs(lat) > 85.0:
            continue  # the grid is sea level, and stops short of the poles

        delta = abs(declination(lat, lon, year, coeffs) - expected)
        delta = min(delta, 360.0 - delta)
        worst = max(worst, delta)
        checked += 1

    log(f"  verify  {checked} NOAA test points, worst declination difference {worst:.3f} deg")
    if worst > TEST_TOLERANCE_DEG:
        log(f"  WARNING exceeds the {TEST_TOLERANCE_DEG} deg tolerance - check the harmonic sum")
    return worst


# --------------------------------------------------------------------------

def main() -> int:
    log("build_declination")

    coeffs = load_coefficients()
    worst = verify(coeffs)

    lat_count = int((LAT_MAX - LAT_MIN) / LAT_STEP) + 1
    decl: list[float] = []
    rate: list[float] = []
    intensity: list[float] = []

    for i in range(lat_count):
        lat = LAT_MIN + i * LAT_STEP
        for j in range(LON_COUNT):
            lon = LON_MIN + j * LON_STEP
            now = declination(lat, lon, MODEL_EPOCH, coeffs)
            later = declination(lat, lon, MODEL_EPOCH + 1.0, coeffs)
            change = later - now
            # Keep the yearly change on the short side of the circle.
            change = (change + 180.0) % 360.0 - 180.0
            decl.append(rounded(now, 2))
            rate.append(rounded(change, 3))
            intensity.append(rounded(total_intensity(lat, lon, MODEL_EPOCH, coeffs), 0))

    payload = {
        "model": "IGRF-14",
        "url": IGRF_URL,
        "epoch": MODEL_EPOCH,
        "note": (
            "Declination in degrees east of true north at sea level; total field "
            "intensity in nanotesla. Row-major, latitude outer."
        ),
        "latMin": LAT_MIN,
        "latMax": LAT_MAX,
        "latStep": LAT_STEP,
        "latCount": lat_count,
        "lonMin": LON_MIN,
        "lonStep": LON_STEP,
        "lonCount": LON_COUNT,
        "lonWraps": True,
        "verifiedAgainst": "NOAA WMM2025 test values",
        "worstTestDeviationDeg": rounded(worst, 3),
        "decl": decl,
        "rate": rate,
        "intensity": intensity,
    }

    write_json(
        "declination.json",
        payload,
        note=f"{lat_count}x{LON_COUNT} grid ({len(decl):,} cells)",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
