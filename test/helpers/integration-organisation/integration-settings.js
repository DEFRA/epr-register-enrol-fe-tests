import { browser } from '@wdio/globals'

import { setCookieConsentSeeding } from '../cookie-consent.js'

// What an integration spec's journeys need, whichever config runs it: on test
// wdio.conf.js runs them beside the standard specs, whose settings suit the
// one frontend they test. Each spec file runs in a worker of its own, so
// changing these changes nothing for the standard specs.

const oneMinute = 60 * 1000

/**
 * The mocha timeout for an integration suite (this.timeout in its describe):
 * a full journey is a sign-in, a crawl over the materials and file uploads
 * through the CDP uploader, so it is minutes, not the standard suite's one.
 */
export const integrationTimeout = () =>
  process.env.DEBUG === 'true' ? 60 * oneMinute : 30 * oneMinute

/**
 * For an integration spec's `before`.
 *
 * - Deployed environments, a third-party identity provider and a real
 *   virus-scanning upload pipeline are slower than the local stack, so waits
 *   are longer.
 * - wdio.conf.js seeds register-enrol's cookie consent on every navigation,
 *   by way of its /health first when the page has no consent cookie; on the
 *   Re-Ex and case management frontends that would be every navigation.
 */
export function useIntegrationSettings() {
  browser.options.waitforTimeout = 30000
  browser.options.waitforInterval = 500
  setCookieConsentSeeding(false)
}
