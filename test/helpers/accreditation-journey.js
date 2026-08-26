import { browser, expect } from '@wdio/globals'
import TaskListPage from 'page-objects/tasklist.page'
import PrnTonnagePage from 'page-objects/prn-tonnage.page'
import PrnAuthorityPage from 'page-objects/prn-authority.page'
import PrnCheckAnswersPage from 'page-objects/prn-check-answers.page'
import BusinessPlanPage from 'page-objects/business-plan.page'
import BusinessPlanDetailPage from 'page-objects/business-plan-detail.page'
import BusinessPlanCheckAnswersPage from 'page-objects/business-plan-check-answers.page'
import SamplingPlanPage from 'page-objects/sampling-plan.page'

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
async function completeSamplingPlan({ assert, material }) {
  await TaskListPage.SIPlanLink.click()

  if (assert) {
    await expect(SamplingPlanPage.pageHeading).toHaveText(
      `Upload sampling and inspection plan - part 2 - ${material}`
    )
  }
  await SamplingPlanPage.uploadFile('business-plan.pdf')
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
 * @param {boolean} [options.skipCompletedTasks=false]
 *   Skip any of the three tasks whose task-list link is absent, which is how a
 *   completed task presents. Needed by callers that may run against an
 *   application a previous test already advanced.
 */
export async function completePrnBusinessPlanSamplingPlan({
  material = 'Plastic',
  assert = true,
  skipCompletedTasks = false
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
    await completeSamplingPlan({ assert, material })
  }

  if (assert) {
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
  }
}
