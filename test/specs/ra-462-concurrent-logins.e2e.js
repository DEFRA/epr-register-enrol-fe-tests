import { browser, expect, $ } from '@wdio/globals'

import LoginPage from 'page-objects/login.page'

/**
 * RA-462 — Concurrent logins are allowed; a second sign-in for the same
 * identity does NOT end the first session, it notifies both sessions.
 *
 *  - the session that just signed in gets an "info" toast
 *  - the session that was already active gets an "alert" toast, and is not
 *    signed out
 *  - dismissing the toast removes it
 *
 * Single Chrome instance, so "two browsers" is two cookie jars in one run:
 * capture jar A, reloadSession() for a clean jar B, then restore A.
 *
 * The journey grid runs many parallel browsers as the SAME stub user, so the
 * per-identity registry that drives the "alert" is constantly churned by other
 * specs. The alert for jar A is therefore re-checked with a re-navigating
 * wait, and the spec deliberately does NOT assert dismissal persistence across
 * navigations (a genuinely newer parallel sign-in re-raises it, correctly) —
 * that is covered by concurrent-login.test.js in epr-register-enrol-frontend.
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

async function restoreJar(jar) {
  await browser.deleteCookies()
  await browser.setCookies(jar)
}

async function loadUntilAlertShown(url) {
  await browser.waitUntil(
    async () => {
      await browser.url(url)
      return $(`${NOTICE}[data-variant="alert"]`).isDisplayed()
    },
    {
      timeout: 20000,
      interval: 1000,
      timeoutMsg: 'alert toast did not appear for the older (jar A) session'
    }
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

  it('shows the info toast on the session that just signed in', async () => {
    await expect($(`${NOTICE}[data-variant="info"]`)).toBeDisplayed()
  })

  it('shows the alert toast on the session that was already active, without signing it out', async () => {
    await restoreJar(jarA)
    await loadUntilAlertShown(HOME)

    // Not redirected to login — the first session is still valid.
    await expect(browser).not.toHaveUrl(expect.stringContaining('/auth/'))
    await expect($('[data-testid="session-notice-signout"]')).toBeDisplayed()
  })

  it('dismissing the alert removes it', async () => {
    await restoreJar(jarA)
    await loadUntilAlertShown(HOME)

    await $('[data-testid="session-notice-dismiss"]').click()
    await expect($(`${NOTICE}[data-variant="alert"]`)).not.toBeDisplayed()
  })
})
