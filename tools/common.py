"""Shared helpers for the StarGaze build-time data pipeline.

Deliberately stdlib-only: the output of these scripts is committed, so the
pipeline should keep running years from now without a dependency resolver
having an opinion about it.
"""

from __future__ import annotations

import gzip
import json
import sys
import urllib.request
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
ROOT = TOOLS_DIR.parent
CACHE_DIR = TOOLS_DIR / ".cache"
DATA_DIR = ROOT / "packages" / "web" / "public" / "data"

USER_AGENT = "stargaze-data-pipeline/1.0 (+https://github.com/)"


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def fetch(url: str, filename: str, *, decompress: bool = False) -> bytes:
    """Download `url` once into tools/.cache and return its bytes.

    Re-runs are served from the cache, so every build script can fetch whatever
    it needs without the pipeline hitting the network more than once per source.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / filename

    if cached.exists():
        raw = cached.read_bytes()
        log(f"  cached  {filename} ({len(raw):,} bytes)")
    else:
        log(f"  fetch   {url}")
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=300) as response:
            raw = response.read()
        cached.write_bytes(raw)
        log(f"  saved   {filename} ({len(raw):,} bytes)")

    return gzip.decompress(raw) if decompress else raw


def write_json(name: str, payload: object, *, note: str = "") -> Path:
    """Write `payload` to the web client's public data directory."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / name
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    path.write_text(text + "\n", encoding="utf-8")

    size = len(text.encode("utf-8"))
    suffix = f"  {note}" if note else ""
    log(f"  wrote   {path.relative_to(ROOT)} ({size:,} bytes){suffix}")
    return path


def rounded(value: float, digits: int) -> float:
    """Round for serialisation, collapsing -0.0 so the JSON stays tidy."""
    result = round(value, digits)
    return 0.0 if result == 0 else result
