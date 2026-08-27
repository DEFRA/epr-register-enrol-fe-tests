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
import { getApplication } from '../helpers/case-management.js'
import { expectedCaptionText } from '../helpers/applicationHeader.js'
import { assertEligiblePersonWording } from '../helpers/declaration.js'

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

    // Wait to land on the task list
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )

    // When the business plan task is already COMPLETED the link testid is not rendered.
    // In that case extract the appId from the task list URL and navigate directly.
    if (await TaskListPage.businessPlanLink.isExisting()) {
      await TaskListPage.businessPlanLink.click()
    } else {
      const taskListUrl = await browser.getUrl()
      const appId = taskListUrl
        .split('/accreditation/task-list/')[1]
        .split('?')[0]
      await browser.url(`/accreditation/business-plan/${appId}`)
    }

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
    await BusinessPlanPage.fillPercentages([10, 10, 10, 10, 10, 10, 10])
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
    await BusinessPlanPage.fillPercentages(['abc', 0, 0, 0, 0, 0, 0])
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
    await BusinessPlanPage.fillPercentages([150, 0, 0, 0, 0, 0, 0])
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
    await BusinessPlanPage.fillPercentages([10, 10, 10, 10, 10, 10, 10])
    await BusinessPlanPage.saveAndContinue()

    await expect(BusinessPlanPage.errorSummary).toBeDisplayed()
    await expect(BusinessPlanPage.errorSummaryTitle).toHaveText(
      'There is a problem'
    )
    const errorLinks = await BusinessPlanPage.errorLinks
    await expect(errorLinks.length).toBeGreaterThan(0)
    await expect(errorLinks[0]).toHaveText('The percentages must add up to 100')
  })

  // ── RA-496: task-list save buttons set the correct section status ─────────

  it('Should accept incomplete percentages on save-and-come-later and mark the section IN PROGRESS', async () => {
    await goToBusinessPlanForm()
    // Deliberately doesn't sum to 100 — save-and-come-later must skip the
    // sum-to-100 check (unlike save-and-continue, asserted above) and still
    // succeed, with the section explicitly left IN PROGRESS rather than
    // whatever data completeness alone would otherwise compute.
    await BusinessPlanPage.fillPercentages([10, 0, 0, 0, 0, 0, 0])
    await BusinessPlanPage.saveAndComeLater()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    await expect(TaskListPage.businessPlanStatus).toHaveText('IN PROGRESS')
  })

  // ── Business Plan Detail Page Validation ──────────────────────────────────

  it('Should show error on detail page when descriptions are missing for filled percentages', async () => {
    await goToBusinessPlanForm()
    await BusinessPlanPage.fillPercentages([15, 15, 15, 15, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    // Stub may go straight to CYA if percentages were already saved — Back navigates to detail
    if ((await $('h1').getText()) === 'Check your answers before continuing') {
      await $('a.govuk-back-link').click()
    }

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "Add more details about how you'll spend the PRN income"
    )
    // Stub may have pre-filled descriptions — clear them so the blank submission triggers errors
    await BusinessPlanDetailPage.fillDescriptions('')
    await BusinessPlanDetailPage.saveAndContinue()

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "Add more details about how you'll spend the PRN income"
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
    await BusinessPlanPage.fillPercentages([15, 15, 15, 15, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    // Stub may go straight to CYA if percentages were already saved — Back navigates to detail
    if ((await $('h1').getText()) === 'Check your answers before continuing') {
      await $('a.govuk-back-link').click()
    }

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "Add more details about how you'll spend the PRN income"
    )
    const over500 = 'A'.repeat(501)
    await BusinessPlanDetailPage.fillDescriptions(over500)
    await BusinessPlanDetailPage.saveAndContinue()

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "Add more details about how you'll spend the PRN income"
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
    // Heading is now fixed copy (RA-309) — material is shown in the
    // persistent header instead of being interpolated into the h1.
    await expect(OperatorAccreditationPage.pageHeading).toHaveText(
      'Reapply for accreditation'
    )

    // RA-309 AC03: persistent header is present on the landing page too
    await expect(OperatorAccreditationPage.applicationHeader).toBeDisplayed()
    await expect(
      OperatorAccreditationPage.applicationHeaderOperatorName
    ).not.toHaveText('')

    const landingUrl = await browser.getUrl()
    const [, organisationId] = new URL(landingUrl).pathname
      .split('/')
      .filter(Boolean)

    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list')
    )

    // RA-506: the task list, like every journey page but the landing
    // page, shows a govuk-caption-l instead of the persistent header
    const applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]
    const application = await getApplication(organisationId, applicationId)
    await expect(TaskListPage.pageCaption).toHaveText(
      expectedCaptionText(application)
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
      'Check your answers before you continue'
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
    await BusinessPlanPage.fillPercentages([15, 15, 15, 15, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    // Stub may go straight to CYA if percentages were already saved — Back navigates to detail
    if ((await $('h1').getText()) === 'Check your answers before continuing') {
      await $('a.govuk-back-link').click()
    }

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "Add more details about how you'll spend the PRN income"
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
      'Upload sampling and inspection plan - part 2 - Plastic'
    )
    await SamplingPlanPage.uploadFile('business-plan.pdf')

    // RA-406: prove the SupportingEvidence document type option is actually
    // wired end to end (selected on upload, persisted, shown correctly on
    // the results table) — every other spec in this repo only exercises the
    // default SamplingPlan path.
    await SamplingPlanPage.uploadAnotherFileLink.click()
    await SamplingPlanPage.uploadFile('business-plan.pdf', 'SupportingEvidence')
    await expect(SamplingPlanPage.fileRows).toBeElementsArrayOfSize(2)
    await expect(
      SamplingPlanPage.documentTypeCellContaining('Supporting evidence')
    ).toBeDisplayed()

    await SamplingPlanPage.saveAndContinue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list')
    )
    await TaskListPage.assertAllTasksCompleted({ isExporter: false })
    await TaskListPage.continueToSubmit()

    await expect(SubmitApplicationPage.pageHeading).toHaveText('Declaration')
    await assertEligiblePersonWording(SubmitApplicationPage)
    await SubmitApplicationPage.submitApplication()

    await expect(ApplicationSubmittedPage.panelTitle).toHaveText(
      'Now pay the application charge'
    )
    const ref = await ApplicationSubmittedPage.referenceNumber.getText()
    await expect(ref).toMatch(/AP\d{2}[A-Z]{2}/)

    // RA-290 AC06: payment details are shown inline on the submission page
    // itself now, not behind a separate "View payment details" page.
    await expect(ApplicationSubmittedPage.amountDue).toBeDisplayed()
    await expect(ApplicationSubmittedPage.descriptionHeading).toBeDisplayed()
    await expect(ApplicationSubmittedPage.bankAmount).toBeDisplayed()
    await expect(ApplicationSubmittedPage.bankSortCode).toHaveText('60-70-80')
    await expect(ApplicationSubmittedPage.bankAccountNumber).toHaveText(
      '10014411'
    )
    await expect(ApplicationSubmittedPage.bankAccountName).toHaveText(
      'EA RECEIPTS'
    )
    await expect(ApplicationSubmittedPage.bankCompanyName).toHaveText(
      'Environment Agency'
    )
    // RA-426: the bank payment reference is a regulator-tailored format,
    // no longer the application reference. This is an England Reprocessor
    // journey (see the bank details asserted above), so PR/PK/REP/{orgId}.
    const paymentRef =
      await ApplicationSubmittedPage.bankPaymentReference.getText()
    await expect(paymentRef).toBe(`PR/PK/REP/${organisationId}`)
  })

  // ── RA-374 regression ────────────────────────────────────────────────────
  // The task list's back link is built from the application record via the
  // shared landingUrl() helper. It previously read application.siteId — a
  // field the API layer never populates (registrationId is the real field)
  // — so the reprocessor back link would have rendered "undefined" in the
  // URL and 404'd.

  it('Should navigate back from the task list to the operator-accreditation landing page', async () => {
    await OperatorPage.navigateToOperatorAccreditationPlastic()
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

  // ── RA-431 / RA-459 ───────────────────────────────────────────────────────
  // The "Return to Re/Ex service" link used to have a stub-mode branch
  // (AC2) that fell back to this frontend's own /operator page whenever
  // stub auth or a local env was active. RA-459 removed that branch —
  // /operator is a test-only page now, so the link always points at the
  // real Re/Ex frontend (REEX_FRONTEND_BASE_URL) unconditionally. There's
  // no longer a distinct stub-mode behaviour for this suite (which always
  // runs with stub auth enabled) to exercise, and this env has no real
  // Re/Ex frontend to navigate to and assert against — coverage lives in
  // the frontend's own unit tests (operator-accreditation/controller.test.js).

  // ── RA-487: top nav matches Re-Ex's own ──────────────────────────────────
  // Home and Manage account now both leave this app for Re-Ex/Defra ID
  // (unreachable from this e2e env, and no longer varying per page or
  // application context — see RA-408 history above for what this replaced),
  // so this only confirms the operator top nav renders all three items.

  it('Should show Home, Manage account and Sign out in the operator top nav', async () => {
    await OperatorPage.navigateToOperatorAccreditationPlastic()

    await expect(OperatorAccreditationPage.homeNavLink).toBeDisplayed()
    await expect(OperatorAccreditationPage.homeNavLink).toHaveText('Home')
    await expect(OperatorAccreditationPage.manageAccountNavLink).toBeDisplayed()
    await expect(OperatorAccreditationPage.manageAccountNavLink).toHaveText(
      'Manage account'
    )
    await expect(OperatorAccreditationPage.signOutNavLink).toBeDisplayed()
    await expect(OperatorAccreditationPage.signOutNavLink).toHaveText(
      'Sign out'
    )
  })
})
