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
import QueryTaskListPage from 'page-objects/query-task-list.page'
import QueryDeclarationPage from 'page-objects/query-declaration.page'
import {
  getApplication,
  raiseQuery,
  patchSection
} from '../helpers/case-management.js'

describe('RA-311: Respond to a regulator query and resubmit (FET-5)', () => {
  let organisationId
  let registrationId
  let materialType
  let year
  let applicationId

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

  function landingUrl() {
    return `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
  }

  // Drives the org 50003 (Delta Green Ltd, Plastic) application to Submitted,
  // capturing the ids needed for the query/resubmit journey below. This org
  // isn't used by any other spec (operator-accreditation.e2e.js uses 50001,
  // exporter-accreditation.e2e.js uses 50005/50006), so this journey owns its
  // application independently of other specs' run order.
  async function reachSubmittedApplication() {
    await OperatorPage.navigateToReaccreditationPlastic()

    const landing = await browser.getUrl()
    ;[, organisationId, registrationId, materialType, year] = new URL(
      landing
    ).pathname
      .split('/')
      .filter(Boolean)

    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )
    applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    const application = await getApplication(organisationId, applicationId)
    if (application.applicationStatus === 'Submitted') {
      return
    }

    if (await TaskListPage.PRNTonnageLink.isExisting()) {
      await TaskListPage.PRNTonnageLink.click()
      await PrnTonnagePage.selectRandomOption()
      await PrnTonnagePage.saveAndContinue()
      await PrnAuthorityPage.addAuthoriser()
      await PrnAuthorityPage.saveAndContinue()
      await PrnCheckAnswersPage.confirmAndContinue()
    }

    if (await TaskListPage.businessPlanLink.isExisting()) {
      await TaskListPage.businessPlanLink.click()
      await browser.waitUntil(
        async () =>
          (await browser.getUrl()).includes('/accreditation/business-plan'),
        { timeout: 10000 }
      )
      await BusinessPlanPage.fillPercentages([20, 20, 20, 15, 15, 10])
      await BusinessPlanPage.saveAndContinue()
      await BusinessPlanDetailPage.fillDescriptions()
      await BusinessPlanDetailPage.saveAndContinue()
      await BusinessPlanCheckAnswersPage.confirmAndContinue()
    }

    if (await TaskListPage.SIPlanLink.isExisting()) {
      await TaskListPage.SIPlanLink.click()
      await SamplingPlanPage.uploadFile('business-plan.pdf')
      await SamplingPlanPage.saveAndContinue()
    }

    await TaskListPage.assertAllTasksCompleted()
    await TaskListPage.continueToSubmit()
    await SubmitApplicationPage.submitApplication()
  }

  it('lets an operator respond to a regulator query and resubmit the application', async () => {
    await reachSubmittedApplication()

    // Simulate case-management raising a query against a single section —
    // management-fe is out of scope for this ticket (RA-311 §1), so this
    // calls the operator-backend's inbound endpoint directly.
    const queryNote = 'Please review the business plan spending breakdown.'
    await raiseQuery(organisationId, applicationId, {
      queryNote,
      sectionKeys: ['business-plan']
    })

    // AC01: the landing page reflects the Queried status and its continue
    // button now leads to the query task list, not the classic one
    await browser.url(landingUrl())
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('QUERIED')
    )
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/query-task-list/')
    )

    // AC01: only the queried section is listed, with the query note shown
    await expect(QueryTaskListPage.queryNote).toHaveText(
      expect.stringContaining(queryNote)
    )
    await expect(
      QueryTaskListPage.taskLink('task-business-plan')
    ).toBeDisplayed()
    await expect(await $('[data-testid="task-prns"]').isExisting()).toBe(false)
    await expect(
      await $('[data-testid="task-sampling-plan"]').isExisting()
    ).toBe(false)

    // AC02: the backend gate rejects a non-queried section's PATCH server
    // side — this is the real enforcement, the frontend redirect below is a
    // UX affordance only (RA-311 plan §3)
    const lockedPatch = await patchSection(
      organisationId,
      applicationId,
      'tonnage',
      {}
    )
    expect(lockedPatch.statusCode).toBe(409)

    // AC02: direct navigation to a non-queried section redirects back to the
    // query task list — no side door via a bookmarked/typed URL
    await browser.url(`/accreditation/tonnage/${applicationId}`)
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/query-task-list/')
    )

    // The classic task list isn't reachable while Queried either
    await TaskListPage.open(applicationId)
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/query-task-list/')
    )

    // AC02: the queried section itself remains editable
    await QueryTaskListPage.open(applicationId)
    await QueryTaskListPage.taskLink('task-business-plan').click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/business-plan/')
    )
    await BusinessPlanPage.fillPercentages([25, 25, 20, 10, 10, 10])
    await BusinessPlanPage.saveAndContinue()

    let heading = await $('h1').getText()
    if (heading === "More detail about how you'll spend PRN income") {
      await BusinessPlanDetailPage.fillDescriptions()
      await BusinessPlanDetailPage.saveAndContinue()
      heading = await $('h1').getText()
    }
    if (heading === 'Check your answers before continuing') {
      await BusinessPlanCheckAnswersPage.confirmAndContinue()
    }

    const editedApplication = await getApplication(
      organisationId,
      applicationId
    )
    expect(editedApplication.businessPlan.sectionStatus).not.toBe('Queried')

    // AC03/AC04: query-declaration validates the responder's details
    await QueryDeclarationPage.open(applicationId)
    await QueryDeclarationPage.clickResubmit()
    await expect(QueryDeclarationPage.errorSummary).toBeDisplayed()
    await expect(QueryDeclarationPage.fullNameError).toBeDisplayed()
    await expect(QueryDeclarationPage.emailError).toBeDisplayed()
    await expect(QueryDeclarationPage.roleError).toBeDisplayed()

    await QueryDeclarationPage.submitResubmission({
      role: 'Compliance Officer'
    })

    // AC03: resubmitting shows a one-time success banner on the landing
    // page, and the status moves from Queried to Updated
    await expect(browser).toHaveUrl(expect.stringContaining(landingUrl()))
    await expect($('.govuk-notification-banner')).toHaveText(
      expect.stringContaining(
        'Your application has been resubmitted to the regulator.'
      )
    )
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('UPDATED')
    )

    // AC03: the application is genuinely locked again — the classic task
    // list shows its read-only view, no continue button
    await TaskListPage.open(applicationId)
    await expect($('[data-testid="submitted-text"]')).toBeDisplayed()
    await expect(await $('[data-testid="continue-button"]').isExisting()).toBe(
      false
    )

    // Stale visits to the query routes now redirect away, since the
    // application is no longer Queried
    await QueryTaskListPage.open(applicationId)
    await expect(browser).not.toHaveUrl(
      expect.stringContaining('/query-task-list/')
    )
    await QueryDeclarationPage.open(applicationId)
    await expect(browser).not.toHaveUrl(
      expect.stringContaining('/query-declaration/')
    )
  })
})
