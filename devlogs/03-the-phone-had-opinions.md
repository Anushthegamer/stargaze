# 2026-09-01

Goal was to get the web build deployed and then finally run this thing on a
phone. Both happened. The phone had opinions.

Pages went up once the repo went public — the free plan won't serve Pages from
a private repo, which is why it had been sitting there written but never run.
`base: './'` turned out to be right, but I checked it under a real `/stargaze/`
subpath instead of assuming, and that caught the browser's default
`/favicon.ico` 404ing. Then I actually verified the offline claim for the first
time: loaded it, killed the network, reloaded. Service worker had precached 9
entries and the whole thing came back up with all 1,009 stars. That premise has
been in the README since the beginning and had never once been tested.

Then the device test, which was worth more than everything else combined.

Good news first: the native `TYPE_ROTATION_VECTOR` plugin works. That was
Kotlin written completely blind — no machine here has a magnetometer, so it had
never produced a single reading. It tracks.

Two real bugs, both mine, both invisible from a desktop:

The permission gate came back on every launch despite being approved. I'd
written `everythingAlreadyGranted()` against `navigator.permissions.query`,
which inside a Capacitor WebView reports on the WebView, not on the Android
app-level grant. So an app the user had already approved always read as
unapproved. Capacitor's `checkPermissions()` asks Android and gets it right.

The compass was inaccurate, and the reason is embarrassing in a familiar way. I
was shipping the raw rotation-vector quaternion to JS and deriving the heading
myself, on the strength of a comment I wrote saying Android reports in an
East-North-Up frame needing no remapping. I had no device to check that against.
It's the same failure this project has hit twice before — the mirrored up-axis,
the 24°-out declination — code that is confidently, plausibly wrong. Now it
calls `getRotationMatrixFromVector` then `getOrientation`, the same pair every
compass app uses, and feeds the existing tested `basisFromDeviceOrientation`
path instead of a second orientation path running in parallel. Found a real
edge case doing it: some devices append a heading-accuracy value, and the
framework rejects a five-element vector outright.

Also deleted `vercel.json` earlier in the day reasoning it was redundant now
Pages was live. It wasn't redundant, it was unused — without it Vercel
auto-detects, finds `server/` declaring `node index.js`, and builds the Express
HTTPS server as a serverless function, where it tries to mint a TLS cert and
call `listen()`. Every request 500'd. Restored.

Where I am: compass and permissions confirmed fixed on device. Pages live and
public. Vercel deployed but sitting behind Vercel Authentication, so it serves
a login wall — 200 on every route, which is a good reminder that status codes
prove nothing about content. 118 tests green.

Next: turn off deployment protection on Vercel, or just don't bother — Pages
does the job. Then the outdoor accuracy check, which is the one thing still
genuinely unverified. Indoors at a desk the compass is worthless regardless of
whether the code is right.
