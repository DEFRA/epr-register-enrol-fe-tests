import { browser, expect } from '@wdio/globals'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import AddOrsSiteNamePage from 'page-objects/add-ors-site-name.page'
import AddOrsSiteLocationPage from 'page-objects/add-ors-site-location.page'
import AddOrsSiteContactPage from 'page-objects/add-ors-site-contact.page'
import AddOrsRecyclingOperationPage from 'page-objects/add-ors-recycling-operation.page'
import AddOrsBaselCodesPage from 'page-objects/add-ors-basel-codes.page'
import AddOrsRepatriatedLoadsPage from 'page-objects/add-ors-repatriated-loads.page'
import AddOrsCyaPage from 'page-objects/add-ors-cya.page'
import AddInterimSiteCountryPage from 'page-objects/add-interim-site-country.page'
import AddInterimSiteSiteNamePage from 'page-objects/add-interim-site-site-name.page'
import AddInterimSiteSiteLocationPage from 'page-objects/add-interim-site-site-location.page'
import AddInterimSiteSiteContactPage from 'page-objects/add-interim-site-site-contact.page'
import AddInterimSiteRecyclingOperationPage from 'page-objects/add-interim-site-recycling-operation.page'
import AddInterimSiteCyaPage from 'page-objects/add-interim-site-cya.page'
import { completePrnBusinessPlanSamplingPlan } from './accreditation-journey.js'

/**
 * Builds the state RA-603 starts from: an accreditation with one overseas
 * reprocessing site that already has one interim site.
 *
 * Lifted out of interim-site.e2e.js, which walks exactly this journey inline
 * before making its own assertions. RA-603's spec needs the same starting point
 * and nothing about how it got there, so it lives here rather than being typed
 * out twice. That spec could adopt this too; it has not been changed, to keep
 * this from touching six hundred lines of working assertions.
 *
 * Leaves the browser on the select-overseas-sites page.
 *
 * @returns {Promise<{organisationId: string, applicationId: string}>}
 */
export async function createOrsWithInterimSite({
  orsName,
  interimSiteName,
  interimOperationCodes = ['R12']
}) {
  await OperatorPage.navigateToInterimSiteTestOrg()
  const landingUrl = await browser.getUrl()
  const [, organisationId] = new URL(landingUrl).pathname
    .split('/')
    .filter(Boolean)

  await OperatorAccreditationPage.clickContinue()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/task-list/')
  )
  const applicationId = (await browser.getUrl())
    .split('/accreditation/task-list/')[1]
    .split('?')[0]

  await completePrnBusinessPlanSamplingPlan({ skipCompletedTasks: true })

  await TaskListPage.overseasSitesLink.click()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/select-overseas-sites')
  )
  await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
  await OverseasReprocessingSitesPage.addNewOrsButton.click()

  await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))
  await AddOrsSiteNamePage.enterSiteName(orsName)
  await AddOrsSiteNamePage.continue()

  await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
  await AddOrsSiteLocationPage.enterLocation({
    addressLine1: 'Entkopplungsweg 1',
    townOrCity: 'Munich',
    country: 'Germany',
    coordinates: '48.1351, 11.5820'
  })
  await AddOrsSiteLocationPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/site-contact-details')
  )
  await AddOrsSiteContactPage.enterContactDetails({
    name: 'Test Contact',
    email: 'test@ra603.example.com',
    phone: '+49 89 7654321'
  })
  await AddOrsSiteContactPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/recycling-operation-details')
  )
  await AddOrsRecyclingOperationPage.selectOperationCode('R3')
  await AddOrsRecyclingOperationPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/basel-convention-and-oecd-code')
  )
  await AddOrsBaselCodesPage.enterCodes(['A1181'])
  await AddOrsBaselCodesPage.continue()

  await expect(browser).toHaveUrl(expect.stringContaining('/repatriated-loads'))
  await AddOrsRepatriatedLoadsPage.enterDescription(
    'Rejected loads are returned within 30 days at our expense via licensed courier.'
  )
  await AddOrsRepatriatedLoadsPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/check-your-answers')
  )
  await AddOrsCyaPage.saveAndAddInterimSite()

  await addInterimSite({
    siteName: interimSiteName,
    operationCodes: interimOperationCodes
  })

  return { organisationId, applicationId }
}

/**
 * Walks the add-interim-site wizard from its first step to its CYA submit.
 *
 * Assumes the browser is already on /country — i.e. something has just entered
 * the wizard, either "Save and add interim site" on the ORS CYA page or
 * RA-603's "Add another interim site" link.
 *
 * Leaves the browser on the select-overseas-sites page.
 */
export async function addInterimSite({
  siteName,
  country = 'Germany',
  operationCodes = ['R12']
}) {
  await expect(browser).toHaveUrl(expect.stringContaining('/country'))
  await AddInterimSiteCountryPage.enterCountry(country)
  await AddInterimSiteCountryPage.continue()

  await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))
  await AddInterimSiteSiteNamePage.enterSiteName(siteName)
  await AddInterimSiteSiteNamePage.continue()

  await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
  await AddInterimSiteSiteLocationPage.enterLocation({
    addressLine1: 'Entkopplungsweg 2',
    townOrCity: 'Munich',
    stateOrRegion: 'Bavaria',
    postcode: '80331'
  })
  await AddInterimSiteSiteLocationPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/site-contact-details')
  )
  await AddInterimSiteSiteContactPage.enterContactDetails({
    name: 'Interim Contact',
    email: 'interim@ra603.example.com',
    phone: '+49 89 7654322'
  })
  await AddInterimSiteSiteContactPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/recycling-operation-details')
  )
  for (const code of operationCodes) {
    await AddInterimSiteRecyclingOperationPage.selectOperationCode(code)
  }
  await AddInterimSiteRecyclingOperationPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/check-your-answers')
  )
  await AddInterimSiteCyaPage.submit()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/select-overseas-sites')
  )
}
