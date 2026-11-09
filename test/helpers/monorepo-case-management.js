import { browser, expect } from '@wdio/globals'
import CmWorkItemPage from 'page-objects/cm-work-item.page'
import CmWorkItemReviewPage from 'page-objects/cm-work-item-review.page'
import CmChangePaymentDatePage from 'page-objects/cm-change-payment-date.page'
import CmChangeDeadlinePage from 'page-objects/cm-change-deadline.page'

// Case management steps only the monorepo specs take (test/specs/monorepo).
// The steps shared with the deployed-environment journeys stay in
// case-management-journey.js.

/**
 * Replaces the payment date recorded when the work item was duly made.
 * Leaves the browser on the work item.
 */
export async function changePaymentDate({ paymentDate, reason }) {
  await CmWorkItemReviewPage.startChangePaymentDate()
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
  await CmWorkItemReviewPage.startChangeDeterminationDeadline()
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
 * On an Updated work item, continues the review of the operator's query
 * response, which assigns it to the caseworker and opens the determination.
 * The state tag still reads Updated, so it waits for the "Make determination"
 * link instead. Leaves the browser on the work item.
 */
export async function continueReview() {
  await CmWorkItemReviewPage.continueReview()
  await CmWorkItemReviewPage.makeDeterminationLink.waitForDisplayed({
    timeout: 30000,
    timeoutMsg: 'Continue review did not open the determination'
  })
}
