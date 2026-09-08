# RA-462 — Concurrent-login notification: E2E (frontend journey tests)

**Status:** Implemented — `test/specs/ra-462-concurrent-logins.e2e.js`, live
(not `describe.skip`). It runs against a frontend built from a branch matching
this PR's head ref: `run-journey-tests` resolves
`DEFRA/epr-register-enrol-frontend` by exact branch name, and both branches are
`feature/RA-462-ConcurrentLogins`, so the built frontend carries the feature.

## What the spec asserts

Single Chrome instance, two cookie jars in one run: stub-login (jar A),
`browser.getCookies()`, `browser.reloadSession()` for a clean jar B,
stub-login again as the same regulator.

1. **the just-signed-in session (B) sees a session-notice** —
   `[data-testid="session-notice"]` is displayed.
2. **the already-active session (A) is not signed out** — restore jar A,
   navigate, assert the URL is not an `/auth/*` login page and the sign-out
   link still renders.
3. **the notice dismisses** — on session B (whose notice is a stable
   session-flag render), click `[data-testid="session-notice-dismiss"]` and
   assert the notice is gone.

## Deliberately not asserted here

The `alert` vs `info` variant, the "a new sign-in was detected at HH:MM"
wording, dismissal persistence across navigations, and the third-login
re-raise are **covered by `concurrent-login.test.js` in
`epr-register-enrol-frontend`**, not re-checked here. Reason: the journey grid
runs many parallel browsers as the **same** stub user, so the per-identity
registry that decides the alert variant is churned continuously by other
specs — a single spec cannot pin it. The two assertions that do run in the
grid target the just-signed-in session, whose notice comes from its own yar
session flag rather than a live shared-registry read.

The no-JS fallback (banner renders in flow, "Hide" posts a full-page form) is
exercised by `concurrent-login.test.js` / the component test in the frontend
repo; adding a JS-disabled Chrome variant here was descoped as low value
against the grid-churn constraints above.

## Manual verification (EXT-TEST)

Two real browsers as the same operator: the second shows the "signed in
elsewhere" notice; the first, on its next page, shows "a new sign-in was
detected" with a sign-out link and stays usable; dismiss clears it; a third
sign-in re-raises it. Repeat for a regulator via Entra ID. Screen-reader pass
on both variants.
