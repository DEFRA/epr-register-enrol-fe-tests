import { browser, $ } from '@wdio/globals'

/**
 * Specs that sign in through the operator stub (/auth/stub/login), or use
 * that page as a signed-out page to test on. The compose stack and test run
 * the stub; dev signs in through the real Defra ID instead, where the stub
 * route is not found, so these skip there rather than fail. Checked on the
 * environment itself rather than listed by name, so a stub that comes or
 * goes needs no change here.
 *
 * In the compose stack the stub is always there, so no stub there means it is
 * broken - fail, or the suite passes having tested nothing.
 */

let stubSignIn

/** Whether the environment under test signs in through the operator stub. */
export async function hasStubSignIn() {
  if (stubSignIn === undefined) {
    await browser.url('/auth/stub/login')
    stubSignIn = await $('input[type="radio"]').isExisting()
  }
  return stubSignIn
}

/**
 * @param {Mocha.Context} context the `this` of a `before`, `beforeEach` or
 *   `it`
 */
export async function skipUnlessStubSignIn(context) {
  if (await hasStubSignIn()) {
    return
  }

  if (!process.env.ENVIRONMENT) {
    throw new Error(
      'The operator stub sign-in (/auth/stub/login) is missing from the stack under test'
    )
  }

  context.skip()
}
