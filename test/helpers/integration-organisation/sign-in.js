import ReexStartPage from 'page-objects/reex-start.page'
import ReexHomePage from 'page-objects/reex-home.page'

import DefraIdStubPage from './defra-id-stub.page.js'
import { seededMaterial, seededOrganisation } from './seeded-organisation.js'

/**
 * Signs in to the Re-Ex frontend through the Defra ID stub as the seeded
 * organisation's operator, and lands on its home page.
 *
 * @returns {Promise<import('./seeded-organisation.js').SeededOrganisation>}
 */
export async function signInAsSeededOperator() {
  const organisation = seededOrganisation()

  await ReexStartPage.open()
  await ReexStartPage.clickStart()
  await DefraIdStubPage.signIn(organisation.email)
  await ReexHomePage.waitUntilLoaded()

  return organisation
}

/**
 * For a test's beforeEach: looks up one of the seeded organisation's
 * materials and signs in as its operator.
 *
 * @param {Parameters<typeof seededMaterial>[0]} spec
 * @returns {Promise<import('./seeded-organisation.js').SeededMaterial>}
 */
export async function signInForMaterial(spec) {
  const material = seededMaterial(spec)
  await signInAsSeededOperator()
  return material
}
