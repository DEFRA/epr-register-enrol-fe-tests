export const ANALYTICS_CONSENT_COOKIE = 'analyticsConsent'

// Must match ANALYTICS_CONSENT_VERSION in epr-register-enrol-frontend, or the banner comes back.
export const ANALYTICS_CONSENT_VERSION = 1

// Base64-encoded JSON (hapi's `base64json`), as epr-register-enrol-frontend writes it.
export function encodeConsentRecord(analytics) {
  const record = {
    analytics,
    version: ANALYTICS_CONSENT_VERSION,
    decidedAt: new Date().toISOString()
  }
  return Buffer.from(JSON.stringify(record)).toString('base64')
}

export function decodeConsentRecord(value) {
  return JSON.parse(Buffer.from(value, 'base64').toString('utf8'))
}

let isSeeding = true

export function setCookieConsentSeeding(enabled) {
  isSeeding = enabled
}

// getCookies only sees the current page's host, so a cookie on another host
// (regulator-query-banner drives a second frontend container) counts as absent.
async function hasConsentCookie(browser, origin) {
  try {
    if (new URL(await browser.getUrl()).origin !== origin) {
      return false
    }
    const cookies = await browser.getCookies({ name: ANALYTICS_CONSENT_COOKIE })
    return cookies.length > 0
  } catch {
    // A brand-new session has no page loaded to read cookies from.
    return false
  }
}

// Specs navigate via Page.open() and browser.url(), and some reset the session
// or cookies mid-way, so hooking `url` is the one place that covers them all.
// The cookie is seeded on whichever host the navigation targets, via its
// /health because that's open with or without a session and outside HTTP
// basic auth.
export function seedCookieConsentOnNavigation(browser) {
  browser.overwriteCommand('url', async (originalUrl, path, ...rest) => {
    const origin = new URL(path, browser.options.baseUrl).origin
    if (isSeeding && !(await hasConsentCookie(browser, origin))) {
      await originalUrl(`${origin}/health`)
      await browser.setCookies({
        name: ANALYTICS_CONSENT_COOKIE,
        value: encodeConsentRecord('rejected'),
        path: '/'
      })
    }
    return originalUrl(path, ...rest)
  })
}
