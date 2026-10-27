import { browser, expect } from '@wdio/globals'
import CmLoginPage from 'page-objects/cm-login.page'
import CmWorkItemsPage from 'page-objects/cm-work-items.page'
import CmWorkItemPage from 'page-objects/cm-work-item.page'
import CmDulyMakePage from 'page-objects/cm-duly-make.page'
import CmQueryPage from 'page-objects/cm-query.page'
import CmDecisionPage from 'page-objects/cm-decision.page'

// Work item states as the case management list and case header render them.
// "Not started" is the state a freshly submitted application arrives in — the
// list filter calls the same thing "submitted", so the label is the only
// reliable thing to match on in the UI.
export const WORK_ITEM_STATES = {
  notStarted: 'Not started',
  dulyMade: 'Duly made',
  queried: 'Queried',
  updated: 'Updated',
  granted: 'Granted'
}

export async function signInToCaseManagement() {
  await CmLoginPage.login()
}

/**
 * Filters the work item list by organisation and returns the first work item
 * matching the given applicant type and state.
 *
 * @param {object} options
 * @param {string} options.organisation   Organisation name to search for.
 * @param {string} options.applicantType  e.g. 'Exporter'.
 * @param {string} options.state          One of WORK_ITEM_STATES.
 * @returns {Promise<{workItemId: string, reference: string, state: string,
 *   material: string, applicantType: string}>}
 */
export async function findWorkItem({ organisation, applicantType, state }) {
  await CmWorkItemsPage.open()
  await CmWorkItemsPage.filterByOrganisation(organisation)

  const workItems = await CmWorkItemsPage.workItems()
  const match = workItems.find(
    (workItem) =>
      workItem.applicantType.includes(applicantType) && workItem.state === state
  )

  if (!match) {
    const listed = workItems
      .map((w) => `${w.reference} ${w.applicantType} ${w.state}`)
      .join('\n  ')
    throw new Error(
      `No ${applicantType} work item for "${organisation}" is in ${state}. ` +
        `The list holds:\n  ${listed || '(nothing)'}`
    )
  }

  return match
}

/**
 * Records a payment date against the work item, which duly makes it.
 *
 * Leaves the browser on the work item, which then shows the confirmation
 * banner and the Duly made state.
 */
export async function dulyMakeWorkItem({ paymentDate = new Date() } = {}) {
  await CmWorkItemPage.startDulyMaking()
  await expect(browser).toHaveUrl(expect.stringContaining('/duly-make'))

  await CmDulyMakePage.enterPaymentDate(paymentDate)
  await CmDulyMakePage.completeDulyMaking()

  await CmWorkItemPage.waitUntilLoaded()
}

/**
 * Queries the given sections, which unlocks them for the operator to update.
 * Values come from QUERY_SECTIONS in cm-query.page.js.
 */
export async function queryWorkItem({ sections, reason }) {
  await CmWorkItemPage.startQuery()
  await expect(browser).toHaveUrl(expect.stringContaining('/query'))

  await CmQueryPage.sendQuery({ sections, reason })

  await CmWorkItemPage.waitUntilLoaded()
}

/**
 * Logs the final determination on the work item. Approving issues the
 * accreditation and moves the work item to Granted; it cannot be undone.
 */
export async function approveWorkItem({ note } = {}) {
  await CmWorkItemPage.startDetermination()
  await expect(browser).toHaveUrl(expect.stringContaining('/decision'))

  await CmDecisionPage.approve({ note })

  await CmWorkItemPage.waitUntilLoaded()
}
