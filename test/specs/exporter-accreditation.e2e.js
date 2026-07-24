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
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    // Task list — PRN tonnage
    await TaskListPage.PRNTonnageLink.click()

    const headingText = await $('h1')
      .getText()
      .catch(() => '')
    const alreadyOnCheckAnswers =
      headingText === 'Check your answers before continuing'

    if (alreadyOnCheckAnswers) {
      // Tonnage + authority already selected — just confirm
      await PrnCheckAnswersPage.confirmAndContinue()
    } else {
      // Fresh — select tonnage, add authoriser, confirm check answers
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
        'Check your answers before continuing'
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
    await BusinessPlanPage.fillPercentages([20, 20, 20, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    // More detail — required when percentages are filled
    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "More detail about how you'll spend PRN income"
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
      'Upload accreditation sampling and inspection plan - part 2 - Plastic'
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
    await OverseasReprocessingSitesPage.selectAllSites()
    await OverseasReprocessingSitesPage.continue()
    await OverseasReprocessingSitesPage.confirmAndContinue()

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
    await expect(SubmitApplicationPage.pageHeading).toHaveText(
      'Submit accreditation application'
    )
    await SubmitApplicationPage.submitApplication()

    // Confirmation
    await expect(ApplicationSubmittedPage.panelTitle).toHaveText(
      'Now pay the application charge'
    )
    const ref = await ApplicationSubmittedPage.referenceNumber.getText()
    await expect(ref).toMatch(/AP\d{2}[A-Z]{2}/)
  })

  it('Should complete the full exporter accreditation journey for Glass and submit the application', async () => {
    await expect(OperatorAccreditationPage.pageHeading).toHaveText(
      'Operator Testing Flows Landing Page'
    )
    await OperatorPage.navigateToExporterAccreditationGlass()
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    // Task list — PRN tonnage
    await TaskListPage.PRNTonnageLink.click()

    const headingText = await $('h1')
      .getText()
      .catch(() => '')
    const alreadyOnCheckAnswers =
      headingText === 'Check your answers before continuing'

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
        'Check your answers before continuing'
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
    await BusinessPlanPage.fillPercentages([20, 20, 20, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "More detail about how you'll spend PRN income"
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
      'Upload accreditation sampling and inspection plan - part 2 - Glass'
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
    await OverseasReprocessingSitesPage.selectAllSites()
    await OverseasReprocessingSitesPage.continue()
    await OverseasReprocessingSitesPage.confirmAndContinue()

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
    await expect(SubmitApplicationPage.pageHeading).toHaveText(
      'Submit accreditation application'
    )
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
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

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
      country: 'Germany'
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
    await AddOrsBaselCodesPage.enterCodes({ code1: 'A1181' })
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
  })
})
