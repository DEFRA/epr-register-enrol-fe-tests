import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'

import { clearApplications, workItemsFor } from './monorepo.js'
import { completeStubOverseasSites } from './monorepo-overseas-sites.js'
import { confirmOverseasSites } from './query-response-journey.js'
import { reportDetails } from './report-step.js'
import {
  completeOutstandingTasks,
  submitAndAssertConfirmation
} from './reex-reaccreditation.js'
import { accreditationYear } from '../config.js'

/** Signs in through the stub as the operator. */
export async function signInAsOperator() {
  await LoginPage.openOperatorLogin()
  await LoginPage.loginAsOperator()
}

/**
 * Clears the organisation's application and work items, so the run always
 * starts from NOT STARTED, then signs in through the stub as the operator.
 *
 * @param {...{ organisationId: string, registrationId: string }} orgs
 */
export async function startFresh(...orgs) {
  for (const org of orgs) {
    const cleared = clearApplications(org)
    reportDetails(`Cleared organisation ${org.organisationId}`, cleared)
  }

  await browser.deleteCookies()
  await signInAsOperator()
}

/**
 * Opens the organisation's accreditation landing page.
 *
 * @param {{ organisationId: string, registrationId: string, material: string }} org
 * @returns {Promise<string>} the application status it shows, e.g. QUERIED
 */
export async function openAccreditation(org) {
  await browser.url(
    `/operator-accreditation/${org.organisationId}/${org.registrationId}/${org.material}/${accreditationYear}`
  )
  await OperatorAccreditationPage.applicationStatus.waitForDisplayed({
    timeout: 30000
  })
  return OperatorAccreditationPage.applicationStatus.getText()
}

/**
 * Opens the organisation's accreditation page, completes every task, submits,
 * and checks the confirmation page and the case management work item the
 * submission raised.
 *
 * @param {object}  options
 * @param {{ organisationId: string, registrationId: string, material: string }} options.org
 * @param {boolean} options.isExporter
 * @returns {Promise<string>} the application reference
 */
export async function submitAccreditation({ org, isExporter }) {
  expect(await openAccreditation(org)).toBe('NOT STARTED')

  await OperatorAccreditationPage.clickContinue()
  await browser.waitUntil(
    async () => (await browser.getUrl()).includes('/accreditation/task-list/'),
    { timeout: 30000, timeoutMsg: 'Did not reach the task list' }
  )

  const journeyMaterial = isExporter
    ? await completeExporterTasks()
    : await completeOutstandingTasks({ isExporter: false })
  await TaskListPage.assertAllTasksCompleted({ isExporter })
  await TaskListPage.continueToSubmit()

  const reference = await submitAndAssertConfirmation(journeyMaterial)

  // The monorepo runs the real case management backend, not the sandbox's
  // stub, so the submission must have raised a work item there.
  await browser.waitUntil(
    async () =>
      workItemsFor(org).some((item) => item.applicationReference === reference),
    {
      timeout: 30000,
      // Each check is a docker exec, so not every 250ms.
      interval: 2000,
      timeoutMsg: `No case management work item for application ${reference}`
    }
  )

  reportDetails('Submitted', { reference, workItems: workItemsFor(org) })
  return reference
}

/**
 * Exporter tasks: the shared ones first, as the overseas sites task only
 * opens once they are done. Then the stub overseas sites, which need filling
 * in before they can be confirmed (monorepo-overseas-sites.js), and last the
 * BES evidence. Leaves the browser on the task list.
 *
 * @returns {Promise<string>} the material, as the journey names it
 */
async function completeExporterTasks() {
  const material = await completeOutstandingTasks({ isExporter: false })
  const applicationId = (await browser.getUrl())
    .split('/accreditation/task-list/')[1]
    .split(/[/?]/)[0]

  await completeStubOverseasSites(applicationId)
  await confirmOverseasSites()
  await expect(TaskListPage.overseasSitesStatus).toHaveText('COMPLETED')

  // What is left: BES evidence.
  await completeOutstandingTasks({ isExporter: true })
  return material
}
