# 2026-08-31

Refraction was the big one. It was already written and already tested in
coords.ts — `refraction()` and `applyRefraction()`, correct, sitting there —
but nothing ever called them from the actual render path. The atmosphere
lifts everything near the horizon by up to half a degree, bigger than every
other correction I touched this session combined, and it had been a no-op
the whole time. Wired it into `toHorizontal()` and the Moon/Sun/planet path,
with a settings toggle for a true airless altitude when you want it.

Went down the rest of the list in order after that: Delta-T, proper motion
(HYG has had pmra/pmdec in the source CSV the whole time, the pipeline just
wasn't reading them), nutation, aberration, then a lighter topocentric
parallax term for the planets. Once nutation and aberration were in, the
Moon's Horizons tolerance came down from 90″ to 25″ — measured worst case
across six re-fetched epochs is now under 14″. Widened the fixture set from
four dates bunched in 2024–2027 to six spanning 2021–2045. That surfaced real
growth in Mercury's and Uranus's error near the edges of the element set's
1800–2050 validity window — still inside JPL's own published bounds, but
enough to need wider tolerances there, with the reason written down instead
of the number just changed quietly.

After the accuracy pass: multi-point compass calibration, a native Android
rotation-vector plugin (can't test it without hardware, said so in the
commit), a daylight/twilight visibility model, and capability-based device
behavior — camera only requests on touch-primary devices now, confirmed with
a fake-camera-device test that a mouse-primary session never opens a stream.

Right now: permission memory, mid-task. The plan was to skip the enable
screen on a return visit if the OS already granted everything. Code assumed
`DeviceOrientationEvent.requestPermission` only exists on iOS Safari — that's
what the comment says. A headless-Chrome test just came back with that
function present on desktop Chrome too, in this environment, before I'd
finished checking why. Either Chrome is gating motion permission now, or
something in the test setup is faking it, and those two need different
fixes. Not landing anything until I know which.

Next: run that down, then finish the settings permissions-recovery row.
