import { browser, expect, $ } from '@wdio/globals'

import LoginPage from 'page-objects/login.page'

/**
 * RA-462 — Concurrent logins are allowed; a second sign-in for the same
 * identity does NOT end the first session, it notifies both sessions.
 *
 * What this journey spec verifies:
 *  - the session that just signed in sees a "you are signed in elsewhere"
 *    notice
 *  - the session that was already active is NOT signed out — it stays
 *    authenticated and its content still renders
 *  - the notice can be dismissed
 *
 * The exact alert-vs-info variant, the "a newer sign-in was detected" wording
 * and dismissal persistence are covered by concurrent-login.test.js in
 * epr-register-enrol-frontend. They are not re-asserted here: the journey
 * grid runs many parallel browsers as the SAME stub user, so the per-identity
 * registry that drives the alert variant is churned continuously by other
 * specs and cannot be pinned from a single spec.
 *
 * Single Chrome instance, so "two browsers" is two cookie jars in one run:
 * capture jar A, reloadSession() for a clean jar B, then restore A.
 */

const NOTICE = '[data-testid="session-notice"]'
const HOME = '/'

async function stubLoginAsRegulator() {
  await browser.deleteCookies()
  await LoginPage.openRegulatorLogin()
  await LoginPage.loginAsUser()
  await browser.waitUntil(
    async () => !(await browser.getUrl()).includes('/stub/login'),
    { timeout: 15000, timeoutMsg: 'Stub login did not redirect' }
  )
}

describe('RA-462 concurrent-login notification', () => {
  let jarA

  beforeEach(async () => {
    await stubLoginAsRegulator()
    jarA = await browser.getCookies()

    await browser.reloadSession()
    await stubLoginAsRegulator()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('shows a session-notice on the session that just signed in', async () => {
    await expect($(NOTICE)).toBeDisplayed()
  })

  it('does not sign out the session that was already active', async () => {
    await browser.deleteCookies()
    await browser.setCookies(jarA)
    await browser.url(HOME)

    // The first session is still valid — not bounced to the login page, and
    // its authenticated chrome (the sign-out link) still renders.
    await expect(browser).not.toHaveUrl(expect.stringContaining('/auth/'))
    await expect(LoginPage.signOutLink).toBeDisplayed()
  })

  it('dismissing the notice removes it', async () => {
    // Runs on the just-signed-in session, whose notice is a stable
    // session-flag render (not the churn-prone registry read).
    await expect($(NOTICE)).toBeDisplayed()
    await $('[data-testid="session-notice-dismiss"]').click()
    await expect($(NOTICE)).not.toBeDisplayed()
  })
})
