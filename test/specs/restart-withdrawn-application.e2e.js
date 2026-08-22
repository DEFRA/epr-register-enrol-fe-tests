import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import WithdrawApplicationPage from 'page-objects/withdraw-application.page'
import ErrorPage from 'page-objects/error.page'
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
import { listApplicationsForYear } from '../helpers/case-management.js'

const WITHDRAWAL_REASON = 'Submitted the wrong tonnage band'

describe('RA-357: Start a new application after withdrawing one', () => {
  let organisationId
  let registrationId
  let materialType
  let year
  let withdrawnApplicationId

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

  function applicationsForYear(forYear = year) {
    return listApplicationsForYear(organisationId, {
      registrationId,
      materialType,
      year: forYear
    })
  }

  // Org 50012 ("Withdrawn Application Test Co", Plastic) exists for exactly
  // this kind of journey and is driven by no other spec — 50001 belongs to
  // operator-accreditation.e2e.js, 50002 to withdraw-application.e2e.js, 50003
  // to query-resubmit.e2e.js and 50005/50006 to exporter-accreditation.e2e.js —
  // so this journey owns the applications it creates and permanently withdraws.
  //
  // As in withdraw-application.e2e.js, the year is deliberately not the static
  // 2027 from the /operator link. Mongo persists between runs (compose.yml's
  // named `mongodb-data` volume) and withdrawal is terminal, so a fixed year
  // would find last run's records and assert against the wrong ones. A fresh,
  // run-unique year sends the landing controller down its seed-on-miss path
  // every time. The 4000 band keeps it clear of the 3000 band
  // withdraw-application.e2e.js uses, so the two specs can never collide on a
  // year even when their millisecond offsets happen to agree.
  async function reachWithdrawnApplication() {
    await OperatorPage.navigateToWithdrawnApplicationTestOrg()

    const landing = await browser.getUrl()
    ;[, organisationId, registrationId, materialType] = new URL(
      landing
    ).pathname
      .split('/')
      .filter(Boolean)
    year = String(4000 + (Date.now() % 1000))
    await browser.url(landingUrl())

    // Only Submitted/Queried/Updated applications can be withdrawn, and a
    // freshly seeded one is a draft, so drive the real task-list journey to
    // reach a genuinely withdrawable state.
    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )

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

    await TaskListPage.businessPlanLink.click()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/business-plan'),
      { timeout: 10000, timeoutMsg: 'Did not reach business plan page' }
    )
    await BusinessPlanPage.fillPercentages([15, 15, 15, 15, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "Add more details about how you'll spend the PRN income"
    )
    await BusinessPlanDetailPage.fillDescriptions()
    await BusinessPlanDetailPage.saveAndContinue()

    await BusinessPlanCheckAnswersPage.confirmAndContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list')
    )

    await TaskListPage.SIPlanLink.click()
    await SamplingPlanPage.uploadFile('business-plan.pdf')
    await SamplingPlanPage.saveAndContinue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list')
    )
    await TaskListPage.assertAllTasksCompleted({ isExporter: false })
    await TaskListPage.continueToSubmit()

    await expect(SubmitApplicationPage.pageHeading).toHaveText('Declaration')
    await SubmitApplicationPage.submitApplication()

    await expect(ApplicationSubmittedPage.panelTitle).toHaveText(
      'Now pay the application charge'
    )

    await browser.url(landingUrl())
    await expect(OperatorAccreditationPage.withdrawLink).toBeDisplayed()
    await OperatorAccreditationPage.withdrawLink.click()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes(
          '/accreditation/withdraw-application/'
        ),
      { timeout: 10000, timeoutMsg: 'Did not reach withdraw-application page' }
    )
    withdrawnApplicationId = (await browser.getUrl())
      .split('/accreditation/withdraw-application/')[1]
      .split('?')[0]

    await WithdrawApplicationPage.withdrawWithReason(WITHDRAWAL_REASON)
    await expect(browser).toHaveUrl(expect.stringContaining(landingUrl()))
  }

  it('lets an operator restart a withdrawn application in the same accreditation year, keeping the withdrawn record', async () => {
    await reachWithdrawnApplication()

    // ── The withdrawn landing view ─────────────────────────────────────────
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('WITHDRAWN')
    )
    // The withdrawn-view controls below (continue/withdraw hidden, start-new
    // shown) all come from the same server render as the status tag above,
    // but isExisting() is a single unretried DOM query — unlike toHaveText
    // and toBeDisplayed, it doesn't wait for a still-settling page. Anchor on
    // the start-new form's existence first so every check that follows runs
    // against a page that has definitely finished rendering the withdrawn
    // view, rather than risking an intermittent race on whichever check
    // happens to run before the browser has caught up.
    await OperatorAccreditationPage.startNewForm.waitForExist()

    expect(await OperatorAccreditationPage.firstContinueLink.isExisting()).toBe(
      false
    )
    expect(await OperatorAccreditationPage.withdrawLink.isExisting()).toBe(
      false
    )
    await expect(OperatorAccreditationPage.startNewLink).toBeDisplayed()
    await expect(OperatorAccreditationPage.startNewForm).toBeDisplayed()

    // The defect itself: restarting used to target accreditationYear + 1, a
    // year with no approved accreditation behind it, so the seed always failed.
    // The control must point at the SAME year.
    const startNewAction = await OperatorAccreditationPage.startNewFormAction()
    expect(startNewAction).toContain(
      `/${registrationId}/${materialType}/${year}/start-new`
    )
    expect(startNewAction).not.toContain(`/${Number(year) + 1}/`)

    // ── Viewing a withdrawn application must not create anything ───────────
    // The restart is a POST precisely so that landing-page GETs stay
    // idempotent. Re-visiting the withdrawn year must leave it withdrawn.
    const beforeRestart = await applicationsForYear()
    expect(beforeRestart).toHaveLength(1)
    expect(beforeRestart[0].applicationId).toBe(withdrawnApplicationId)

    await browser.url(landingUrl())
    await browser.url(landingUrl())
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('WITHDRAWN')
    )
    const afterReloads = await applicationsForYear()
    expect(afterReloads).toHaveLength(1)
    expect(afterReloads[0].applicationId).toBe(withdrawnApplicationId)
    expect(afterReloads[0].applicationStatus).toBe('Withdrawn')

    // A bookmarked or replayed restart URL must not create one either — the
    // route exists for POST only, so a GET is a 404 rather than a silent seed.
    await browser.url(`${landingUrl()}/start-new`)
    await expect(ErrorPage.statusCode).toHaveText('404')
    await expect(ErrorPage.message).toHaveText('Page not found')
    expect(await applicationsForYear()).toHaveLength(1)

    // ── Restarting ────────────────────────────────────────────────────────
    await browser.url(landingUrl())
    await OperatorAccreditationPage.clickStartNew()
    await browser.waitUntil(
      async () => new URL(await browser.getUrl()).pathname === landingUrl(),
      {
        timeout: 10000,
        timeoutMsg: 'Start new did not redirect to the clean landing URL'
      }
    )

    // RA-357's headline symptom. Asserted explicitly so a re-break fails with
    // the offending copy rather than as a downstream selector timeout.
    expect(await OperatorAccreditationPage.seedErrorMessage()).toBe(null)
    await expect(OperatorAccreditationPage.pageHeading).toHaveText(
      'Reapply for accreditation'
    )

    // The landing page now shows a live application for the SAME year.
    await expect(OperatorAccreditationPage.applicationPeriod).toHaveText(year)
    const restartedStatus =
      await OperatorAccreditationPage.applicationStatus.getText()
    expect(restartedStatus).not.toContain('WITHDRAWN')
    await expect(OperatorAccreditationPage.firstContinueLink).toBeDisplayed()

    // ── The withdrawn record survives, and the new one is a different one ──
    const afterRestart = await applicationsForYear()
    expect(afterRestart).toHaveLength(2)

    const withdrawn = afterRestart.find(
      (application) => application.applicationId === withdrawnApplicationId
    )
    expect(withdrawn).toBeDefined()
    expect(withdrawn.applicationStatus).toBe('Withdrawn')
    // Retained for audit, not mutated or recycled.
    expect(withdrawn.withdrawalReason).toBe(WITHDRAWAL_REASON)

    const live = afterRestart.filter(
      (application) => application.applicationStatus !== 'Withdrawn'
    )
    expect(live).toHaveLength(1)
    expect(live[0].applicationId).not.toBe(withdrawnApplicationId)
    expect(live[0].year).toBe(Number(year))

    // Continuing from the landing page must pick up the new application, not
    // the withdrawn one.
    await expect(OperatorAccreditationPage.firstContinueLink).toHaveAttribute(
      'href',
      `/accreditation/task-list/${live[0].applicationId}`
    )

    // Nothing was created against the following year, which is where the old
    // restart link pointed.
    expect(await applicationsForYear(Number(year) + 1)).toHaveLength(0)
  })
})
