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
import SubmitApplicationPage from 'page-objects/submit-application.page'
import ApplicationSubmittedPage from 'page-objects/application-submitted.page'

describe('RA-102: Operator Accreditation - Full Journey (Plastic)', () => {
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

  async function goToBusinessPlanForm() {
    await OperatorPage.navigateToOperatorAccreditationPlastic()
    await OperatorAccreditationPage.clickContinue()
    await TaskListPage.businessPlanLink.click()

    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/business-plan'),
      { timeout: 10000, timeoutMsg: 'Did not reach business plan page' }
    )

    // The stub may land us on the CYA or detail page if the application is pre-completed.
    // Detect by heading and navigate back to the percentage form.
    const heading = await $('h1').getText()
    if (heading === 'Check your answers before continuing') {
      await $('[data-testid="change-percent-newInfrastructurePercent"]').click()
    } else if (heading.includes('More detail')) {
      await $('a.govuk-back-link').click()
    }

    await expect(BusinessPlanPage.pageHeading).toHaveText('Business plan')
  }

  // ── Business Plan Percentage Page Validation ──────────────────────────────

  it('Should show error when percentages are left blank and do not sum to 100', async () => {
    await goToBusinessPlanForm()
    await BusinessPlanPage.fillPercentages([10, 10, 10, 10, 10, 10])
    await BusinessPlanPage.saveAndContinue()

    await expect(BusinessPlanPage.pageHeading).toHaveText('Business plan')
    await expect(BusinessPlanPage.errorSummary).toBeDisplayed()
    await expect(BusinessPlanPage.errorSummaryTitle).toHaveText(
      'There is a problem'
    )
    const errorLinks = await BusinessPlanPage.errorLinks
    await expect(errorLinks.length).toBeGreaterThan(0)
    await expect(errorLinks[0]).toHaveText('The percentages must add up to 100')
  })

  it('Should show error when a non-numeric percentage value is entered', async () => {
    await goToBusinessPlanForm()
    await BusinessPlanPage.fillPercentages(['abc', 0, 0, 0, 0, 0])
    await BusinessPlanPage.saveAndContinue()

    await expect(BusinessPlanPage.errorSummary).toBeDisplayed()
    await expect(BusinessPlanPage.errorSummaryTitle).toHaveText(
      'There is a problem'
    )
    const errorLinks = await BusinessPlanPage.errorLinks
    await expect(errorLinks.length).toBeGreaterThan(0)
    await expect(errorLinks[0]).toHaveText(
      expect.stringContaining('Enter a whole number for')
    )
  })

  it('Should show error when a percentage value is out of range', async () => {
    await goToBusinessPlanForm()
    await BusinessPlanPage.fillPercentages([150, 0, 0, 0, 0, 0])
    await BusinessPlanPage.saveAndContinue()

    await expect(BusinessPlanPage.errorSummary).toBeDisplayed()
    await expect(BusinessPlanPage.errorSummaryTitle).toHaveText(
      'There is a problem'
    )
    const errorLinks = await BusinessPlanPage.errorLinks
    await expect(errorLinks.length).toBeGreaterThan(0)
    await expect(errorLinks[0]).toHaveText(
      expect.stringContaining('must be between 0 and 100')
    )
  })

  it('Should show error when percentages are valid but do not sum to 100', async () => {
    await goToBusinessPlanForm()
    await BusinessPlanPage.fillPercentages([10, 10, 10, 10, 10, 10])
    await BusinessPlanPage.saveAndContinue()

    await expect(BusinessPlanPage.errorSummary).toBeDisplayed()
    await expect(BusinessPlanPage.errorSummaryTitle).toHaveText(
      'There is a problem'
    )
    const errorLinks = await BusinessPlanPage.errorLinks
    await expect(errorLinks.length).toBeGreaterThan(0)
    await expect(errorLinks[0]).toHaveText('The percentages must add up to 100')
  })

  // ── Business Plan Detail Page Validation ──────────────────────────────────

  it('Should show error on detail page when descriptions are missing for filled percentages', async () => {
    await goToBusinessPlanForm()
    await BusinessPlanPage.fillPercentages([20, 20, 20, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    // Stub may go straight to CYA if percentages were already saved — Back navigates to detail
    if ((await $('h1').getText()) === 'Check your answers before continuing') {
      await $('a.govuk-back-link').click()
    }

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "More detail about how you'll spend PRN income"
    )
    await BusinessPlanDetailPage.saveAndContinue()

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "More detail about how you'll spend PRN income"
    )
    await expect(BusinessPlanDetailPage.errorSummary).toBeDisplayed()
    await expect(BusinessPlanDetailPage.errorSummaryTitle).toHaveText(
      'There is a problem'
    )
    const errorLinks = await BusinessPlanDetailPage.errorLinks
    await expect(errorLinks.length).toBeGreaterThan(0)
    await expect(errorLinks[0]).toHaveText(
      'Enter a description when you have allocated a percentage to this category'
    )
  })

  it('Should show error on detail page when a description exceeds 500 characters', async () => {
    await goToBusinessPlanForm()
    await BusinessPlanPage.fillPercentages([20, 20, 20, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    // Stub may go straight to CYA if percentages were already saved — Back navigates to detail
    if ((await $('h1').getText()) === 'Check your answers before continuing') {
      await $('a.govuk-back-link').click()
    }

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "More detail about how you'll spend PRN income"
    )
    const over500 = 'A'.repeat(501)
    await BusinessPlanDetailPage.fillDescriptions(over500)
    await BusinessPlanDetailPage.saveAndContinue()

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "More detail about how you'll spend PRN income"
    )
    await expect(BusinessPlanDetailPage.errorSummary).toBeDisplayed()
    await expect(BusinessPlanDetailPage.errorSummaryTitle).toHaveText(
      'There is a problem'
    )
    const errorLinks = await BusinessPlanDetailPage.errorLinks
    await expect(errorLinks.length).toBeGreaterThan(0)
    await expect(errorLinks[0]).toHaveText(
      expect.stringContaining('must be 500 characters or fewer')
    )
  })

  // ── Full Journey ──────────────────────────────────────────────────────────

  it('Should complete the full accreditation journey and submit the application', async () => {
    await expect(OperatorAccreditationPage.pageHeading).toHaveText(
      'Operator Testing Flows Landing Page'
    )
    await OperatorPage.navigateToOperatorAccreditationPlastic()
    await expect(OperatorAccreditationPage.pageHeading).toHaveText(
      'NEWDEV RECYCLING LIMITED'
    )
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list')
    )

    // PRN tonnage
    await TaskListPage.PRNTonnageLink.click()
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
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list')
    )

    // Business plan
    await TaskListPage.businessPlanLink.click()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/business-plan'),
      { timeout: 10000 }
    )
    const bpHeading = await $('h1').getText()
    if (bpHeading === 'Check your answers before continuing') {
      await $('[data-testid="change-percent-newInfrastructurePercent"]').click()
    }
    await BusinessPlanPage.fillPercentages([20, 20, 20, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    // Stub may go straight to CYA if percentages were already saved — Back navigates to detail
    if ((await $('h1').getText()) === 'Check your answers before continuing') {
      await $('a.govuk-back-link').click()
    }

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "More detail about how you'll spend PRN income"
    )
    await BusinessPlanDetailPage.fillDescriptions()
    await BusinessPlanDetailPage.saveAndContinue()

    await BusinessPlanCheckAnswersPage.confirmAndContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list')
    )

    // Sampling and inspection plan
    await TaskListPage.SIPlanLink.click()
    await expect(SamplingPlanPage.pageHeading).toHaveText(
      'Upload accreditation sampling and inspection plan'
    )
    await SamplingPlanPage.uploadFile('business-plan.pdf')
    await SamplingPlanPage.saveAndContinue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list')
    )
    await TaskListPage.assertAllTasksCompleted({ isExporter: false })
    await TaskListPage.continueToSubmit()

    await expect(SubmitApplicationPage.pageHeading).toHaveText(
      'Submit accreditation application'
    )
    await SubmitApplicationPage.submitApplication()

    await expect(ApplicationSubmittedPage.panelTitle).toHaveText(
      'Application submitted'
    )
    const ref = await ApplicationSubmittedPage.referenceNumber.getText()
    await expect(ref).toMatch(/RA-\d+/)
  })
})
