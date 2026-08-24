import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import PrnTonnagePage from 'page-objects/prn-tonnage.page'
import PrnAuthorityPage from 'page-objects/prn-authority.page'
import PrnCheckAnswersPage from 'page-objects/prn-check-answers.page'
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
import AddInterimSiteCyaPage from 'page-objects/add-interim-site-cya.page'
import ViewPaymentDetailsPage from 'page-objects/view-payment-details.page'
import { getOverseasSites } from '../helpers/case-management.js'

// RA-477: the application fee must count only chargeable ORS (Overseas
// Reprocessing Site) entries. An interim site is nested under its linked
// ORS (chargeable-for-information only, per the regulations) and must
// never be counted as an extra ORS toward the fee.
describe('RA-477: ORS fee counting with an interim site attached', () => {
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

  it('charges for 2 Overseas Sites, not 3, when 2 ORS are added and 1 has a linked interim site', async () => {
    // Uses its own dedicated org (50014) rather than the shared org 50005 —
    // see navigateToOrsFeeTestOrg's comment for why: this spec adds ORS/
    // interim sites and asserts an exact count, the exact shape of
    // assertion the org-50005 Seed race corrupts under concurrent workers.
    await OperatorPage.navigateToOrsFeeTestOrg()
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

    // The fee page needs a planned tonnage band set (buildPaymentDetails
    // throws without one) — the ORS component of the fee is independent of
    // which band is chosen, so a random one is fine here.
    await TaskListPage.PRNTonnageLink.click()
    const headingText = await $('h1')
      .getText()
      .catch(() => '')
    const alreadyOnCheckAnswers =
      headingText === 'Check your answers before you continue'

    if (alreadyOnCheckAnswers) {
      await PrnCheckAnswersPage.confirmAndContinue()
    } else {
      await expect(browser).toHaveUrl(
        expect.stringContaining('/accreditation/tonnage')
      )
      await PrnTonnagePage.selectRandomOption()
      await PrnTonnagePage.saveAndContinue()

      await expect(browser).toHaveUrl(
        expect.stringContaining('/accreditation/tonnage-authority')
      )
      await PrnAuthorityPage.addAuthoriser()
      await PrnAuthorityPage.saveAndContinue()

      await expect(PrnCheckAnswersPage.pageHeading).toHaveText(
        'Check your answers before you continue'
      )
      await PrnCheckAnswersPage.confirmAndContinue()
    }

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    // ORS #1 — add via the wizard, then attach an interim site from its CYA
    // page (mirrors exporter-accreditation.e2e.js's "add an interim site"
    // journey).
    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await AddOrsSiteNamePage.enterSiteName('RA-477 Fee Test Recycling GmbH')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Feeteststrasse 1',
      townOrCity: 'Hamburg',
      country: 'Germany',
      coordinates: '53.5511, 9.9937'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Hans Müller',
      email: 'hans@ra477feetest.de',
      phone: '+49 40 12345678'
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

    await expect(browser).toHaveUrl(
      expect.stringContaining('/repatriated-loads')
    )
    await AddOrsRepatriatedLoadsPage.enterDescription(
      'Rejected loads are returned within 30 days at our expense via licensed courier.'
    )
    await AddOrsRepatriatedLoadsPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await expect(AddOrsCyaPage.summaryList).toBeDisplayed()

    await AddOrsCyaPage.saveAndAddInterimSite()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/add-interim-site/')
    )
    await expect(browser).toHaveUrl(expect.stringContaining('/country'))

    await AddInterimSiteCountryPage.enterCountry('Germany')
    await AddInterimSiteCountryPage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))
    await AddInterimSiteSiteNamePage.enterSiteName('RA-477 Interim Depot')
    await AddInterimSiteSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddInterimSiteSiteLocationPage.enterLocation({
      addressLine1: 'Feeteststrasse 2',
      townOrCity: 'Hamburg',
      stateOrRegion: 'Hamburg',
      postcode: '20095'
    })
    await AddInterimSiteSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddInterimSiteSiteContactPage.enterContactDetails({
      name: 'Hans Müller',
      email: 'hans@ra477feetest.de',
      phone: '+49 40 12345679'
    })
    await AddInterimSiteSiteContactPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await expect(AddInterimSiteCyaPage.summaryList).toBeDisplayed()
    await AddInterimSiteCyaPage.submit()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )
    await expect(
      OverseasReprocessingSitesPage.interimSiteSuccessBanner
    ).toBeDisplayed()

    // ORS #2 — a second, plain ORS with no interim site.
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await AddOrsSiteNamePage.enterSiteName('RA-477 Fee Test Site Two BV')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Feeteststraat 2',
      townOrCity: 'Utrecht',
      country: 'Netherlands',
      coordinates: '52.0907, 5.1214'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Test Contact',
      email: 'test@ra477feetest.nl',
      phone: '+31 30 123 4567'
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

    await expect(browser).toHaveUrl(
      expect.stringContaining('/repatriated-loads')
    )
    await AddOrsRepatriatedLoadsPage.enterDescription(
      'Rejected loads are returned within 30 days at our expense via licensed courier.'
    )
    await AddOrsRepatriatedLoadsPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await AddOrsCyaPage.submit()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )
    await expect(OverseasReprocessingSitesPage.successBanner).toBeDisplayed()

    // Confirm exactly 2 ORS exist, one with a nested interim site, before
    // checking the fee page — pins down the fixture shape independently of
    // the UI assertion below.
    const sites = await getOverseasSites(organisationId, applicationId)
    const orsSitesWithInterim = sites.filter((s) => s.interimSite != null)
    expect(sites.length).toBe(2)
    expect(orsSitesWithInterim.length).toBe(1)

    // The fee page itself: must read "for 2 Overseas Sites", never 3.
    await browser.url(`/accreditation/view-payment-details/${applicationId}`)
    await expect(ViewPaymentDetailsPage.descriptionBody).toHaveText(
      expect.stringContaining('£656.00 for 2 Overseas Sites')
    )
    await expect(ViewPaymentDetailsPage.descriptionBody).not.toHaveText(
      expect.stringContaining('3 Overseas Sites')
    )
  })
})
