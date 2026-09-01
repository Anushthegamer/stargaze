# StarGaze

**Point your phone at the night sky and it tells you what you're looking at.**

[**Try it now →**](https://ramskandh-thirandasu.github.io/stargaze/) · works in any
browser, installs as an app, runs offline

<p align="center">
  <img src="store/screenshots/phone/1-sky.png" alt="The sky view: constellation figures, a compass strip, and altitude and azimuth readouts" width="300">
  <img src="store/screenshots/phone/2-tonight.png" alt="The Tonight list, ordered by what is actually observable right now" width="300">
</p>

## How it works

No image recognition. A phone photo of the night sky is a noisy black square
with a few faint dots in it — there's nothing there for a vision model to work
with. The apps that do this well don't look at the sky at all. They ask three
sensors:

- **GPS** — your latitude and longitude. The stars over Bengaluru are not the
  stars over Reykjavík.
- **The clock** — the exact instant. The sky turns 15° an hour.
- **Magnetometer and gyroscope** — which way the phone is pointed.

Those three fully determine your view. From there it's spherical trigonometry
against a star catalogue: cheap, exact, and it runs on a budget phone.

Everything is computed on the device. Nothing about where you are is ever
transmitted — there's no backend, no account, and no analytics.

## What it shows

Only what you could actually photograph with a phone, standing on the ground.

- **1,009 stars to magnitude 4.5** — roughly a phone's reach under a genuinely
  dark sky. All 88 constellation figures stay complete.
- **Five planets** — Mercury, Venus, Mars, Jupiter, Saturn. Uranus and Neptune
  are computed and tested but never drawn: a phone can't record either, and a
  marker over empty sky teaches you the overlay is unreliable exactly when
  you're deciding whether to trust it.
- **The Moon**, with its current phase — the easiest thing up there to
  photograph, and the best target for checking the overlay is aligned.

Objects that are up but washed out by daylight or moonlight are still drawn,
dimmed, and listed as washed out rather than silently dropped. "There, but you
won't see it" is useful information; vanishing is not.

## Features

- **Works completely offline.** The catalogue, constellation figures, planetary
  elements and geomagnetic model are all bundled — five JSON files, ~57 KB
  gzipped. Nothing is fetched after install.
- **Live camera view** behind the overlay, so you can line the markers up
  against the real sky. Entirely optional.
- **Compass calibration.** Phone magnetometers run 5–15° out. Sight a star you
  can actually see, confirm, and the offset is stored — up to three sightings
  combined, expiring after 14 days or a 20 km move.
- **Magnetic interference warning** when the measured field disagrees with the
  IGRF model, because a compass next to a speaker is not to be trusted.
- **Search and a Tonight list**, ordered by what's genuinely observable now.
- **Drag mode** — works with no permissions at all, on any device.

## Run it

```bash
npm install
npm test          # 118 tests
npm run dev       # http://localhost:5173
```

Rebuilding the catalogues is optional — their output is committed:

```bash
npm run data      # Python 3.9+, no pip packages
```

### On a phone

Camera, location and motion all require a **secure context**, and fail silently
without one — `http://192.168.1.42:5173` is not one.

```bash
npm run serve     # HTTPS with a self-signed cert, prints every LAN address
```

The phone warns about the certificate once. That's expected; accept it. The
[live site](https://ramskandh-thirandasu.github.io/stargaze/) sidesteps this
entirely, as does the Android build.

### Android

```bash
npm run android:sync
npm run android:open
```

**Needs JDK 21**, and only 21 — Gradle 8.x (pinned by Capacitor's AGP) rejects
newer ones with `Unsupported class file major version`, including the JDK
Android Studio bundles. The debug APK lands at
`android/app/build/outputs/apk/debug/app-debug.apk`.

## On being right

Positional astronomy is full of sign flips and degree/radian slips that produce
answers which look plausible and are wrong. Two things guard against that.

**The ephemeris is checked against JPL Horizons** at six epochs spanning
2021–2045. Measured worst case:

| Body | Error | Body | Error |
|---|---|---|---|
| Sun | 13.5″ | Jupiter | 368.3″ |
| Mercury | 21.7″ | Saturn | 435.0″ |
| Venus | 18.0″ | Uranus\* | 110.2″ |
| Mars | 31.7″ | Neptune\* | 34.4″ |
| Moon (topocentric) | 16.5″ | | |

\* Computed and tested but never drawn.

Every one is inside JPL's published bound for this element set — they document
400″ for Jupiter and 600″ for Saturn, because a fixed ellipse can't express the
giant planets perturbing each other. For scale: a phone compass is off by
**5–15°**, or 18,000–54,000″. The ephemeris is nowhere near the limiting factor.

Applied on top of the catalogue positions: atmospheric refraction, Delta-T,
proper motion, nutation, annual aberration and topocentric parallax.

**The geometry is checked against physical facts.** Polaris sits at your
latitude. Things rise in the east. Lie the phone flat and the camera looks at
the floor. Tap a pixel and unprojecting it returns the direction that projects
back onto it.

That second set isn't ceremony — it caught three real bugs:

- The up axis was computed as `forward × right` instead of `right × forward`,
  rendering the entire sky mirrored. It passed an orthonormality check, because
  a down-vector is still a perfectly good orthonormal basis vector.
- The magnetic model used Gauss-normalised Legendre functions where IGRF
  assumes Schmidt quasi-normalisation — **24° out**.
- Planets were rotated into equatorial coordinates with the obliquity of date
  rather than of J2000, quietly mixing reference frames.

Because fixtures only prove a moment in time, a monthly workflow re-checks the
ephemeris against a **fresh** Horizons epoch, re-verifies IGRF against NOAA's
published values, and hash-pins the upstream catalogues — opening an issue on
failure rather than failing quietly.

## Known limits

- **The compass is the weak link**, by a wide margin, and no amount of software
  fixes a magnetometer. Indoors it's worthless — desk metal and building steel
  pull it by tens of degrees, which is what the interference warning is for.
  Outdoors, calibration gets it usable.
- Magnetic declination is interpolated on a 5° grid, stops at ±85° latitude, and
  is flagged stale past IGRF-14's 2030 forecast window rather than extrapolated
  quietly.
- Moon rise/set assumes a fixed position across the day, so those times are good
  to a few minutes rather than seconds.
- No deep-sky objects, and Saturn's rings aren't modelled.

## Layout

```
tools/       Build-time Python: catalogues in, JSON out. Never runs in the app.
packages/
  core/      On-device astronomy. No DOM, no network, no state. 118 tests.
  web/       Vite PWA client. public/data/ holds the generated catalogues.
server/      Express + a self-signed cert, for testing on a real phone.
android/     Capacitor project wrapping the same web build.
```

## Credits

Star and constellation data, planetary elements and the geomagnetic model are
all free to use — see [NOTICE.md](NOTICE.md).

## License

MIT — see [LICENSE](LICENSE). Bundled datasets keep their own licenses.
