import { browser, $, expect } from '@wdio/globals'

import LoginPage from 'page-objects/login.page'
import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_CONSENT_VERSION,
  decodeConsentRecord,
  setCookieConsentSeeding
} from '../helpers/cookie-consent.js'

// Every other spec has the banner answered up front; this one turns that off.
// It runs on the operator stub sign-in page, which is signed out and needs no
// backend.
const PAGE = '/auth/stub/login?type=operator'

const banner = () => $('[data-testid="cookie-banner"]')
const confirmation = () => $('[data-testid="cookie-banner-confirmation"]')

async function consentCookieValue() {
  const [cookie] = await browser.getCookies({ name: ANALYTICS_CONSENT_COOKIE })
  if (!cookie) {
    return undefined
  }
  const record = decodeConsentRecord(cookie.value)
  expect(record.version).toBe(ANALYTICS_CONSENT_VERSION)
  expect(Number.isNaN(Date.parse(record.decidedAt))).toBe(false)
  return record.analytics
}

async function startUnanswered(path = PAGE) {
  await browser.deleteCookies()
  await browser.url(path)
  await browser.deleteCookies({ name: ANALYTICS_CONSENT_COOKIE })
  await browser.url(path)
}

async function saveOnCookiesPage(choice, cookiesPath = '/cookies') {
  await $(`input[name="analytics"][value="${choice}"]`).click()
  await $('[data-testid="cookies-save"]').click()

  expect(new URL(await browser.getUrl()).pathname).toBe(cookiesPath)
  await expect($('[data-testid="cookies-saved"]')).toBeDisplayed()
  await expect($(`input[name="analytics"][value="${choice}"]`)).toBeSelected()
}

describe('analytics cookie consent', () => {
  before(async function () {
    setCookieConsentSeeding(false)

    // Analytics may not be switched on in the environment under test.
    await browser.url('/cookies')
    if (!(await $('[data-testid="analytics-cookies"]').isExisting())) {
      this.skip()
    }
  })

  after(() => {
    setCookieConsentSeeding(true)
  })

  it('asks a visitor who has not answered, before the skip link', async () => {
    await startUnanswered()

    await expect(banner()).toBeDisplayed()
    const bannerFirst = await browser.execute(() => {
      const cookieBanner = document.querySelector(
        '[data-testid="cookie-banner"]'
      )
      const skipLink = document.querySelector('.govuk-skip-link')
      return Boolean(
        cookieBanner.compareDocumentPosition(skipLink) &
          window.Node.DOCUMENT_POSITION_FOLLOWING
      )
    })
    expect(bannerFirst).toBe(true)
  })

  it('rejecting from the banner records the choice and confirms it once', async () => {
    await startUnanswered()

    await $('[data-testid="cookie-banner-reject"]').click()

    const { pathname, search } = new URL(await browser.getUrl())
    expect(`${pathname}${search}`).toBe(PAGE)
    await expect(confirmation()).toHaveText(
      expect.stringContaining("You've rejected analytics cookies.")
    )
    expect(await consentCookieValue()).toBe('rejected')

    await $('[data-testid="cookie-banner-hide"]').click()
    await expect(confirmation()).not.toBeExisting()
    await expect(banner()).not.toBeExisting()
  })

  it('accepting from the banner records the choice', async () => {
    await startUnanswered()

    await $('[data-testid="cookie-banner-accept"]').click()

    await expect(confirmation()).toHaveText(
      expect.stringContaining("You've accepted analytics cookies.")
    )
    expect(await consentCookieValue()).toBe('accepted')
  })

  for (const choice of ['accepted', 'rejected']) {
    it(`saving ${choice} on the cookies page, without using the banner, records the choice`, async () => {
      await startUnanswered()

      await $('[data-testid="footer-cookies"]').click()
      await expect($('input[name="analytics"]:checked')).not.toBeExisting()
      await saveOnCookiesPage(choice)

      expect(await consentCookieValue()).toBe(choice)
      await browser.url(PAGE)
      await expect(banner()).not.toBeExisting()
    })
  }

  for (const [first, second] of [
    ['accepted', 'rejected'],
    ['rejected', 'accepted']
  ]) {
    it(`${first} on the banner can be changed to ${second} on the cookies page`, async () => {
      await startUnanswered()
      await $(
        `[data-testid="cookie-banner-${first === 'accepted' ? 'accept' : 'reject'}"]`
      ).click()
      expect(await consentCookieValue()).toBe(first)

      await $('[data-testid="footer-cookies"]').click()
      await expect(banner()).not.toBeExisting()
      await expect(
        $(`input[name="analytics"][value="${first}"]`)
      ).toBeSelected()
      await saveOnCookiesPage(second)

      expect(await consentCookieValue()).toBe(second)
      await browser.url(PAGE)
      await expect(banner()).not.toBeExisting()
    })
  }

  it('saving on the Welsh cookies page records the choice and stays in Welsh', async () => {
    await startUnanswered('/cy/cookies')

    await saveOnCookiesPage('accepted', '/cy/cookies')

    expect(await consentCookieValue()).toBe('accepted')
  })

  it('the cookies page keeps a signed-in operator signed in', async () => {
    // Sign-in clicks the first button on the page, which the banner would
    // otherwise be.
    setCookieConsentSeeding(true)
    await browser.deleteCookies()
    await LoginPage.switchToOperator()
    await LoginPage.loginAsOperator()

    await browser.url('/cookies')
    await expect(LoginPage.signOutNavLink).toBeDisplayed()

    await LoginPage.signOut()
  })
})
