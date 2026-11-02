import { browser } from '@wdio/globals'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import ReexRegistrationPage from 'page-objects/reex-registration.page'

import { seededOrganisation } from './seeded-organisation.js'

// The hand-off from the Re-Ex frontend into epr-register-enrol-frontend, as
// the seeded operator.
//
// A Re-Ex session does not carry over: the register-enrol frontend has its
// own, and on test its login is a stub chooser whose "Sign in with Defra ID"
// goes through a Defra ID stub of its own (epr-register-enrol-defra-id-stub),
// where hooks.js registered the seeded operator. Once signed in there the
// frontend returns to the page the hand-off asked for; a browser that already
// has a register-enrol session goes straight to it.

const isStubChooser = (url) =>
  url.includes('epr-register-enrol-frontend') &&
  url.includes('/auth/stub/login')
const isDefraIdStub = (url) => url.includes('epr-register-enrol-defra-id-stub')
const isAccreditationLanding = (url) =>
  url.includes('epr-register-enrol-frontend') &&
  url.includes('/operator-accreditation/')

async function waitForUrl(predicate, timeoutMsg) {
  let url
  await browser.waitUntil(
    async () => {
      url = await browser.getUrl()
      return predicate(url)
    },
    { timeout: 60000, timeoutMsg }
  )
  return url
}

async function signInThroughStub(email, target) {
  let url = await waitForUrl(
    (current) =>
      isStubChooser(current) ||
      isDefraIdStub(current) ||
      isAccreditationLanding(current),
    'The accreditation hand-off reached neither the register-enrol sign-in nor its landing page'
  )

  if (isStubChooser(url)) {
    const defraIdLink = $('[data-testid="defra-id-login"]')
    await defraIdLink.waitForDisplayed()
    await defraIdLink.click()
    url = await waitForUrl(
      isDefraIdStub,
      'Sign in with Defra ID did not reach the register-enrol Defra ID stub'
    )
  }

  if (isDefraIdStub(url)) {
    const emailInput = $('#email')
    await emailInput.waitForDisplayed()
    await emailInput.setValue(email)
    await $('button[type="submit"]').click()
    url = await waitForUrl(
      (current) =>
        current.includes('epr-register-enrol-frontend') &&
        !current.includes('/auth/'),
      `Signing in to the register-enrol Defra ID stub as ${email} did not return to the frontend`
    )
  }

  // The frontend returns to the page asked for, but not every version did; go
  // there if it landed somewhere else.
  if (!isAccreditationLanding(url)) {
    await browser.url(target)
  }
}

/**
 * From a Re-Ex registration page, follows its "apply for <year>
 * accreditation" link and signs in to epr-register-enrol-frontend as the
 * seeded operator if it asks. Leaves the browser on the accreditation landing
 * page.
 *
 * @param {string} year
 * @param {string} [email] the operator to sign in as, when not the seeded one
 */
export async function handOffToRegisterEnrol(
  year,
  email = seededOrganisation().email
) {
  const link = ReexRegistrationPage.applyForAccreditationLink(year)
  await link.waitForDisplayed({ timeout: 30000 })
  const target = await link.getAttribute('href')

  await ReexRegistrationPage.applyForAccreditation(year)
  await signInThroughStub(email, target)

  await OperatorAccreditationPage.pageHeading.waitForDisplayed({
    timeout: 30000
  })
}
