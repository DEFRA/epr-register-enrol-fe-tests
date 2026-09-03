# RA-462 — Concurrent logins: E2E test plan (frontend journey tests)

**Status:** Plan only — the spec is not written yet. Policy chosen by product on
2026-09-02: **allow concurrent sessions, show a dismissible toast** (no forced
sign-out). See
`epr-register-enrol-frontend/docs/RA-462-concurrent-logins-design.md`.
**Branch:** `feature/RA-462-ConcurrentLogins`

## What is being verified

- A second login for the same identity leaves **both** sessions usable.
- The session already active before the second login shows an **alert** toast
  ("a new sign-in was detected …").
- The session that just logged in shows an **info** toast ("you were already
  signed in elsewhere").
- Dismissing a toast keeps it dismissed until a *newer* sign-in occurs.
- Without JavaScript the toast renders as an in-flow GOV.UK notification banner
  whose "Hide" link dismisses it via a full-page POST.

## Approach in this WDIO suite

`wdio.conf.js` runs a single Chrome instance (`maxInstances: 1`); two cookie
jars in one run:

1. `browser.deleteCookies()`; stub-login as the regulator user
   (`LoginPage.openRegulatorLogin()` → `LoginPage.loginAsUser()`); wait for the
   redirect off `/stub/login`.
2. `const sessionA = await browser.getCookies(['session'])`.
3. `browser.reloadSession()` (fresh jar) → stub-login again as the **same**
   user. Session B.
4. **Assert (info):** session B's first authenticated page shows the info toast
   (`[data-testid="session-notice"][data-variant="info"]` — testid + variant
   attribute per repo convention).
5. `browser.deleteCookies(); browser.setCookies(sessionA)`; navigate to a
   protected page.
6. **Assert (alert):** session A shows the alert toast
   (`[data-testid="session-notice"][data-variant="alert"]`), it contains a
   sign-in time and a "sign out" link, **and** the page content itself rendered
   (status 200, heading visible) — i.e. A was *not* redirected to login.
7. **Assert (dismiss):** click the toast close control → toast gone; reload →
   still gone.
8. **Assert (re-raise):** `browser.reloadSession()` → third login as the same
   user; restore `sessionA`; navigate → alert toast is back.

No-JS variant: run one case with Chrome started with JavaScript disabled (or via
CDP `Emulation.setScriptExecutionDisabled`), assert the banner renders in-flow
and that submitting its "Hide" form removes it on the next page.

## New spec

`test/specs/ra-462-concurrent-logins.e2e.js`

```
describe('RA-462 concurrent logins — new-sign-in notification', () => {
  it('second login: both sessions stay usable', ...)
  it('older session shows the alert toast with the sign-in time', ...)
  it('newer session shows the info toast', ...)
  it('dismissing the toast keeps it dismissed until a newer sign-in', ...)
  it('a third login re-raises the alert', ...)
  it('no-JS: renders an in-flow banner whose Hide link dismisses it', ...)
  it('single-browser login is unaffected (no toast)', ...)   // regression
})
```

Page-object additions (`test/page-objects/login.page.js` or a new
`session-notice.page.js`): `sessionNotice(variant)`, `dismissSessionNotice()`,
`captureSession()` / `restoreSession(cookies)` wrappers.

## Environment assumptions

- Runs against the stub-auth deployment (as every existing spec does).
- The frontend under test must be built from `feature/RA-462-ConcurrentLogins`
  with the notification implemented. Until then the spec is committed **skipped**
  (`describe.skip`) with a comment pointing here, so CI stays green.
- `SESSION_CONCURRENT_LOGIN_NOTICE_ENABLED` must be `true` (its default) in the
  environment under test.

## Manual verification (EXT-TEST) — cross-reference

Frontend design doc §6: two real browsers, info toast on the newer, alert toast
on the older, both usable, dismissal sticks, third login re-raises, no-JS
fallback, screen-reader pass.
