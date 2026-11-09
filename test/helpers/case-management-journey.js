import { browser, expect } from '@wdio/globals'
import CmLoginPage from 'page-objects/cm-login.page'
import CmWorkItemsPage from 'page-objects/cm-work-items.page'
import CmWorkItemPage from 'page-objects/cm-work-item.page'
import CmDulyMakePage from 'page-objects/cm-duly-make.page'
import CmChangePaymentDatePage from 'page-objects/cm-change-payment-date.page'
import CmChangeDeadlinePage from 'page-objects/cm-change-deadline.page'
import CmQueryPage from 'page-objects/cm-query.page'
import CmDecisionPage from 'page-objects/cm-decision.page'
import CmConfirmContactPage from 'page-objects/cm-confirm-contact.page'

// Work item states as the case management list and case header render them.
// "Not started" is the state a freshly submitted application arrives in — the
// list filter calls the same thing "submitted", so the label is the only
// reliable thing to match on in the UI.
export const WORK_ITEM_STATES = {
  notStarted: 'Not started',
  dulyMade: 'Duly made',
  queried: 'Queried',
  updated: 'Updated',
  // An approved determination still waiting on "Confirm applicant contact".
  approved: 'Approved',
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
 * @param {string} [options.reference]    The application reference, to pick
 *   out one particular application rather than the first of its type.
 * @returns {Promise<{workItemId: string, reference: string, state: string,
 *   material: string, applicantType: string}>}
 */
export async function findWorkItem({
  organisation,
  applicantType,
  state,
  reference
}) {
  await CmWorkItemsPage.open()
  await CmWorkItemsPage.filterByOrganisation(organisation)

  const workItems = await CmWorkItemsPage.workItems()
  const match = workItems.find(
    (workItem) =>
      workItem.applicantType.includes(applicantType) &&
      workItem.state === state &&
      (!reference || workItem.reference === reference)
  )

  if (!match) {
    const listed = workItems
      .map((w) => `${w.reference} ${w.applicantType} ${w.state}`)
      .join('\n  ')
    throw new Error(
      `No ${applicantType} work item${reference ? ` ${reference}` : ''} for "${organisation}" is in ${state}. ` +
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
 * Replaces the payment date recorded when the work item was duly made.
 * Leaves the browser on the work item.
 */
export async function changePaymentDate({ paymentDate, reason }) {
  await CmWorkItemPage.startChangePaymentDate()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/change-payment-date')
  )

  await CmChangePaymentDatePage.changePaymentDate(paymentDate, reason)

  await CmWorkItemPage.waitUntilLoaded()
}

/**
 * Sets a new determination deadline (the work item's due date). Leaves the
 * browser on the work item.
 */
export async function changeDeterminationDeadline({ deadline, reason }) {
  await CmWorkItemPage.startChangeDeterminationDeadline()
  await expect(browser).toHaveUrl(expect.stringContaining('/sla/extend'))

  await CmChangeDeadlinePage.changeDeadline(deadline, reason)

  await CmWorkItemPage.waitUntilLoaded()
}

/**
 * The date as the case management header shows it, e.g. "06 Nov 2026".
 *
 * @param {Date} date
 */
export function caseManagementDate(date) {
  // date-fns' "dd MMM yyyy", which writes September as Sep (Intl writes Sept).
  const months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')
  const day = String(date.getDate()).padStart(2, '0')
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`
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
 * On an Updated work item, continues the review of the operator's query
 * response, which assigns it to the caseworker and opens the determination.
 * The state tag still reads Updated, so it waits for the "Make determination"
 * link instead. Leaves the browser on the work item.
 */
export async function continueReview() {
  await CmWorkItemPage.continueReview()
  await CmWorkItemPage.makeDeterminationLink.waitForDisplayed({
    timeout: 30000,
    timeoutMsg: 'Continue review did not open the determination'
  })
}

/**
 * Logs the determination on the work item, the first of its two steps.
 * Approving mints the accreditation and moves the work item to Approved, where
 * it waits for confirmApplicantContact; it cannot be undone.
 */
export async function approveWorkItem({ note } = {}) {
  await CmWorkItemPage.startDetermination()
  await expect(browser).toHaveUrl(expect.stringContaining('/decision'))

  await CmDecisionPage.approve({ note })

  await CmWorkItemPage.waitUntilLoaded()
}

/**
 * The second step of the determination: confirms the applicant has been
 * contacted about it, which applies it. An Approved work item moves to
 * Granted. Leaves the browser on the work item.
 */
export async function confirmApplicantContact() {
  await CmWorkItemPage.startConfirmApplicantContact()
  await expect(browser).toHaveUrl(expect.stringContaining('/confirm-contact'))

  await CmConfirmContactPage.confirmContacted()

  await CmWorkItemPage.waitUntilLoaded()
}
