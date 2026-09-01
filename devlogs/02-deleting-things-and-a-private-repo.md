# 2026-08-31

Two goals: strip the dead weight that built up across the accuracy work, then
get the web build onto a public URL so the Play listing has a privacy policy
to point at.

The cleanup went first. I went looking for dead code by counting references
to every exported symbol rather than guessing, which turned up seven things
with literally zero callers: `julianCenturies`, `localSiderealTimeAt`,
`platform()`, `HeadingFilter.reset()` and its `current` getter,
`OrientationSource.stop()`, an unused `cameraPermissionRow` handle, and a
`stop()` on the native rotation-vector plugin that neither side of the bridge
ever called. Two CSS rules matched nothing — `.chips` was styling a class no
element carries, because the card uses `id="card-chips"` with inline flex.
Two comments had drifted into being wrong: `catalog.ts` claimed 2,850 stars
get transformed per recompute when the catalogue ships 1,009, and the README
still advertised a 44 KB payload that is now 57 KB after proper motion and
field intensity got added. Twelve commits, 124 lines out, 5 in. Tests stayed
at 118 the whole way.

Then Pages. I checked `base: './'` actually works from a subpath instead of
assuming — served the build under `/stargaze/` locally and booted it in a
browser. It works, all assets 200, catalogue loads. That check earned its
keep anyway: it caught the browser's default `/favicon.ico` request 404ing,
which is one line in `index.html` to fix.

Then the actual wall. `gh api -X POST .../pages` came back with "Your current
plan does not support GitHub Pages for this repository." The repo is private,
and Pages on a private repo needs a paid plan. So the deploy is written and
committed but has never run.

Right now: the workflow, `vercel.json` and the privacy policy page are all in
and verified locally — `privacy.html` returns 200 from the subpath build. None
of it is live anywhere.

Next: decide whether this repo goes public. Everything downstream — the live
URL, the Play Store policy link — is waiting on that one call.
