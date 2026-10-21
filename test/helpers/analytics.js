import { browser, $ } from '@wdio/globals'

/**
 * Deployed environments may run with analytics off (perf-test, prod), so the
 * analytics specs skip there. The compose stack always switches it on, so off
 * there means docker/config/operator-fe.env has drifted from what
 * epr-register-enrol-frontend reads - fail, or the suite passes having tested
 * nothing.
 * @param {Mocha.Context} context the `this` of a `before` hook
 */
export async function skipUnlessAnalyticsIsOn(context) {
  await browser.url('/cookies')
  if (await $('[data-testid="analytics-cookies"]').isExisting()) {
    return
  }

  if (!process.env.ENVIRONMENT) {
    throw new Error(
      'Analytics is off in the stack under test: epr-register-enrol-frontend needs ANALYTICS_ENABLED=true and ANALYTICS_GTM_CONTAINER_ID set to a GTM- id (docker/config/operator-fe.env)'
    )
  }

  context.skip()
}

/**
 * Returns the CSP violations Chrome has logged since the last call, and clears
 * them. Chrome logs each one as it happens, including while the page loads, so
 * this sees what a listener attached afterwards would miss. Read from the
 * browser log rather than via BiDi, which the Selenium image in the compose
 * stack doesn't support.
 *
 * Chrome also logs other refusals under the `security` source, such as its
 * MIME-type check on a script. The compose stack's placeholder container
 * (GTM-LOCAL0000) hits that one: googletagmanager.com answers an unknown id
 * with a GIF. That is not a CSP violation, so only CSP messages are kept.
 */
export async function takeCspViolations() {
  const entries = await browser.getLogs('browser')
  return entries
    .filter(
      (entry) =>
        entry.source === 'security' &&
        entry.message.includes('Content Security Policy')
    )
    .map((entry) => entry.message)
}
