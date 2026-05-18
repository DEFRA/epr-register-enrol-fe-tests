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

describe('RA-102: Operator Accreditation Landing Page', () => {
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
  it('Should complete the full accreditation journey for Plastic - PRN and business plan', async () => {
    const heading = await OperatorAccreditationPage.pageHeading.getText()
    await expect(heading).toEqual('Operator Testing Flows Landing Page')
    await OperatorPage.navigateToOperatorAccreditationPlastic()
    await OperatorAccreditationPage.clickContinue()
    // await expect(browser).toHaveUrl(expect.stringContaining('/accreditation/task-list/app001'))

    // PRN tonnage
    await TaskListPage.PRNTonnageLink.click()
    // await expect(browser).toHaveUrl(expect.stringContaining('/accreditation/prns-tonnage'))
    const selectedTonnage = await PrnTonnagePage.selectRandomOption()
    await PrnTonnagePage.saveAndContinue()

    await PrnAuthorityPage.addAuthoriser()
    await PrnAuthorityPage.saveAndContinue()

    // Check your answers — assert the selected tonnage is shown
    await expect(PrnCheckAnswersPage.pageHeading).toHaveText(
      'Check your answers before continuing'
    )
    const displayedTonnage = await PrnCheckAnswersPage.tonnageValue.getText()
    await expect(displayedTonnage).toEqual(selectedTonnage)
    await PrnCheckAnswersPage.confirmAndContinue()

    // Back to task list
    // await expect(browser).toHaveUrl(expect.stringContaining('/accreditation/task-list/app001'))

    // Business plan — 6 fields, values must total 100%
    await TaskListPage.businessPlanLink.click()
    await BusinessPlanPage.fillPercentages([20, 20, 20, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    // More detail about how you'll spend PRN income (all optional)
    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "More detail about how you'll spend PRN income"
    )
    await BusinessPlanDetailPage.saveAndContinue()

    // Check answers for business plan
    await BusinessPlanCheckAnswersPage.confirmAndContinue()

    // Sampling and inspection plan — upload file
    await TaskListPage.SIPlanLink.click()
    await expect(SamplingPlanPage.pageHeading).toHaveText(
      'Upload accreditation sampling and inspection plan'
    )
    await SamplingPlanPage.uploadFile('business-plan.pdf')
    await SamplingPlanPage.saveAndContinue()

    // Task list — all tasks completed, click Continue
    await TaskListPage.assertAllTasksCompleted()
    await TaskListPage.continueToSubmit()

    // Submit application — declaration
    await expect(SubmitApplicationPage.pageHeading).toHaveText(
      'Submit accreditation application'
    )
    await SubmitApplicationPage.submitApplication('Test User', 'Test Manager')

    // Confirmation screen
    await expect(ApplicationSubmittedPage.panelTitle).toHaveText(
      'Application submitted'
    )
    const ref = await ApplicationSubmittedPage.referenceNumber.getText()
    await expect(ref).toContain('A27')
  })
})
