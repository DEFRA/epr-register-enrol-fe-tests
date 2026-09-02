# RA-462 — Concurrent logins: E2E test plan (frontend journey tests)

**Status:** Plan only — the spec is not written yet. Enforcement is pending
product/security sign-off on the single-active-session policy
(`epr-register-enrol-frontend/docs/adr/0001-single-active-session-per-user.md`).
**Branch:** `feature/RA-462-ConcurrentLogins`

## What is being verified

Acceptance criterion from RA-462:

> Given a user is already logged in and completes a fresh login (same identity,
> different browser/device), when the new session is established, then the prior
> session for that identity is invalidated. The invalidated session's next
> request is redirected to login.

## Approach in this WDIO suite

`wdio.conf.js` runs a single Chrome instance (`maxInstances: 1`), so "two
browsers" is simulated by two independent cookie jars in one run:

1. `browser.deleteCookies()`; stub-login as the regulator user
   (`LoginPage.openRegulatorLogin()` → `LoginPage.loginAsUser()`), wait for the
   redirect off `/stub/login`.
2. `const sessionA = await browser.getCookies(['session'])` — capture session
   A's cookie(s).
3. `await browser.reloadSession()` (fresh browser session, empty cookie jar) —
   or `browser.deleteCookies()` — then stub-login again as the **same** user.
   This is session B.
4. Sanity: session B can load a protected page (e.g. `/regulator`) → 200 / heading
   visible.
5. `await browser.deleteCookies(); await browser.setCookies(sessionA)`.
6. Navigate to a protected page (`/` or `/regulator`).
7. **Assert**: URL ends up on the login page
   (`/auth/regulator/login` → `/auth/stub/login?type=regulator`), not the
   protected page — session A is dead.

Repeat for the operator identity (`type=operator`).

## New spec

`test/specs/ra-462-concurrent-logins.e2e.js`

```
describe('RA-462 concurrent logins — single active session', () => {
  it('regulator: second login invalidates the first session', ...)
  it('operator: second login invalidates the first session', ...)
  it('the surviving (second) session keeps working', ...)   // guard against over-invalidation
  it('a single browser logging in once is unaffected', ...)  // regression
})
```

Page-object additions (`test/page-objects/login.page.js`):

- `get regulatorLoginHeading()` / a helper `isOnLoginPage()` that checks the URL
  contains `/auth/` and the stub chooser fieldset is present.
- Optionally `captureSessionCookies()` / `restoreSessionCookies(cookies)`
  wrappers so the spec reads cleanly.

## Environment assumptions

- Runs against the stub-auth deployment (as every existing spec does); no real
  Entra ID / Defra ID needed for the automated check.
- The frontend under test must be built from the `feature/RA-462-ConcurrentLogins`
  branch (enforcement present). Until then the spec is committed **skipped**
  (`describe.skip`) with a comment pointing at this file, so CI stays green.

## Manual verification (EXT-TEST) — cross-reference

Tracked in the frontend design doc §6; not automated here:

1. Same operator in two real browsers → first is signed out after the second
   login completes.
2. Same for a regulator via Entra ID.
3. Normal single-browser login/logout unchanged; 20-minute idle timeout still
   fires.
