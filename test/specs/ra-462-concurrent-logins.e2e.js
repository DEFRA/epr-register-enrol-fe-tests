import { browser, expect, $ } from '@wdio/globals'

import LoginPage from 'page-objects/login.page'

/**
 * RA-462 — Concurrent logins are allowed; a second sign-in for the same
 * identity does NOT end the first session, it notifies both sessions.
 *
 *  - the session that was already active gets an "alert" toast
 *  - the session that just signed in gets an "info" toast
 *  - dismissing the toast keeps it dismissed until a newer sign-in
 *  - both sessions stay usable throughout (no redirect to login)
 *
 * Single Chrome instance, so "two browsers" is two cookie jars in one run:
 * capture jar A, reloadSession() for a clean jar B, then restore A.
 */

const NOTICE = '[data-testid="session-notice"]'

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

  it('shows the info toast on the session that just signed in', async () => {
    await expect($(`${NOTICE}[data-variant="info"]`)).toBeDisplayed()
  })

  it('shows the alert toast on the session that was already active, without signing it out', async () => {
    await browser.deleteCookies()
    await browser.setCookies(jarA)
    await browser.url('/')

    // Not redirected to login — the first session is still valid.
    await expect(browser).not.toHaveUrl(expect.stringContaining('/auth/'))
    await expect($(`${NOTICE}[data-variant="alert"]`)).toBeDisplayed()
    await expect($('[data-testid="session-notice-signout"]')).toBeDisplayed()
  })

  it('keeps the alert dismissed until a still-newer sign-in', async () => {
    await browser.deleteCookies()
    await browser.setCookies(jarA)
    await browser.url('/')
    await $('[data-testid="session-notice-dismiss"]').click()
    await expect($(NOTICE)).not.toBeExisting()

    await browser.url('/')
    await expect($(NOTICE)).not.toBeExisting()

    // A third sign-in re-raises it.
    await browser.reloadSession()
    await stubLoginAsRegulator()
    await browser.deleteCookies()
    await browser.setCookies(jarA)
    await browser.url('/')
    await expect($(`${NOTICE}[data-variant="alert"]`)).toBeDisplayed()
  })
})
