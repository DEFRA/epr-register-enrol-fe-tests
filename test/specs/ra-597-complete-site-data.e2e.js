import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import ConfirmOverseasSitesPage from 'page-objects/confirm-overseas-sites.page'
import AddOrsCyaPage from 'page-objects/add-ors-cya.page'
import AddOrsSiteLocationPage from 'page-objects/add-ors-site-location.page'
import AddOrsSiteContactPage from 'page-objects/add-ors-site-contact.page'
import AddOrsRecyclingOperationPage from 'page-objects/add-ors-recycling-operation.page'
import AddOrsBaselCodesPage from 'page-objects/add-ors-basel-codes.page'
import AddOrsRepatriatedLoadsPage from 'page-objects/add-ors-repatriated-loads.page'
import {
  completeOverseasSites,
  getOverseasSites
} from '../helpers/case-management.js'
import { completePrnBusinessPlanSamplingPlan } from '../helpers/accreditation-journey.js'

// RA-597: every overseas site in the application must have everything a fresh
// add asks for - wherever its data came from. ReEx supplies a name, address and
// coordinates but never contact details, recycling operations, Basel/OECD codes
// or repatriated loads, so the sites an application opens with, and any
// registered site the operator includes, have gaps the operator has to fill.
//
// Glass exporter org 50006 on a run-unique year (the ra-570 / ra-583 pattern):
// a fresh application seeded with four bare ReEx sites, isolated from every
// other spec's use of the org. The three tests are one story told in order, so
// they share the application captured in the first.
describe('RA-597: every overseas site in the application must be complete', () => {
  let organisationId
  let registrationId
  let materialType
  let year
  let applicationId
  let siteIds

  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.switchToOperator()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  const listUrl = () => `/accreditation/select-overseas-sites/${applicationId}`
  const ctaUrl = () =>
    `/accreditation/add-overseas-site/${applicationId}/check-your-answers`

  function landingUrl() {
    return `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
  }

  // Every test logs in afresh, and the organisation and material the pages
  // need live in the session that visiting the landing page creates - so each
  // test starts by returning to its application, which is the same one every
  // time because the year is fixed on the first call.
  async function startApplication() {
    await OperatorPage.navigateToExporterAccreditationGlass()
    const landing = await browser.getUrl()
    ;[, organisationId, registrationId, materialType] = new URL(
      landing
    ).pathname
      .split('/')
      .filter(Boolean)
    if (!year) {
      year = String(3000 + (Date.now() % 1000))
    }
    await browser.url(landingUrl())
    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )
    applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]
    const sites = await getOverseasSites(organisationId, applicationId)
    siteIds = sites.map((site) => site.siteId)
  }

  it('tags every site brought in from ReEx that is missing details, and will not continue while any is', async () => {
    await startApplication()
    expect(siteIds.length).toBeGreaterThan(1)

    // The declaration is only reachable once the application has been started,
    // which saving any section does.
    await completePrnBusinessPlanSamplingPlan({ material: 'Glass' })

    await browser.url(listUrl())
    for (const siteId of siteIds) {
      await expect(
        OverseasReprocessingSitesPage.incompleteTag(siteId)
      ).toBeDisplayed()
    }

    await OverseasReprocessingSitesPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites/')
    )
    await expect(OverseasReprocessingSitesPage.errorSummary).toBeDisplayed()
    const errors = await OverseasReprocessingSitesPage.incompleteSiteErrors
    expect(errors).toHaveLength(siteIds.length)
    await expect(errors[0]).toHaveText(
      expect.stringContaining('Complete the missing details for')
    )

    // The declaration is the gate that holds even when the operator never
    // visits the list: the backend marks the section complete on its own as
    // soon as a site is selected.
    await browser.url(`/accreditation/submit-declaration/${applicationId}`)
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites/')
    )
    await expect(OverseasReprocessingSitesPage.errorSummary).toBeDisplayed()
  })

  it('opens a registered site on check-your-answers, refuses to include it until its gaps are filled, then offers the next one', async () => {
    await startApplication()
    const [first, second] = siteIds
    await browser.url(listUrl())
    await OverseasReprocessingSitesPage.removeFromAccreditation(first)
    await OverseasReprocessingSitesPage.removeFromAccreditation(second)

    await OverseasReprocessingSitesPage.addToAccreditation(first)

    // AC01: straight to check-your-answers, showing what is already known
    await expect(browser).toHaveUrl(expect.stringContaining(ctaUrl()))
    await expect(AddOrsCyaPage.siteNameRow).toHaveText(
      expect.stringContaining('Overseas Site 1')
    )
    await expect(AddOrsCyaPage.contactNameRow).toHaveText(
      expect.stringContaining('Not provided')
    )

    // AC02: the operator cannot proceed with gaps, and is told what is missing
    await AddOrsCyaPage.submit()
    await expect(browser).toHaveUrl(expect.stringContaining(ctaUrl()))
    await expect(AddOrsCyaPage.errorSummary).toBeDisplayed()
    await expect(AddOrsCyaPage.errorSummary).toHaveText(
      expect.stringContaining('Enter the contact name')
    )
    await expect(AddOrsCyaPage.rowError('contact-name')).toBeDisplayed()

    // ...and fixes it through the Change links, which walk on to the end
    await AddOrsCyaPage.changeLink('location').click()
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: '1 Hafenstrasse',
      townOrCity: 'Hamburg',
      country: 'Germany',
      coordinates: '53.5511, 9.9937'
    })
    await AddOrsSiteLocationPage.continue()
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Greta Schmidt',
      email: 'greta.schmidt@example.com'
    })
    await AddOrsSiteContactPage.continue()
    await AddOrsRecyclingOperationPage.selectOperationCodes(['R5'])
    await AddOrsRecyclingOperationPage.continue()
    await AddOrsBaselCodesPage.enterCodes(['A1181'])
    await AddOrsBaselCodesPage.continue()
    await AddOrsRepatriatedLoadsPage.enterDescription(
      'Rejected loads are returned within 30 days.'
    )
    await AddOrsRepatriatedLoadsPage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining(ctaUrl()))
    await expect(AddOrsCyaPage.contactNameRow).toHaveText(
      expect.stringContaining('Greta Schmidt')
    )
    await AddOrsCyaPage.submit()

    await expect(browser).toHaveUrl(expect.stringContaining(listUrl()))
    await expect(
      OverseasReprocessingSitesPage.promoteSuccessBanner
    ).toBeDisplayed()

    // AC03: the next registered site goes through the same page
    await OverseasReprocessingSitesPage.addToAccreditation(second)
    await expect(browser).toHaveUrl(expect.stringContaining(ctaUrl()))
    await expect(AddOrsCyaPage.contactNameRow).toHaveText(
      expect.stringContaining('Not provided')
    )
    await AddOrsCyaPage.submit()
    await expect(AddOrsCyaPage.errorSummary).toBeDisplayed()
  })

  it('lets the operator carry on once every site in the application is complete', async () => {
    await startApplication()
    await completeOverseasSites(organisationId, applicationId)

    await browser.url(listUrl())
    await OverseasReprocessingSitesPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/confirm-overseas-sites')
    )
    await ConfirmOverseasSitesPage.confirmAndContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
  })
})
