import { browser, expect } from '@wdio/globals'
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
import { disposableYear } from './disposable-year.js'

const TASK_LIST_PATH = '/accreditation/task-list/'

/**
 * From a material's landing page (the operator just followed its link), opens
 * that material's application for `year` and returns once on its task list.
 * The landing page seeds a fresh application on a year it has not seen.
 *
 * @param {string} year
 * @returns {Promise<{organisationId: string, registrationId: string, materialType: string, applicationId: string}>}
 */
async function openApplicationForYear(year) {
  const [, organisationId, registrationId, materialType] = new URL(
    await browser.getUrl()
  ).pathname
    .split('/')
    .filter(Boolean)
  await browser.url(
    `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
  )

  await OperatorAccreditationPage.clickContinue()
  await browser.waitUntil(
    async () => (await browser.getUrl()).includes(TASK_LIST_PATH),
    { timeout: 10000, timeoutMsg: 'Did not reach task list' }
  )
  const applicationId = (await browser.getUrl())
    .split(TASK_LIST_PATH)[1]
    .split('?')[0]
  return { organisationId, registrationId, materialType, applicationId }
}

/**
 * From the operator landing page, opens the Glass exporter application for a
 * run-unique disposable year (so it cannot race other specs that use org 50006)
 * and returns once on its task list.
 *
 * @returns {Promise<{organisationId: string, registrationId: string, applicationId: string}>}
 */
export async function startDisposableGlassExporterApplication() {
  await OperatorPage.navigateToExporterAccreditationGlass()
  const { organisationId, registrationId, applicationId } =
    await openApplicationForYear(disposableYear())
  return { organisationId, registrationId, applicationId }
}

/**
 * From a material's landing page (the operator just followed its link), drives
 * that material's application for `year` through the PRN tonnage, business
 * plan and sampling plan tasks and submits it, which creates its case
 * management work item. Only for an application whose task list is those three
 * tasks: any other task left open fails assertAllTasksCompleted.
 *
 * Pass a year no other spec uses on the same organisation, registration and
 * material (a disposableYear()), or the specs share one application.
 *
 * @param {string} year
 * @returns {Promise<{organisationId: string, registrationId: string, materialType: string, applicationId: string}>}
 */
export async function submitApplicationForYear(year) {
  const application = await openApplicationForYear(year)

  await completePrnBusinessPlanSamplingPlan({
    assert: false,
    skipCompletedTasks: true
  })
  await TaskListPage.assertAllTasksCompleted()
  await TaskListPage.continueToSubmit()
  await SubmitApplicationPage.submitApplication()

  // Confirms the submit POST actually landed server-side (and with it, CM
  // work-item creation) before returning, so a caller cannot race ahead of
  // the backend and find caseManagementWorkItemId still unset. Generous
  // timeout: this is the tail of a long multi-section journey and the submit
  // to confirmation render is the slowest hop under a loaded parallel grid.
  await ApplicationSubmittedPage.panelTitle.waitForDisplayed({
    timeout: 30000,
    timeoutMsg: 'Application submitted confirmation panel did not appear'
  })

  return application
}

// RA-424: the four PRN tonnage bands, in display order, as they must now read.
const EXPECTED_TONNAGE_LABELS = [
  'Up to 500 tonnes',
  'Up to 5,000 tonnes',
  'Up to 10,000 tonnes',
  'More than 10,000 tonnes'
]

const DEFAULT_BUSINESS_PLAN_PERCENTAGES = [15, 15, 15, 15, 15, 15, 10]

export async function assertTonnageBandLabels() {
  const labels = await PrnTonnagePage.radioLabels
  await labels[0].waitForDisplayed()
  const labelText = await Promise.all(
    [...labels].map((label) => label.getText())
  )
  expect(labelText).toEqual(EXPECTED_TONNAGE_LABELS)
}

// Completes the PRN tonnage task (tonnage band -> authoriser -> check answers)
// starting from the task list, and returns to the task list.
//
// Tolerates landing straight on check-your-answers, which happens when a prior
// spec in the same worker already selected a band for this application.
async function completePrnTonnage({ assert }) {
  await TaskListPage.PRNTonnageLink.click()

  const headingText = await $('h1')
    .getText()
    .catch(() => '')

  if (headingText === 'Check your answers before you continue') {
    await PrnCheckAnswersPage.confirmAndContinue()
    return
  }

  if (assert) {
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/tonnage')
    )
    await assertTonnageBandLabels()
  }
  await PrnTonnagePage.selectRandomOption()
  await PrnTonnagePage.saveAndContinue()

  if (assert) {
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/tonnage-authority')
    )
  }
  await PrnAuthorityPage.addAuthoriser()
  await PrnAuthorityPage.saveAndContinue()

  if (assert) {
    await expect(PrnCheckAnswersPage.pageHeading).toHaveText(
      'Check your answers before you continue'
    )
  }
  await PrnCheckAnswersPage.confirmAndContinue()
}

// Completes the business plan task (percentages -> detail -> check answers)
// starting from the task list, and returns to the task list.
async function completeBusinessPlan({ assert }) {
  await TaskListPage.businessPlanLink.click()

  if (assert) {
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/business-plan')
    )
  } else {
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/business-plan'),
      { timeout: 10000, timeoutMsg: 'Did not reach business plan' }
    )
  }

  await BusinessPlanPage.fillPercentages(DEFAULT_BUSINESS_PLAN_PERCENTAGES)
  await BusinessPlanPage.saveAndContinue()

  if (assert) {
    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "Add more details about how you'll spend the PERN income"
    )
  }
  await BusinessPlanDetailPage.fillDescriptions()
  await BusinessPlanDetailPage.saveAndContinue()

  await BusinessPlanCheckAnswersPage.confirmAndContinue()
}

// Completes the sampling and inspection plan task starting from the task list,
// and returns to the task list. `material` is only used for the page-heading
// assertion, so callers that can't predict it should pass assert: false.
async function completeSamplingPlan({ assert, material, baseName }) {
  await TaskListPage.SIPlanLink.click()

  if (assert) {
    await expect(SamplingPlanPage.pageHeading).toHaveText(
      `Upload sampling and inspection plan - part 2 - ${material}`
    )
  }
  await SamplingPlanPage.uploadFile('business-plan.pdf', 'SamplingPlan', {
    baseName
  })
  await SamplingPlanPage.saveAndContinue()
}

/**
 * Drives an accreditation application through the PRN tonnage, business plan
 * and sampling-and-inspection-plan tasks, starting and ending on the task list.
 *
 * Extracted because this walk had reached four copies across two spec files
 * (RA-481 review). Three sat in exporter-accreditation.e2e.js and one in
 * ra-481-section-lock.e2e.js; the same wording or step change had to be applied
 * to each by hand, which is how they drifted apart in the first place.
 *
 * @param {object}  [options]
 * @param {string}  [options.material='Plastic']
 *   Material name expected in the sampling-plan page heading. Ignored when
 *   `assert` is false.
 * @param {boolean} [options.assert=true]
 *   Assert page headings and URLs along the way. Pass false to walk the journey
 *   purely as fixture setup, for callers whose application state or material is
 *   not predictable enough to assert on.
 * @param {string}  [options.samplingPlanBaseName]
 *   Upload the sampling plan under this base name instead of the fixture's own
 *   (RA-619: a name with characters outside Latin-1). The plan page then asserts
 *   the name is listed exactly as given.
 * @param {boolean} [options.skipCompletedTasks=false]
 *   Skip any of the three tasks whose task-list link is absent, which is how a
 *   completed task presents. Needed by callers that may run against an
 *   application a previous test already advanced.
 */
export async function completePrnBusinessPlanSamplingPlan({
  material = 'Plastic',
  assert = true,
  skipCompletedTasks = false,
  samplingPlanBaseName
} = {}) {
  const shouldRun = async (link) =>
    !skipCompletedTasks || (await link.isExisting())

  if (await shouldRun(TaskListPage.PRNTonnageLink)) {
    await completePrnTonnage({ assert })
  }

  if (assert) {
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
  }

  if (await shouldRun(TaskListPage.businessPlanLink)) {
    await completeBusinessPlan({ assert })
  }

  if (assert) {
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
  }

  if (await shouldRun(TaskListPage.SIPlanLink)) {
    await completeSamplingPlan({
      assert,
      material,
      baseName: samplingPlanBaseName
    })
  }

  if (assert) {
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
  }
}
