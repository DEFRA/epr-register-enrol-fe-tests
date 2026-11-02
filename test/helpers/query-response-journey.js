import { browser, expect } from '@wdio/globals'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import QueryTaskListPage from 'page-objects/query-task-list.page'
import QueryDeclarationPage from 'page-objects/query-declaration.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import ConfirmOverseasSitesPage from 'page-objects/confirm-overseas-sites.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import AddOrsSiteNamePage from 'page-objects/add-ors-site-name.page'
import AddOrsSiteLocationPage from 'page-objects/add-ors-site-location.page'
import AddOrsSiteContactPage from 'page-objects/add-ors-site-contact.page'
import AddOrsRecyclingOperationPage from 'page-objects/add-ors-recycling-operation.page'
import AddOrsBaselCodesPage from 'page-objects/add-ors-basel-codes.page'
import AddOrsRepatriatedLoadsPage from 'page-objects/add-ors-repatriated-loads.page'
import AddOrsConditionsOfExportPage from 'page-objects/add-ors-conditions-of-export.page'
import AddOrsCyaPage from 'page-objects/add-ors-cya.page'
import AddInterimSiteCountryPage from 'page-objects/add-interim-site-country.page'
import AddInterimSiteSiteNamePage from 'page-objects/add-interim-site-site-name.page'
import AddInterimSiteSiteLocationPage from 'page-objects/add-interim-site-site-location.page'
import AddInterimSiteSiteContactPage from 'page-objects/add-interim-site-site-contact.page'
import AddInterimSiteRecyclingOperationPage from 'page-objects/add-interim-site-recycling-operation.page'
import AddInterimSiteCyaPage from 'page-objects/add-interim-site-cya.page'
import BusinessPlanPage from 'page-objects/business-plan.page'
import BusinessPlanDetailPage from 'page-objects/business-plan-detail.page'
import BusinessPlanCheckAnswersPage from 'page-objects/business-plan-check-answers.page'
import SamplingPlanPage from 'page-objects/sampling-plan.page'

const EVIDENCE_FIXTURE = 'business-plan.pdf'

/**
 * Adds a new overseas reprocessing site, and an interim site linked to it, from
 * the select-overseas-sites page.
 *
 * The interim site is reached through "Save and add interim site" on the new
 * site's check-your-answers page — the only route into that wizard — so the two
 * are added in one walk rather than as separate steps.
 *
 * `additionalCodes` are the codes to add on top of the site's primary
 * recycling code: R12 and R13 on their own are rejected with "Select R3, R4 or
 * R5", and which primary code is offered depends on the material, so it is
 * taken from the page rather than passed in.
 */
export async function addOverseasSiteWithInterimSite({
  site,
  interimSite,
  additionalCodes = ['R12', 'R13'],
  interimRecyclingOperationCodes = ['R12'],
  baselCodes = ['B1010'],
  repatriatedLoads = 'No repatriated loads are expected for this site.'
}) {
  await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
  await OverseasReprocessingSitesPage.addNewOrsButton.click()

  await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))
  await AddOrsSiteNamePage.enterSiteName(site.name)
  await AddOrsSiteNamePage.continue()

  await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
  await AddOrsSiteLocationPage.enterLocation(site.location)
  await AddOrsSiteLocationPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/site-contact-details')
  )
  await AddOrsSiteContactPage.enterContactDetails(site.contact)
  await AddOrsSiteContactPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/recycling-operation-details')
  )
  const primaryCode =
    await AddOrsRecyclingOperationPage.selectPrimaryOperationCode()
  await AddOrsRecyclingOperationPage.selectOperationCodes(additionalCodes)
  await AddOrsRecyclingOperationPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/basel-convention-and-oecd-code')
  )
  await AddOrsBaselCodesPage.enterCodes(baselCodes)
  await AddOrsBaselCodesPage.continue()

  await expect(browser).toHaveUrl(expect.stringContaining('/repatriated-loads'))
  await AddOrsRepatriatedLoadsPage.enterDescription(repatriatedLoads)
  await AddOrsRepatriatedLoadsPage.continue()

  // Only asked for materials that can meet them (aluminium and steel), so this
  // page is stepped over when it isn't part of the wizard.
  if (await AddOrsConditionsOfExportPage.radio('yes').isExisting()) {
    await AddOrsConditionsOfExportPage.selectYes()
    await AddOrsConditionsOfExportPage.continue()
  }

  await expect(browser).toHaveUrl(
    expect.stringContaining('/check-your-answers')
  )
  await expect(AddOrsCyaPage.recyclingOperationRow).toHaveText(
    expect.stringContaining([primaryCode, ...additionalCodes].join(', '))
  )
  await AddOrsCyaPage.saveAndAddInterimSite()

  await addInterimSite({
    interimSite,
    recyclingOperationCodes: interimRecyclingOperationCodes
  })
}

async function addInterimSite({ interimSite, recyclingOperationCodes }) {
  await expect(browser).toHaveUrl(expect.stringContaining('/country'))
  await AddInterimSiteCountryPage.enterCountry(interimSite.country)
  await AddInterimSiteCountryPage.continue()

  await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))
  await AddInterimSiteSiteNamePage.enterSiteName(interimSite.name)
  await AddInterimSiteSiteNamePage.continue()

  await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
  await AddInterimSiteSiteLocationPage.enterLocation(interimSite.location)
  await AddInterimSiteSiteLocationPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/site-contact-details')
  )
  await AddInterimSiteSiteContactPage.enterContactDetails(interimSite.contact)
  await AddInterimSiteSiteContactPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/recycling-operation-details')
  )
  await AddInterimSiteRecyclingOperationPage.selectOperationCodes(
    recyclingOperationCodes
  )
  await AddInterimSiteRecyclingOperationPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/check-your-answers')
  )
  // The row, not value-recycling-operation: the deployed interim
  // check-your-answers page renders only row-recycling-operation, and the row
  // text carries the codes.
  await expect(AddInterimSiteCyaPage.recyclingOperationRow).toHaveText(
    expect.stringContaining(recyclingOperationCodes.join(', '))
  )
  await AddInterimSiteCyaPage.submit()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/select-overseas-sites')
  )
  await expect(
    OverseasReprocessingSitesPage.interimSiteSuccessBanner
  ).toBeDisplayed()
}

/** Confirms the overseas sites, completing the queried ORS section. */
export async function confirmOverseasSites() {
  await OverseasReprocessingSitesPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/confirm-overseas-sites')
  )
  await ConfirmOverseasSitesPage.confirmAndContinue()
}

const waitForQueryTaskList = () =>
  browser.waitUntil(
    async () =>
      (await browser.getUrl()).includes('/accreditation/query-task-list/'),
    { timeout: 30000, timeoutMsg: 'Did not return to the query task list' }
  )

/**
 * From the query task list, answers a queried business plan again with the
 * given percentages (one per spending category, adding up to 100). Saving it
 * goes back through the classic task list, which redirects to the query task
 * list while the application is Queried; leaves the browser there.
 *
 * @param {number[]} percentages
 */
export async function updateQueriedBusinessPlan(percentages) {
  await QueryTaskListPage.taskLink('task-business-plan').click()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/business-plan/')
  )
  await BusinessPlanPage.fillPercentages(percentages)
  await BusinessPlanPage.saveAndContinue()

  // The details and check-your-answers pages follow only when the section
  // asks for them again.
  let heading = await $('h1').getText()
  if (heading === "Add more details about how you'll spend the PRN income") {
    await BusinessPlanDetailPage.fillDescriptions()
    await BusinessPlanDetailPage.saveAndContinue()
    heading = await $('h1').getText()
  }
  if (heading === 'Check your answers before continuing') {
    await BusinessPlanCheckAnswersPage.confirmAndContinue()
  }
  await waitForQueryTaskList()
}

/**
 * From the query task list, uploads a further sampling and inspection plan
 * under `baseName` (made unique by a suffix), so the regulator can tell it
 * from the one first submitted. Leaves the browser on the query task list.
 *
 * @param {string} baseName
 */
export async function updateQueriedSamplingPlan(baseName) {
  await QueryTaskListPage.taskLink('task-sampling-plan').click()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/sampling-plan/')
  )
  await SamplingPlanPage.uploadFile(EVIDENCE_FIXTURE, 'SamplingPlan', {
    baseName
  })
  await SamplingPlanPage.saveAndContinue()
  await waitForQueryTaskList()
}

/** Uploads BES evidence for every site still showing "Not uploaded". */
export async function uploadOutstandingBesEvidence() {
  await QueryTaskListPage.taskLink('task-bes-evidence').click()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/upload-evidence-for-overseas-site/')
  )
  await BesEvidencePage.uploadAllEvidence(EVIDENCE_FIXTURE)
}

/**
 * Signs the resubmission declaration, sending the updated application back to
 * the regulator. Leaves the browser on the accreditation landing page.
 */
export async function resubmitApplication() {
  await QueryTaskListPage.continueButton.waitForDisplayed({ timeout: 30000 })
  await QueryTaskListPage.continueToDeclaration()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/query-declaration/')
  )
  await expect(QueryDeclarationPage.pageHeading).toHaveText(
    'Resubmit accreditation application'
  )
  await QueryDeclarationPage.submitResubmission({
    fullName: 'Alice Johnson',
    email: 'alice.johnson@example.com',
    role: 'Compliance Officer'
  })

  await OperatorAccreditationPage.pageHeading.waitForDisplayed({
    timeout: 60000
  })
}
