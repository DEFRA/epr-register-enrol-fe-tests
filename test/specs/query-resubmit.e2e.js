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
  waitForCaseManagementWorkItemId,
  raiseQuery,
  patchSection
} from '../helpers/case-management.js'
import {
  expectedMaterialDisplay,
  expectedSiteName
} from '../helpers/applicationHeader.js'

// RA-309 AC03: the persistent header must survive every redirect hop of the
// queried/resubmit journey, not just the classic task-list path.
async function assertApplicationHeader(page, application) {
  await expect(page.applicationHeader).toBeDisplayed()
  await expect(page.applicationHeaderOperatorName).toHaveText(
    application.organisationName
  )
  await expect(page.applicationHeaderMaterialType).toHaveText(
    expectedMaterialDisplay(application)
  )
  await expect(page.applicationHeaderSiteName).toHaveText(
    expectedSiteName(application)
  )
}

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
      if (application.caseManagementWorkItemId) {
        return
      }
      // Stub data seeds this application as Submitted without going through
      // the real CM integration flow, so caseManagementWorkItemId is null.
      // Navigate to a fresh run-unique year to get a real submission.
      year = String(4000 + (Date.now() % 1000))
      await browser.url(landingUrl())
      await OperatorAccreditationPage.clickContinue()
      await browser.waitUntil(
        async () =>
          (await browser.getUrl()).includes('/accreditation/task-list/'),
        { timeout: 10000, timeoutMsg: 'Did not reach task list for fresh year' }
      )
      applicationId = (await browser.getUrl())
        .split('/accreditation/task-list/')[1]
        .split('?')[0]
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

    await waitForCaseManagementWorkItemId(organisationId, applicationId)
  }

  it('lets an operator respond to a regulator query and resubmit the application', async () => {
    await reachSubmittedApplication()

    // CM BE's idempotent-submit fix (RA-311) keys off operatorApplicationId —
    // this is the E2E-level analogue of its unit tests, proving a normal
    // single submit still results in exactly one case-management work item.
    const submittedApplication = await getApplication(
      organisationId,
      applicationId
    )
    expect(submittedApplication.caseManagementWorkItemId).toBeTruthy()

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
    await assertApplicationHeader(
      OperatorAccreditationPage,
      submittedApplication
    )
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/query-task-list/')
    )

    // AC01: the query note is shown, and every section is now listed
    // (RA-415) - the queried section remains a fully editable link.
    // Completed/Submitted sections (RA-415 follow-up) are also clickable
    // links rather than locked text - they open a read-only view of the
    // already-answered section - instead of being hidden entirely.
    await expect(QueryTaskListPage.queryNote).toHaveText(
      expect.stringContaining(queryNote)
    )
    await assertApplicationHeader(QueryTaskListPage, submittedApplication)
    await expect(
      QueryTaskListPage.taskLink('task-business-plan')
    ).toBeDisplayed()
    await expect(await $('[data-testid="task-prns"]').isExisting()).toBe(true)
    await expect(QueryTaskListPage.taskLink('task-prns')).toBeDisplayed()
    await expect(await $('[data-testid="task-prns-label"]').isExisting()).toBe(
      false
    )
    await expect(
      await $('[data-testid="task-sampling-plan"]').isExisting()
    ).toBe(true)
    await expect(
      QueryTaskListPage.taskLink('task-sampling-plan')
    ).toBeDisplayed()
    await expect(
      await $('[data-testid="task-sampling-plan-label"]').isExisting()
    ).toBe(false)

    // AC02: the backend gate rejects a non-queried section's PATCH server
    // side — this is the real enforcement, the frontend read-only view below
    // is a UX affordance only (RA-311 plan §3)
    const lockedPatch = await patchSection(
      organisationId,
      applicationId,
      'tonnage',
      {}
    )
    expect(lockedPatch.statusCode).toBe(409)
    // Pin down *why* it's a 409 — the endpoint returns 409 from several
    // different gates (application-status checks, other section checks), so
    // the status code alone doesn't prove the section-editability gate is
    // what actually fired.
    expect(lockedPatch.text).toEqual(
      expect.stringContaining('section is not editable')
    )

    // AC02: direct navigation to prns/tonnage — Completed, not the queried
    // section — no longer redirects (RA-415 follow-up, matching the query
    // task list's own task-prns-link above): it's already-answered data,
    // safe to open read-only, so it renders in place with no way to edit
    // rather than bouncing back to the query task list.
    await browser.url(`/accreditation/tonnage/${applicationId}`)
    await expect(browser).toHaveUrl(
      expect.stringContaining(`/accreditation/tonnage/${applicationId}`)
    )
    await expect(await $('[data-testid="read-only-notice"]').isExisting()).toBe(
      true
    )
    await expect(await $('[data-testid="continue-button"]').isExisting()).toBe(
      false
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
    await assertApplicationHeader(BusinessPlanPage, submittedApplication)
    await BusinessPlanPage.fillPercentages([25, 25, 20, 10, 10, 10])
    await BusinessPlanPage.saveAndContinue()

    let heading = await $('h1').getText()
    if (heading === "Add more details about how you'll spend the PRN income") {
      await BusinessPlanDetailPage.fillDescriptions()
      await BusinessPlanDetailPage.saveAndContinue()
      heading = await $('h1').getText()
    }
    if (heading === 'Check your answers before continuing') {
      await BusinessPlanCheckAnswersPage.confirmAndContinue()
    }

    // Completing the queried section redirects back through the classic
    // task list, which itself redirects to query-task-list while Queried —
    // follow that chain via the real "Continue to resubmit" button rather
    // than jumping straight to query-declaration by URL, so the button's
    // continueUrl is proven to actually point at query-declaration.
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/query-task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not return to query task list' }
    )
    await QueryTaskListPage.continueToDeclaration()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/query-declaration/')
    )
    await assertApplicationHeader(QueryDeclarationPage, submittedApplication)

    // AC03/AC04: query-declaration validates the responder's details —
    // required-field errors, keyed to the actual field, with the real
    // copy (not just "some error element exists")
    await QueryDeclarationPage.clickResubmit()
    await expect(QueryDeclarationPage.errorSummary).toBeDisplayed()
    await expect(QueryDeclarationPage.fullNameError).toHaveText(
      expect.stringContaining('Enter your full name')
    )
    await expect(QueryDeclarationPage.emailError).toHaveText(
      expect.stringContaining('Enter your email address')
    )
    await expect(QueryDeclarationPage.roleError).toHaveText(
      expect.stringContaining('Enter your job title')
    )

    // AC03/AC04: email format is validated too, distinctly from "required" —
    // a malformed address must surface the format-specific message and must
    // not trip the other two fields' errors
    await QueryDeclarationPage.submitResubmission({
      fullName: 'Test Person',
      email: 'not-an-email',
      role: 'Compliance Officer'
    })
    await expect(QueryDeclarationPage.errorSummary).toBeDisplayed()
    await expect(QueryDeclarationPage.emailError).toHaveText(
      expect.stringContaining('Enter an email address in the correct format')
    )
    await expect(await QueryDeclarationPage.fullNameError.isExisting()).toBe(
      false
    )
    await expect(await QueryDeclarationPage.roleError.isExisting()).toBe(false)

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
    await assertApplicationHeader(
      OperatorAccreditationPage,
      submittedApplication
    )

    // The queried section's status only resolves off `Queried` once Resubmit
    // runs its own resolution loop, not on the earlier section save above —
    // so this check has to happen after resubmit, not before it.
    const resubmittedApplication = await getApplication(
      organisationId,
      applicationId
    )
    expect(resubmittedApplication.businessPlan.sectionStatus).not.toBe(
      'Queried'
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

    // Fix 4 (RA-311): tonnage and tonnage-authority gained the same
    // queryNote banner guard as every other queried section, but it had no
    // black-box coverage. Raise a second query — CM allows this from
    // 'Updated', the status this application is now in — against prn-tonnage
    // (the CM key both PRN pages share) and confirm the shared banner
    // renders on both.
    const tonnageQueryNote = 'Please confirm the planned tonnage band.'
    await raiseQuery(organisationId, applicationId, {
      queryNote: tonnageQueryNote,
      sectionKeys: ['prn-tonnage']
    })

    await PrnTonnagePage.open(applicationId)
    await expect(PrnTonnagePage.queryNote).toHaveText(
      expect.stringContaining(tonnageQueryNote)
    )

    await PrnAuthorityPage.open(applicationId)
    await expect(PrnAuthorityPage.queryNote).toHaveText(
      expect.stringContaining(tonnageQueryNote)
    )
  })
})
