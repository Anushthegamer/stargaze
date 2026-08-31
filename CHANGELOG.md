# Changelog

## Unreleased

- Replaced the stock Capacitor launcher icon and splash screen (both were
  still the default blue bridge mark) with a real adaptive icon set and
  matching splash images generated from `packages/web/public/icon.svg`.
- `STORE.md`: Play Store listing copy, permission justifications, and a Data
  Safety declaration, plus store screenshots at phone and tablet sizes.
- Monthly CI re-verification against live sources: a fresh JPL Horizons
  epoch (not the committed fixtures), NOAA's IGRF test values as a hard
  gate, and upstream catalogue hash-pinning. Opens an issue on failure.
- The magnetic declination model now carries its own expiry, and the app
  flags the correction as stale once the device clock is past IGRF's
  secular-variation forecast window instead of quietly extrapolating.

## [0.2.0] - 2026-08-31

Accuracy corrections ordered by error magnitude, device/permission handling
that follows actual capability, and a visibility model that stops drawing
what daylight or moonlight has already washed out.

### Accuracy

- Atmospheric refraction is now applied to every rendered position. It was
  already implemented and tested in `coords.ts`, but nothing called it — the
  atmosphere lifts objects near the horizon by up to half a degree, larger
  than every other correction below combined. On by default; a Settings
  toggle gives the true (airless) altitude.
- Delta-T (TT − UT, ~69s) is now modeled, so the Moon and planet theories run
  on Terrestrial Time instead of UTC treated as if it were TT.
- Proper motion: the star catalogue pipeline now reads HYG's `pmra`/`pmdec`
  columns (it always had them) and applies them before precession.
- Nutation and annual aberration (new `apparent.ts`) are applied to stars,
  Sun, planets and the Moon. The Moon's Horizons test tolerance tightens from
  90″ to 25″ now that both are modeled — measured worst case across the
  fixture epochs is under 14″.
- Topocentric (diurnal) parallax now applies to the Sun and planets, not just
  the Moon. Venus at closest approach is displaced by up to ~30″.
- The JPL Horizons fixture set widens from four epochs clustered in
  2024–2027 to six spanning 2021–2045, refetched live. Testing nearer the
  edges of the 1800–2050 element-set validity window surfaced genuinely
  larger (still within JPL's published bounds) error for Mercury and Uranus,
  so their test tolerances widen to match.

### Compass

- Multi-point calibration: up to three sightings combine via a circular
  mean, with any sighting more than 90° from the rest dropped as aimed at
  the wrong object.
- Calibration now persists with when and where it was measured, and is
  flagged (not silently reset) as possibly stale after 14 days or a 20km
  move.
- Magnetic interference detection: the declination data pipeline now emits
  total field intensity (nanotesla) alongside declination. Where the Generic
  Sensor API exposes a live magnetometer reading (Chrome/Android only), a
  live reading well outside the IGRF-predicted field for the current
  location flags the heading as unreliable.
- Android: a native plugin streams `TYPE_ROTATION_VECTOR` (hardware-fused
  gyroscope + accelerometer + magnetometer) directly into the existing
  quaternion-based orientation path, preferred over the browser's
  `DeviceOrientationEvent` where it's available. Built to the documented
  sensor contract; not yet verified on physical hardware.

### Visibility

- New sky-brightness model (`limitingMagnitude`) replaces a binary day/night
  flag: a faintest-observable magnitude derived from solar-altitude twilight
  bands plus a Moon washout term. Objects fainter than the limit still
  render — at reduced opacity, not hidden — and the Tonight/Search lists sort
  observable-now objects first, with a caption explaining what's washed out
  and why. The Moon itself is always exempt.

### Device and permissions

- Camera is only requested on touch-primary devices (`pointer: coarse`) —
  a laptop's front-facing webcam no longer gets used as a fake sky
  background.
- Keyboard controls on mouse-and-keyboard devices: arrows to look around in
  drag mode, +/− to zoom, `/` to search, Escape to close.
- Sheets become a right-anchored side panel at 840px and wider instead of a
  bottom drawer.
- The permission gate is skipped on a return visit once the OS already
  granted everything it can check for (camera, location) — except wherever
  motion needs a gesture-gated prompt, which is asked fresh every time,
  since that grant does not reliably persist.
- Android's native permission checks now call `checkPermissions()` before
  `requestPermissions()`, so an already-granted permission never triggers a
  second system dialog.
- A revoked camera permission can be re-requested from Settings without
  clearing site data.
- The first-screen copy no longer claims "no guesswork" — the compass is
  typically off by several degrees, stated plainly where it's relevant
  rather than contradicted by the tagline above it.

### Also in this release

- Dead code removed (two unused exported functions), unused Capacitor
  template test files removed, pre-implementation design mockups moved out
  of the repository.
- Android release build config: debug bridge disabled for release,
  `minifyEnabled`/`shrinkResources` turned on.
- MIT license added; GitHub Actions CI (typecheck, test, build) added.
- Responsive layout: the chrome no longer stretches edge-to-edge above
  phone width, and gained pointer-gated hover states.
