# StarGaze

Point your phone at the night sky and it tells you what you are looking at.

No image recognition. A phone photo of the night sky is a noisy black square
with a few faint dots in it — there is nothing there for a vision model to work
with, and running one would burn the battery to produce a bad guess. The apps
that do this well don't look at the sky at all. They ask three sensors:

- **GPS** — your latitude and longitude. The stars over Bengaluru are not the
  stars over Reykjavík.
- **The clock** — the exact instant. The sky turns 15° an hour.
- **Magnetometer and gyroscope** — the direction and angle the camera is aimed
  at.

Those three fully determine your view. From there it is spherical trigonometry
against a star catalogue: cheap, exact, and 60fps on a budget phone.

## Status

| Step | State |
|---|---|
| `tools/` — Python data pipeline | done |
| `packages/core` — astronomy, verified against JPL | done, 78 tests |
| `packages/web` — camera AR client | done |
| `server/` — HTTPS host for LAN testing | done |
| `android/` — Capacitor wrapper | done, APK builds |

```bash
npm install && npm run data && npm run dev
```

The client runs at `http://localhost:5173`. It opens on the permission gate;
**Skip — just show me the sky** goes straight to drag mode, which needs no
sensors and is how this is developed.

## Testing on a phone

The trap worth knowing about: camera, geolocation and motion are all gated
behind a **secure context**. `http://192.168.1.42:5173` is not one, and the
failure is silent — no error, no permission prompt, just a page that never asks
for anything. Both device paths avoid it.

**Over the network**, with a self-signed certificate:

```bash
npm run serve
```

Prints every address the machine answers on. The phone warns about the
certificate once; accept it and the sensors start working. `npm run dev:https`
does the same for the dev server, with hot reload.

**As an app**, which sidesteps the whole problem — the WebView serves from
`https://localhost`, so it is a secure context by construction:

```bash
npm run android:open
```

## Building the Android app

```bash
npm run android:sync    # build the web bundle and copy it into android/
npm run android:open    # ...and open Android Studio
```

The APK is `android/app/build/outputs/apk/debug/app-debug.apk` (8.9 MB, with the
entire sky inside it).

**You will need a JDK 21.** Android Studio bundles JDK 25, and Gradle 8.14
refuses to run on it — `unsupported class file major version 69`. Capacitor
pins AGP 8.x, which pins Gradle 8.x, so upgrading Gradle is not the way out.
Point `JAVA_HOME` at a JDK 21 before building:

```bash
JAVA_HOME=/path/to/jdk-21 ./gradlew assembleDebug
```

The emulator needs a system image installed from Android Studio's SDK manager,
and is worth treating as a smoke test only: **emulators fake the magnetometer**,
so the compass — the one genuinely uncertain part of this — can only be judged
on a real phone.

## Not done yet

Listed here rather than left implied, so nothing looks finished that isn't.

- **A native rotation-vector plugin.** The WebView's `DeviceOrientation` is used
  for now. If it proves too coarse on real hardware, Android's
  `TYPE_ROTATION_VECTOR` fuses gyroscope, accelerometer and magnetometer in
  hardware and is steadier. `basisFromQuaternion` in `orientation.ts` already
  accepts exactly what that sensor produces, so the plugin drops in behind the
  existing interface without touching anything else.
- **Nothing has run on real hardware yet.** Everything here is verified against
  JPL and against physical facts, but the compass is the one part that can only
  be judged in the field.
- Rise/set for the Moon assumes a fixed position across the day, so its times
  are good to a few minutes rather than seconds.
- No deep-sky objects, and Saturn's rings are not modelled.

## Layout

```
tools/       Build-time Python: catalogues in, JSON out. Never runs in the app.
packages/
  core/      On-device astronomy. No DOM, no network, no state. Shared by both clients.
  web/       Vite PWA client. public/data/ holds the generated catalogues.
server/      Express + a self-signed cert, for testing on a real phone.
android/     Capacitor project wrapping the same web build.
```

## Getting started

```bash
npm install
```

```bash
npm run data
```

Builds the star catalogue, constellation figures, planetary elements and
magnetic declination grid into `packages/web/public/data/`. Needs Python 3.9+
and **no pip packages at all** — see [tools/README.md](tools/README.md).
Downloads are cached, so re-runs are offline.

```bash
npm test
```

## How it fits together

Everything runs on the device. The Python in `tools/` runs once at build time
and its output is committed; the app loads five JSON files totalling **~57 KB
gzipped** and does the rest itself. That is what lets it work in a field with no
signal, which is exactly where it gets used.

Per frame, `packages/core` runs this chain:

1. `julianDate(new Date())` — when
2. `localSiderealTime(jd, longitude)` — which part of the sky is overhead
3. `toHorizontal(...)` — the catalogue into your sky, as altitude and azimuth
4. `basisFromDeviceOrientation(...)` — where the phone is pointed
5. `project(...)` — your sky onto the screen

Steps 1–3 change slowly and run on a timer. Steps 4–5 run every frame.

## On being right

Positional astronomy is full of sign flips and degree/radian slips that produce
answers which look plausible and are wrong. Two things guard against that.

**The ephemeris is checked against JPL Horizons.** `tools/fetch_reference.py`
pulls real positions for the Sun, Moon and planets at four epochs spread across
several years; the tests assert against them offline. Worst-case error:

| Body | Error | Body | Error |
|---|---|---|---|
| Mercury | 4.7″ | Jupiter | 195.6″ |
| Venus | 14.7″ | Saturn | 288.4″ |
| Sun | 10.5″ | Uranus\* | 52.2″ |
| Mars | 29.5″ | Neptune\* | 34.4″ |
| Moon (topocentric) | 52.2″ | | |

\* Verified but never drawn — see *What it shows* below.

Every one is inside JPL's own published bound for this element set — they
document 400″ for Jupiter and 600″ for Saturn, because a fixed ellipse cannot
express the giant planets perturbing each other. The test tolerances are those
published numbers, not numbers picked to make the suite green. For scale: a
phone compass is off by **5–15°**, which is 18,000–54,000″. The ephemeris is
nowhere near the limiting factor.

**The geometry is checked against physical facts.** Polaris sits at your
latitude. An object on your meridian at your declination is overhead. Things
rise in the east. Lie the phone flat and the camera looks at the floor. Tap a
pixel and unprojecting it returns the direction that projects back onto it.

That second set is not ceremony. Writing it caught a real bug: the up axis was
computed as `forward × right` instead of `right × forward`, which renders the
entire sky vertically mirrored — and passes an orthonormality check, because a
down-vector is still a perfectly good orthonormal basis vector. Only a test that
asked "is higher actually higher on screen" found it.

Two other bugs the tests caught: the magnetic declination model used
Gauss-normalised Legendre functions where IGRF assumes Schmidt
quasi-normalisation, putting it **24° out**; and the planets were being rotated
into equatorial coordinates with the obliquity of date rather than of J2000,
quietly mixing reference frames.

## What it shows

Only what you could actually photograph with a phone, standing on the ground.

**Five planets** — Mercury, Venus, Mars, Jupiter, Saturn. The ones people have
been able to see since before any of this was written down. Uranus (magnitude
~5.7) and Neptune (~7.9) are computed and tested but never drawn: a phone cannot
record either, and a marker hovering over a patch of empty sky is worse than no
marker. It teaches you the overlay is unreliable at exactly the moment you are
deciding whether to trust it.

**Stars to magnitude 4.5** — roughly a phone's reach handheld in a genuinely
dark place, and well past it in a town, where the magnitude slider pulls it
back further. That is 1,009 stars, down from the 2,850 a dark-adapted eye
manages. Constellation figures lose nothing: line vertices ship whatever their
brightness, so all 88 stay complete.

**The Moon**, which is the easiest thing in the sky to photograph and the best
target for checking the overlay is aligned.

## Known limits

- **The compass is the weak link**, by a wide margin. Phone magnetometers are
  good to ±5–15°, worse near metal, speakers or a car. Everything else here is
  accurate to arcseconds. Settings → *Calibrate on a known star* corrects for it:
  aim at something you can see, confirm, and the difference between where the
  sensors claim you are pointing and where that object actually is becomes a
  stored offset.
- Magnetic declination is interpolated on a 5° grid and stops at ±85°
  latitude, where declination changes too fast to interpolate and a compass is
  useless anyway. Outside that band the app reports the correction as
  unreliable rather than guessing.

## Credits

Star and constellation data, planetary elements and the geomagnetic model are
all free to use — see [NOTICE.md](NOTICE.md).

## License

MIT — see [LICENSE](LICENSE). Bundled datasets keep their own licenses; see
[NOTICE.md](NOTICE.md).
