import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import ConfirmOverseasSitesPage from 'page-objects/confirm-overseas-sites.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'
import QueryTaskListPage from 'page-objects/query-task-list.page'
import QueryDeclarationPage from 'page-objects/query-declaration.page'
import { getApplication, raiseQuery } from '../helpers/case-management.js'
import { completePrnBusinessPlanSamplingPlan } from '../helpers/accreditation-journey.js'
import { disposableYear } from '../helpers/accreditation-year.js'

// RA-583: a Case Management query raised against BOTH the overseas
// reprocessing sites (ORS) and broadly-equivalent-standards (BES) sections
// used to leave the BES task showing IN PROGRESS/NOT STARTED after resubmit,
// even though the operator had re-confirmed BES evidence — the backend's
// ComputeCurrentStatus hardcoded BesEvidence to NotStarted rather than
// checking the real evidence state (see epr-register-enrol-backend#188).
//
// Reuses org 50006 (Glass exporter, shared with exporter-accreditation.e2e.js's
// own Glass journey) but drives it against a disposable, run-unique year —
// the same pattern regulator-query-banner.e2e.js uses on org 50003 — so this
// doesn't race that other spec's use of the same org under concurrent wdio
// workers (see operator.page.js's org-50013 comment for the underlying Seed
// race this avoids).
describe('RA-583: BES status after an ORS+BES query resubmission', () => {
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

  async function reachSubmittedExporterApplication() {
    await OperatorPage.navigateToExporterAccreditationGlass()
    const landing = await browser.getUrl()
    ;[, organisationId, registrationId, materialType] = new URL(
      landing
    ).pathname
      .split('/')
      .filter(Boolean)
    year = await disposableYear(
      'ra-583-bes-status-after-resubmit',
      organisationId,
      materialType
    )
    await browser.url(landingUrl())

    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )
    applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    await completePrnBusinessPlanSamplingPlan({ material: 'Glass' })

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

    await TaskListPage.assertAllTasksCompleted({ isExporter: true })
    await TaskListPage.continueToSubmit()
    await SubmitApplicationPage.submitApplication()
  }

  it('shows BES as Completed after resubmit when a query was raised on both ORS and BES', async () => {
    await reachSubmittedExporterApplication()

    // CM raises a query against both ORS and BES together — the exact
    // combination that RA-583's bug required.
    const queryNote = 'Please review the overseas sites and BES evidence.'
    await raiseQuery(organisationId, applicationId, {
      queryNote,
      sectionKeys: [
        'overseas-reprocessing-sites',
        'broadly-equivalent-standards'
      ]
    })

    await QueryTaskListPage.open(applicationId)
    await expect(QueryTaskListPage.taskTag('task-overseas-sites')).toHaveText(
      'QUERIED'
    )
    await expect(QueryTaskListPage.taskTag('task-bes-evidence')).toHaveText(
      'QUERIED'
    )

    // Operator fixes ORS — re-confirms the same accredited sites.
    await QueryTaskListPage.taskLink('task-overseas-sites').click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.continue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/confirm-overseas-sites')
    )
    await ConfirmOverseasSitesPage.confirmAndContinue()

    // Operator confirms BES evidence — already uploaded and Clean, so this
    // just walks back through the evidence list to Continue.
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/query-task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not return to query task list' }
    )
    await QueryTaskListPage.taskLink('task-bes-evidence').click()
    await expect(browser).toHaveUrl(
      expect.stringContaining(
        '/accreditation/upload-evidence-for-overseas-site/'
      )
    )
    await BesEvidencePage.uploadAllEvidence('business-plan.pdf')

    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/query-task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not return to query task list' }
    )
    await QueryTaskListPage.continueToDeclaration()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/query-declaration/')
    )
    await QueryDeclarationPage.submitResubmission({
      role: 'Compliance Officer'
    })

    await expect(browser).toHaveUrl(expect.stringContaining(landingUrl()))

    // RA-583 regression: the task list must show BES as Completed, not
    // NotStarted/InProgress, once the resubmit's status recompute has run.
    await TaskListPage.open(applicationId)
    await expect(TaskListPage.besStatus).toHaveText('COMPLETED')
    await expect(TaskListPage.overseasSitesStatus).toHaveText('COMPLETED')

    const resubmittedApplication = await getApplication(
      organisationId,
      applicationId
    )
    expect(resubmittedApplication.besEvidence.sectionStatus).toBe('Completed')
    expect(resubmittedApplication.overseasSites.sectionStatus).toBe('Completed')
  })
})
