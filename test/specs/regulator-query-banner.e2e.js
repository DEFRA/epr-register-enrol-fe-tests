import { browser, expect, $ } from '@wdio/globals'
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
import { raiseQuery } from '../helpers/case-management.js'
import { regulatorQueryDisabledFrontendUrl } from '../config.js'

// Reachability is checked directly against the container's own healthcheck
// endpoint (see compose.yml), not by swallowing errors from the actual
// login/navigation flow - that would let a genuine infra hiccup in this
// suite's own sandbox skip the test instead of failing it.
async function isRegulatorQueryDisabledFrontendReachable() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(
      `${regulatorQueryDisabledFrontendUrl}/health`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)
    return response.ok
  } catch {
    return false
  }
}

describe('RA-439: REGULATOR_QUERY_TEXT_DISABLED kill switch for the regulator-query banner', () => {
  let organisationId
  let registrationId
  let materialType
  let year
  let applicationId
  const queryNote = 'Please review the business plan spending breakdown.'

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

  // Drives a fresh, run-unique reaccreditation application (org 50003 -
  // Delta Green Ltd, Plastic) to Submitted and raises a query against its
  // business plan section. Uses a disposable year, the same seed-on-miss
  // pattern as status-push.e2e.js and withdraw-application.e2e.js, so this
  // doesn't collide with query-resubmit.e2e.js's fixed-year application on
  // the same org.
  async function reachQueriedApplication() {
    await OperatorPage.navigateToReaccreditationPlastic()
    const landing = await browser.getUrl()
    ;[, organisationId, registrationId, materialType] = new URL(
      landing
    ).pathname
      .split('/')
      .filter(Boolean)
    year = String(3000 + (Date.now() % 1000))
    await browser.url(
      `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
    )

    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )
    applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    await TaskListPage.PRNTonnageLink.click()
    await PrnTonnagePage.selectRandomOption()
    await PrnTonnagePage.saveAndContinue()
    await PrnAuthorityPage.addAuthoriser()
    await PrnAuthorityPage.saveAndContinue()
    await PrnCheckAnswersPage.confirmAndContinue()

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

    await TaskListPage.SIPlanLink.click()
    await SamplingPlanPage.uploadFile('business-plan.pdf')
    await SamplingPlanPage.saveAndContinue()

    await TaskListPage.assertAllTasksCompleted({ isExporter: false })
    await TaskListPage.continueToSubmit()
    await SubmitApplicationPage.submitApplication()

    await raiseQuery(organisationId, applicationId, {
      queryNote,
      sectionKeys: ['business-plan']
    })
  }

  it('shows the regulator query banner when REGULATOR_QUERY_TEXT_DISABLED is unset (regression)', async () => {
    await reachQueriedApplication()

    await QueryTaskListPage.open(applicationId)
    await expect(QueryTaskListPage.queryNote).toBeDisplayed()
    await expect(QueryTaskListPage.queryNote).toHaveText(
      expect.stringContaining(queryNote)
    )
  })

  // Proves the flag actually hides the banner end to end, not just in the
  // frontend's own unit tests - see compose.yml for why this needs a
  // dedicated second frontend container rather than restarting the primary
  // one. That container only resolves inside this repo's own docker-compose
  // sandbox, so this test skips itself rather than failing when it isn't
  // reachable - e.g. when running against a real CDP environment, where the
  // deployed frontend's flag value is controlled by that environment's own
  // config, not by this suite. Beyond that reachability check, nothing else
  // is caught here - a failure past this point is a real test failure.
  it('hides the regulator query banner when REGULATOR_QUERY_TEXT_DISABLED is true', async function () {
    await reachQueriedApplication()

    if (!(await isRegulatorQueryDisabledFrontendReachable())) {
      return this.skip()
    }

    await browser.url(
      `${regulatorQueryDisabledFrontendUrl}/auth/stub/login?type=operator`
    )
    await $('input[type="radio"]').waitForExist({ timeout: 8000 })

    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      document.querySelector('input[type="radio"]').click()
    })
    const submitBtn = await $('button.govuk-button')
    await submitBtn.waitForClickable()
    await submitBtn.click()
    await browser.waitUntil(
      async () => !(await browser.getUrl()).includes('/stub/login'),
      { timeout: 15000, timeoutMsg: 'Stub login did not redirect after login' }
    )

    // The application landing page is what registers the org against this
    // fresh session - jumping straight to an accreditation sub-route on a
    // session that has never visited the org redirects back to /operator.
    await browser.url(
      `${regulatorQueryDisabledFrontendUrl}/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
    )
    await browser.url(
      `${regulatorQueryDisabledFrontendUrl}/accreditation/query-task-list/${applicationId}`
    )
    await expect(QueryTaskListPage.pageHeading).toBeDisplayed()
    await expect(await QueryTaskListPage.queryNote.isExisting()).toBe(false)

    // Display-only: hiding the banner doesn't touch which sections are
    // still open for the query response.
    await expect(
      QueryTaskListPage.taskLink('task-business-plan')
    ).toBeDisplayed()

    // The second frontend has its own cookie jar (different host), so
    // afterEach's LoginPage.signOut() would sign out of the wrong instance -
    // sign out of this one directly.
    await browser.url(`${regulatorQueryDisabledFrontendUrl}/auth/logout`)
  })
})
