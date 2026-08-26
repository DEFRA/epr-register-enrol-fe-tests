import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import PrnTonnagePage from 'page-objects/prn-tonnage.page'
import PrnAuthorityPage from 'page-objects/prn-authority.page'
import PrnCheckAnswersPage from 'page-objects/prn-check-answers.page'
import BusinessPlanPage from 'page-objects/business-plan.page'
import BusinessPlanDetailPage from 'page-objects/business-plan-detail.page'
import BusinessPlanCheckAnswersPage from 'page-objects/business-plan-check-answers.page'
import SamplingPlanPage from 'page-objects/sampling-plan.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import ConfirmOverseasSitesPage from 'page-objects/confirm-overseas-sites.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'
import ApplicationSubmittedPage from 'page-objects/application-submitted.page'
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
import { getApplication, getOverseasSites } from '../helpers/case-management.js'
import {
  expectedMaterialDisplay,
  expectedSiteName
} from '../helpers/applicationHeader.js'
import { assertEligiblePersonWording } from '../helpers/declaration.js'

// RA-424: the four PRN tonnage bands, in display order, as they must now read.
const EXPECTED_TONNAGE_LABELS = [
  'Up to 500 tonnes',
  'Up to 5,000 tonnes',
  'Up to 10,000 tonnes',
  'More than 10,000 tonnes'
]

async function assertTonnageBandLabels() {
  const labels = await PrnTonnagePage.radioLabels
  await labels[0].waitForDisplayed()
  const labelText = await Promise.all(
    [...labels].map((label) => label.getText())
  )
  expect(labelText).toEqual(EXPECTED_TONNAGE_LABELS)
}

describe('Exporter Accreditation - Full Journey (Plastic 2027)', () => {
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

  it('Should complete the full exporter accreditation journey and submit the application', async () => {
    // Accreditation landing
    await expect(OperatorAccreditationPage.pageHeading).toHaveText(
      'Operator Testing Flows Landing Page'
    )
    await OperatorPage.navigateToExporterAccreditationPlastic()
    const landingUrl = await browser.getUrl()
    const [, organisationId] = new URL(landingUrl).pathname
      .split('/')
      .filter(Boolean)
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    // RA-309 AC03 / RA-424: persistent header on an exporter journey — site
    // name must show the operator's UK registered address, not the overseas
    // reprocessing site address (and not the literal word "Exporter")
    const applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]
    const application = await getApplication(organisationId, applicationId)
    await expect(TaskListPage.applicationHeader).toBeDisplayed()
    await expect(TaskListPage.applicationHeaderOperatorName).toHaveText(
      application.organisationName
    )
    await expect(TaskListPage.applicationHeaderMaterialType).toHaveText(
      expectedMaterialDisplay(application)
    )
    await expect(TaskListPage.applicationHeaderSiteName).toHaveText(
      expectedSiteName(application)
    )
    expect(application.isExporter).toBe(true)

    // Task list — PRN tonnage
    await TaskListPage.PRNTonnageLink.click()

    const headingText = await $('h1')
      .getText()
      .catch(() => '')
    const alreadyOnCheckAnswers =
      headingText === 'Check your answers before you continue'

    if (alreadyOnCheckAnswers) {
      // Tonnage + authority already selected — just confirm
      await PrnCheckAnswersPage.confirmAndContinue()
    } else {
      // Fresh — select tonnage, add authoriser, confirm check answers
      await expect(browser).toHaveUrl(
        expect.stringContaining('/accreditation/tonnage')
      )
      await assertTonnageBandLabels()
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

    // Back to task list
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    // Task list — business plan
    await TaskListPage.businessPlanLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/business-plan')
    )
    await BusinessPlanPage.fillPercentages([15, 15, 15, 15, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    // More detail — required when percentages are filled
    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "Add more details about how you'll spend the PERN income"
    )
    await BusinessPlanDetailPage.fillDescriptions()
    await BusinessPlanDetailPage.saveAndContinue()

    // Business plan check your answers
    await BusinessPlanCheckAnswersPage.confirmAndContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    // Task list — sampling and inspection plan
    await TaskListPage.SIPlanLink.click()
    await expect(SamplingPlanPage.pageHeading).toHaveText(
      'Upload sampling and inspection plan - part 2 - Plastic'
    )
    await SamplingPlanPage.uploadFile('business-plan.pdf')
    await SamplingPlanPage.saveAndContinue()

    // Task list — overseas reprocessing sites
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.continue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/confirm-overseas-sites')
    )
    await ConfirmOverseasSitesPage.confirmAndContinue()

    // Task list — BES evidence
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    await TaskListPage.besLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining(
        '/accreditation/upload-evidence-for-overseas-site/'
      )
    )
    await BesEvidencePage.uploadAllEvidence('business-plan.pdf')

    await TaskListPage.continueToSubmit()
    // Declaration
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/submit-declaration/')
    )
    await expect(SubmitApplicationPage.pageHeading).toHaveText('Declaration')
    await assertEligiblePersonWording(SubmitApplicationPage)
    await SubmitApplicationPage.submitApplication()

    // Confirmation
    await expect(ApplicationSubmittedPage.panelTitle).toHaveText(
      'Now pay the application charge'
    )
    const ref = await ApplicationSubmittedPage.referenceNumber.getText()
    await expect(ref).toMatch(/AP\d{2}[A-Z]{2}/)
  })

  // RA-374 regression: the task list's back link is built from the
  // application record via the shared landingUrl() helper. It previously
  // omitted registrationId for exporter applications, producing a 404 (e.g.
  // /operator-accreditation/50005/Plastic/2027 instead of the real 4-segment
  // route with registrationId included).
  it('Should navigate back from the task list to the operator-accreditation landing page', async () => {
    await OperatorPage.navigateToExporterAccreditationPlastic()
    const landingUrl = await browser.getUrl()
    const [, organisationId, registrationId] = new URL(landingUrl).pathname
      .split('/')
      .filter(Boolean)
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    await TaskListPage.backLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining(
        `/operator-accreditation/${organisationId}/${registrationId}/Plastic/`
      )
    )
    await expect(OperatorAccreditationPage.pageHeading).toHaveText(
      'Reapply for accreditation'
    )
  })

  it('Should complete the full exporter accreditation journey for Glass and submit the application', async () => {
    await expect(OperatorAccreditationPage.pageHeading).toHaveText(
      'Operator Testing Flows Landing Page'
    )
    await OperatorPage.navigateToExporterAccreditationGlass()
    const landingUrl = await browser.getUrl()
    const [, organisationId] = new URL(landingUrl).pathname
      .split('/')
      .filter(Boolean)
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    // RA-309 AC03 / RA-424: persistent header on an exporter journey — site
    // name must show the operator's UK registered address, not the overseas
    // reprocessing site address (and not the literal word "Exporter")
    const applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]
    const application = await getApplication(organisationId, applicationId)
    await expect(TaskListPage.applicationHeader).toBeDisplayed()
    await expect(TaskListPage.applicationHeaderOperatorName).toHaveText(
      application.organisationName
    )
    await expect(TaskListPage.applicationHeaderMaterialType).toHaveText(
      expectedMaterialDisplay(application)
    )
    await expect(TaskListPage.applicationHeaderSiteName).toHaveText(
      expectedSiteName(application)
    )
    expect(application.isExporter).toBe(true)

    // Task list — PRN tonnage
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
      await assertTonnageBandLabels()
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

    // Business plan
    await TaskListPage.businessPlanLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/business-plan')
    )
    await BusinessPlanPage.fillPercentages([15, 15, 15, 15, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "Add more details about how you'll spend the PERN income"
    )
    await BusinessPlanDetailPage.fillDescriptions()
    await BusinessPlanDetailPage.saveAndContinue()

    await BusinessPlanCheckAnswersPage.confirmAndContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    // Sampling and inspection plan
    await TaskListPage.SIPlanLink.click()
    await expect(SamplingPlanPage.pageHeading).toHaveText(
      'Upload sampling and inspection plan - part 2 - Glass'
    )
    await SamplingPlanPage.uploadFile('business-plan.pdf')
    await SamplingPlanPage.saveAndContinue()

    // Overseas reprocessing sites
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.continue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/confirm-overseas-sites')
    )
    await ConfirmOverseasSitesPage.confirmAndContinue()

    // BES evidence
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    await TaskListPage.besLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining(
        '/accreditation/upload-evidence-for-overseas-site/'
      )
    )
    await BesEvidencePage.uploadAllEvidence('business-plan.pdf')

    await TaskListPage.continueToSubmit()

    // Declaration
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/submit-declaration/')
    )
    await expect(SubmitApplicationPage.pageHeading).toHaveText('Declaration')
    await assertEligiblePersonWording(SubmitApplicationPage)
    await SubmitApplicationPage.submitApplication()

    // Confirmation
    await expect(ApplicationSubmittedPage.panelTitle).toHaveText(
      'Now pay the application charge'
    )
    const ref = await ApplicationSubmittedPage.referenceNumber.getText()
    await expect(ref).toMatch(/AP\d{2}[A-Z]{2}/)
  })

  it('Should add a new overseas reprocessing site via the Add ORS wizard (Plastic)', async () => {
    await OperatorPage.navigateToExporterAccreditationPlastic()
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

    // Navigate to overseas reprocessing sites
    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )

    // Click the Add new ORS button
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/add-overseas-site/')
    )
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    // Step 1: Site name
    await expect(AddOrsSiteNamePage.pageHeading).toBeDisplayed()
    await AddOrsSiteNamePage.enterSiteName('Test Recycling GmbH')
    await AddOrsSiteNamePage.continue()

    // Step 2: Site location
    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Industriestrasse 42',
      townOrCity: 'Hamburg',
      country: 'Germany',
      coordinates: '53.5511, 9.9937'
    })
    await AddOrsSiteLocationPage.continue()

    // Step 3: Contact details
    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Hans Müller',
      email: 'hans@testrecycling.de',
      phone: '+49 40 12345678'
    })
    await AddOrsSiteContactPage.continue()

    // Step 4: Recycling operation
    await expect(browser).toHaveUrl(
      expect.stringContaining('/recycling-operation-details')
    )
    await AddOrsRecyclingOperationPage.selectOperationCode('R3')
    await AddOrsRecyclingOperationPage.continue()

    // Step 5: Basel/OECD codes
    await expect(browser).toHaveUrl(
      expect.stringContaining('/basel-convention-and-oecd-code')
    )
    await AddOrsBaselCodesPage.enterCodes(['A1181'])
    await AddOrsBaselCodesPage.continue()

    // Step 6: Repatriated loads
    await expect(browser).toHaveUrl(
      expect.stringContaining('/repatriated-loads')
    )
    await AddOrsRepatriatedLoadsPage.enterDescription(
      'Rejected loads are returned within 30 days at our expense via licensed courier.'
    )
    await AddOrsRepatriatedLoadsPage.continue()

    // Plastic skips conditions-of-export and goes straight to CYA
    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )

    // Step 7: Check your answers
    await expect(AddOrsCyaPage.summaryList).toBeDisplayed()
    await expect(AddOrsCyaPage.siteNameRow).toBeDisplayed()
    await AddOrsCyaPage.submit()

    // Back on select-overseas-sites with success banner
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )
    await expect(OverseasReprocessingSitesPage.successBanner).toBeDisplayed()

    // RA-297: a site added fresh via the wizard is flagged isNewSite === true
    // — asserted via a direct API call since this flag isn't rendered
    // anywhere in the UI (management-fe is out of scope, see RA-311)
    const sites = await getOverseasSites(organisationId, applicationId)
    const newSite = sites.find((s) => s.siteName === 'Test Recycling GmbH')
    expect(newSite).toBeDefined()
    expect(newSite.isNewSite).toBe(true)
  })

  it('Should add an interim site from the Add ORS check-your-answers page (Plastic)', async () => {
    await OperatorPage.navigateToExporterAccreditationPlastic()
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

    // Navigate to overseas reprocessing sites and start the Add ORS wizard
    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await expect(AddOrsSiteNamePage.pageHeading).toBeDisplayed()
    await AddOrsSiteNamePage.enterSiteName('Le Relais Recyclage SARL')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Rue de la Logistique 12',
      townOrCity: 'Lyon',
      country: 'France',
      coordinates: '45.7640, 4.8357'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Camille Dubois',
      email: 'camille@lerelaisrecyclage.fr',
      phone: '+33 4 12 34 56 78'
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

    // Plastic skips conditions-of-export and goes straight to CYA
    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await expect(AddOrsCyaPage.summaryList).toBeDisplayed()

    // Instead of the normal "Add this site" submit, use the new entry point
    // into the interim-site wizard (RA-294)
    await AddOrsCyaPage.saveAndAddInterimSite()

    // Lands on the interim-site wizard's first step, not select-overseas-sites
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/add-interim-site/')
    )
    await expect(browser).toHaveUrl(expect.stringContaining('/country'))

    // Step 1: Country
    await expect(AddInterimSiteCountryPage.pageHeading).toBeDisplayed()
    await AddInterimSiteCountryPage.enterCountry('France')
    await AddInterimSiteCountryPage.continue()

    // Step 2: Site name
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))
    await AddInterimSiteSiteNamePage.enterSiteName('Le Relais Interim Depot')
    await AddInterimSiteSiteNamePage.continue()

    // Step 3: Site location
    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddInterimSiteSiteLocationPage.enterLocation({
      addressLine1: 'Rue de la Logistique 14',
      townOrCity: 'Lyon',
      stateOrRegion: 'Auvergne-Rhone-Alpes',
      postcode: '69001'
    })
    await AddInterimSiteSiteLocationPage.continue()

    // Step 4: Contact details
    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddInterimSiteSiteContactPage.enterContactDetails({
      name: 'Camille Dubois',
      email: 'camille@lerelaisrecyclage.fr',
      phone: '+33 4 12 34 56 79'
    })
    await AddInterimSiteSiteContactPage.continue()

    // Step 5: Check your answers
    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await expect(AddInterimSiteCyaPage.summaryList).toBeDisplayed()
    await expect(AddInterimSiteCyaPage.siteNameRow).toBeDisplayed()
    await AddInterimSiteCyaPage.submit()

    // Back on select-overseas-sites with the interim-site success banner —
    // distinct from the ORS success banner used by the plain "Add this site"
    // path above
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )
    await expect(
      OverseasReprocessingSitesPage.interimSiteSuccessBanner
    ).toBeDisplayed()

    // RA-297: both the linked ORS site and its nested interim site are
    // flagged isNewSite === true, asserted directly against the API since
    // the flag isn't rendered anywhere in the UI (management-fe is out of
    // scope, see RA-311)
    const sites = await getOverseasSites(organisationId, applicationId)
    const orsSite = sites.find((s) => s.siteName === 'Le Relais Recyclage SARL')
    expect(orsSite).toBeDefined()
    expect(orsSite.isNewSite).toBe(true)
    expect(orsSite.interimSite).toBeDefined()
    expect(orsSite.interimSite.isNewSite).toBe(true)
  })

  it('Should show validation errors for missing and malformed interim-site contact details (AC02/AC04)', async () => {
    await OperatorPage.navigateToExporterAccreditationPlastic()
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    const applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    // Drive the interim-site wizard's own steps directly — reaching this
    // point via the ORS CYA button is covered by the happy-path test above,
    // and the wizard's earlier steps don't gate on a linked ORS site.
    await browser.url(
      `/accreditation/add-interim-site/${applicationId}/country`
    )
    await AddInterimSiteCountryPage.enterCountry('France')
    await AddInterimSiteCountryPage.continue()
    await AddInterimSiteSiteNamePage.enterSiteName('Le Relais Interim Depot')
    await AddInterimSiteSiteNamePage.continue()
    await AddInterimSiteSiteLocationPage.enterLocation({
      addressLine1: 'Rue de la Logistique 14',
      townOrCity: 'Lyon'
    })
    await AddInterimSiteSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )

    // Missing required fields — name, email and phone all blank
    await AddInterimSiteSiteContactPage.enterContactDetails({})
    await AddInterimSiteSiteContactPage.continue()
    await expect(AddInterimSiteSiteContactPage.errorSummary).toBeDisplayed()
    await expect(AddInterimSiteSiteContactPage.errorSummary).toHaveText(
      expect.stringContaining('Enter the contact name')
    )
    await expect(AddInterimSiteSiteContactPage.errorSummary).toHaveText(
      expect.stringContaining('Enter the email address')
    )
    await expect(AddInterimSiteSiteContactPage.errorSummary).toHaveText(
      expect.stringContaining('Enter the phone number')
    )

    // Malformed email — distinct message from "required", and shouldn't trip
    // the other two fields' errors once they're filled in correctly
    await AddInterimSiteSiteContactPage.enterContactDetails({
      name: 'Camille Dubois',
      email: 'not-an-email',
      phone: '+33 4 12 34 56 79'
    })
    await AddInterimSiteSiteContactPage.continue()
    await expect(AddInterimSiteSiteContactPage.errorSummary).toBeDisplayed()
    await expect(AddInterimSiteSiteContactPage.errorSummary).toHaveText(
      expect.stringContaining(
        'Enter an email address in the correct format, like name@example.com'
      )
    )
    await expect(AddInterimSiteSiteContactPage.errorSummary).not.toHaveText(
      expect.stringContaining('Enter the contact name')
    )
    await expect(AddInterimSiteSiteContactPage.errorSummary).not.toHaveText(
      expect.stringContaining('Enter the phone number')
    )
  })

  it('Should support adding and removing multiple Basel/OECD codes via the Add ORS CYA page (Plastic)', async () => {
    await OperatorPage.navigateToExporterAccreditationPlastic()
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await AddOrsSiteNamePage.enterSiteName('Nordisk Gjenvinning AS')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Gjenvinningsveien 8',
      townOrCity: 'Oslo',
      country: 'Norway',
      coordinates: '59.9139, 10.7522'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Kari Nordmann',
      email: 'kari@nordiskgjenvinning.no',
      phone: '+47 22 12 34 56'
    })
    await AddOrsSiteContactPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/recycling-operation-details')
    )
    await AddOrsRecyclingOperationPage.selectOperationCode('R3')
    await AddOrsRecyclingOperationPage.continue()

    // Basel/OECD codes — exercise the "add another code" path with the
    // maximum of 3 codes, which the single-code journeys above never do
    await expect(browser).toHaveUrl(
      expect.stringContaining('/basel-convention-and-oecd-code')
    )
    await AddOrsBaselCodesPage.enterCodes(['A1181', 'GC030', 'B3011'])
    await AddOrsBaselCodesPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/repatriated-loads')
    )
    await AddOrsRepatriatedLoadsPage.enterDescription(
      'Rejected loads are returned within 30 days at our expense via licensed courier.'
    )
    await AddOrsRepatriatedLoadsPage.continue()

    // Plastic skips conditions-of-export and goes straight to CYA
    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await expect(AddOrsCyaPage.baselCodesRow).toBeDisplayed()
    await expect(AddOrsCyaPage.baselCodesRow).toHaveText(
      expect.stringContaining('A1181')
    )
    await expect(AddOrsCyaPage.baselCodesRow).toHaveText(
      expect.stringContaining('GC030')
    )
    await expect(AddOrsCyaPage.baselCodesRow).toHaveText(
      expect.stringContaining('B3011')
    )

    // Delete the middle code and confirm only it disappears from the CYA row
    await AddOrsCyaPage.deleteCode(1)
    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await expect(AddOrsCyaPage.baselCodesRow).toHaveText(
      expect.stringContaining('A1181')
    )
    await expect(AddOrsCyaPage.baselCodesRow).toHaveText(
      expect.stringContaining('B3011')
    )
    await expect(AddOrsCyaPage.baselCodesRow).not.toHaveText(
      expect.stringContaining('GC030')
    )

    await AddOrsCyaPage.submit()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )
    await expect(OverseasReprocessingSitesPage.successBanner).toBeDisplayed()
  })

  // RA-377: Basel/OECD codes moved from free-text (validated only by shape)
  // to a type-ahead sourced from a closed, approved list. The three cases
  // below had no coverage before this change.
  it('Should show a validation error and disable Continue for a non-matching Basel/OECD code (RA-377 AC05)', async () => {
    await OperatorPage.navigateToExporterAccreditationPlastic()
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await AddOrsSiteNamePage.enterSiteName('Ungueltiger Code GmbH')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Fehlerstrasse 1',
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
      email: 'test@ungueltigercode.de',
      phone: '+49 89 123456'
    })
    await AddOrsSiteContactPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/recycling-operation-details')
    )
    await AddOrsRecyclingOperationPage.selectOperationCode('R3')
    await AddOrsRecyclingOperationPage.continue()

    // The code field is a type-ahead sourced from a fixed, approved list —
    // a value with no matching suggestion is invalid, not just an
    // unconventional shape (this closes the Y-code shape-regex bug the
    // free-text field had). Continue's validity is recomputed on every
    // keystroke, so it disables immediately without a submit round-trip.
    await expect(browser).toHaveUrl(
      expect.stringContaining('/basel-convention-and-oecd-code')
    )
    await AddOrsBaselCodesPage.enterCode(1, 'ZZZZZ')
    await expect(AddOrsBaselCodesPage.errorSummary).toBeDisplayed()
    await expect(AddOrsBaselCodesPage.errorSummary).toHaveText(
      expect.stringContaining('No matches found')
    )
    await expect(AddOrsBaselCodesPage.continueButton).toBeDisabled()
  })

  it('Should reject a Basel/OECD code duplicated across two rows (RA-377)', async () => {
    await OperatorPage.navigateToExporterAccreditationPlastic()
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await AddOrsSiteNamePage.enterSiteName('Doublon de Code SARL')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Rue du Doublon 1',
      townOrCity: 'Lille',
      country: 'France',
      coordinates: '50.6292, 3.0573'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Test Contact',
      email: 'test@doublondecode.fr',
      phone: '+33 3 12 34 56 78'
    })
    await AddOrsSiteContactPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/recycling-operation-details')
    )
    await AddOrsRecyclingOperationPage.selectOperationCode('R3')
    await AddOrsRecyclingOperationPage.continue()

    // Entering the same approved code in two rows isn't a shape problem, so
    // the type-ahead itself can't block it purely by typing (the dropdown
    // only *excludes* already-picked codes from suggestions in other rows —
    // it doesn't stop a value being confirmed directly). The duplicate is
    // caught server-side on submit, same per-index error plumbing as every
    // other validation failure in this wizard (full page reload, still on
    // this step).
    await expect(browser).toHaveUrl(
      expect.stringContaining('/basel-convention-and-oecd-code')
    )
    await AddOrsBaselCodesPage.enterCodes(['A1181', 'A1181'])
    await AddOrsBaselCodesPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/basel-convention-and-oecd-code')
    )
    await expect(AddOrsBaselCodesPage.errorSummary).toBeDisplayed()
  })

  it('Should reject leaving all Basel/OECD code rows blank (RA-377, code now required)', async () => {
    await OperatorPage.navigateToExporterAccreditationPlastic()
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await AddOrsSiteNamePage.enterSiteName('Aucun Code SARL')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Rue Vide 1',
      townOrCity: 'Nantes',
      country: 'France',
      coordinates: '47.2184, -1.5536'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Test Contact',
      email: 'test@aucuncode.fr',
      phone: '+33 2 12 34 56 78'
    })
    await AddOrsSiteContactPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/recycling-operation-details')
    )
    await AddOrsRecyclingOperationPage.selectOperationCode('R3')
    await AddOrsRecyclingOperationPage.continue()

    // At least one code is now required client/server-side (previously
    // nothing caught an all-blank submission until the backend rejected the
    // mandatory Code1 later in the journey). Leave the single default row
    // untouched and try to continue.
    await expect(browser).toHaveUrl(
      expect.stringContaining('/basel-convention-and-oecd-code')
    )
    await AddOrsBaselCodesPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/basel-convention-and-oecd-code')
    )
    await expect(AddOrsBaselCodesPage.errorSummary).toBeDisplayed()
  })

  it('Should remove a newly added overseas site from accreditation, deleting it entirely (Plastic)', async () => {
    await OperatorPage.navigateToExporterAccreditationPlastic()
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

    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await AddOrsSiteNamePage.enterSiteName('Temporary Removal Test BV')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Verwijderingsweg 1',
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
      email: 'test@temporaryremoval.nl',
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

    const sitesAfterAdd = await getOverseasSites(organisationId, applicationId)
    const newSite = sitesAfterAdd.find(
      (s) => s.siteName === 'Temporary Removal Test BV'
    )
    expect(newSite).toBeDefined()

    // New sites live in the "New sites" section and their Remove From
    // Accreditation action deletes the record entirely (RA-298/RA-300) —
    // unlike an already-accredited site, which is only unaccredited.
    await expect(
      OverseasReprocessingSitesPage.newSiteRow(newSite.siteId)
    ).toBeDisplayed()
    await OverseasReprocessingSitesPage.removeNewSite(newSite.siteId)
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )

    const sitesAfterRemove = await getOverseasSites(
      organisationId,
      applicationId
    )
    expect(
      sitesAfterRemove.find((s) => s.siteName === 'Temporary Removal Test BV')
    ).toBeUndefined()
  })

  // RA-470: optional coverage for the new "Change" action on an overseas
  // site row — a second entry point into the add-overseas-site wizard,
  // alongside the existing "Add To Accreditation"/promote entry point
  // exercised implicitly by the add/remove tests above. Clicking Change
  // navigates to .../select-overseas-sites/{applicationId}/edit/{siteId}
  // (mirroring .../promote/{siteId}), replays the wizard pre-seeded with the
  // site's existing data, and on submit issues a PATCH (updateOverseasSite)
  // instead of a create, landing back on select-overseas-sites with the
  // edit-success banner rather than the normal add-success banner. This
  // depends on the paired RA-470 frontend and backend changes — the edit
  // route, the Change link, and the PATCH endpoint don't exist until those
  // land, so this test cannot pass until then.
  it('Should change a newly added overseas site via the Change link, submitting an update (Plastic)', async () => {
    await OperatorPage.navigateToExporterAccreditationPlastic()
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

    // Add a site via the normal wizard first, so there's a New sites row
    // with a Change link to exercise — New sites carry the same
    // "Remove from accreditation" + "Change" pairing as the Accredited
    // section, without needing pre-seeded accredited/registered fixture data.
    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await AddOrsSiteNamePage.enterSiteName('RA-470 Change Test Ltd')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Original Strasse 1',
      townOrCity: 'Berlin',
      country: 'Germany',
      coordinates: '52.5200, 13.4050'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Original Contact',
      email: 'original@ra470changetest.de',
      phone: '+49 30 123456'
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

    const sitesAfterAdd = await getOverseasSites(organisationId, applicationId)
    const site = sitesAfterAdd.find(
      (s) => s.siteName === 'RA-470 Change Test Ltd'
    )
    expect(site).toBeDefined()
    const siteId = site.siteId

    // Click Change on the new site's row — routes through
    // .../edit/{siteId}, straight back into the wizard's first step.
    await expect(
      OverseasReprocessingSitesPage.newSiteRow(siteId)
    ).toBeDisplayed()
    await OverseasReprocessingSitesPage.editNewSite(siteId)
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))
    await expect(browser).toHaveUrl(
      expect.stringContaining(`/add-overseas-site/${applicationId}/`)
    )

    // Replay the wizard, updating the details to prove this is an edit of
    // the existing site rather than a second, separate one.
    await AddOrsSiteNamePage.enterSiteName('RA-470 Change Test Ltd (Updated)')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Geanderte Strasse 2',
      townOrCity: 'Munich',
      country: 'Germany',
      coordinates: '48.1351, 11.5820'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Updated Contact',
      email: 'updated@ra470changetest.de',
      phone: '+49 89 654321'
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
      'Rejected loads are returned within 30 days at our expense via licensed courier, updated.'
    )
    await AddOrsRepatriatedLoadsPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await expect(AddOrsCyaPage.summaryList).toBeDisplayed()
    await expect(AddOrsCyaPage.siteNameRow).toHaveText(
      expect.stringContaining('RA-470 Change Test Ltd (Updated)')
    )

    // Same submit button/action as the create and promote flows — the
    // server, not the client, decides create vs promote vs update from
    // whichever of editingSiteId/promotingSiteId is set in the wizard
    // session.
    await AddOrsCyaPage.submit()

    // Back on select-overseas-sites with the edit-success banner — distinct
    // from both the plain add-success banner and the promote-success
    // banner used by the other two entry points into this same wizard.
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )
    await expect(
      OverseasReprocessingSitesPage.editSuccessBanner
    ).toBeDisplayed()

    // The update must have PATCHed the existing site record — same siteId,
    // still exactly one site with this name, not a second one created
    // alongside the original.
    const sitesAfterEdit = await getOverseasSites(organisationId, applicationId)
    const updatedSite = sitesAfterEdit.find((s) => s.siteId === siteId)
    expect(updatedSite).toBeDefined()
    expect(updatedSite.siteName).toBe('RA-470 Change Test Ltd (Updated)')
    expect(sitesAfterEdit.filter((s) => s.siteId === siteId)).toHaveLength(1)
  })

  it('Should navigate back to select-overseas-sites via the confirm-overseas-sites Change link (Plastic)', async () => {
    await OperatorPage.navigateToExporterAccreditationPlastic()
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await AddOrsSiteNamePage.enterSiteName('Change Link Test AB')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Andringen 1',
      townOrCity: 'Stockholm',
      country: 'Sweden',
      coordinates: '59.3293, 18.0686'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Test Contact',
      email: 'test@changelinktest.se',
      phone: '+46 8 123 456'
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

    // A freshly added site defaults into the Accredited section, so Continue
    // is immediately available without any further action.
    await OverseasReprocessingSitesPage.continue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/confirm-overseas-sites')
    )

    const siteRow = await $(
      '[data-testid="sites-list"] [data-testid^="site-row-"]'
    )
    const testId = await siteRow.getAttribute('data-testid')
    const siteId = testId.replace('site-row-', '')

    await ConfirmOverseasSitesPage.changeSite(siteId)
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )
  })
})
