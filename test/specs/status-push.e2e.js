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
import {
  pushStatusChanged,
  withdrawApplication
} from '../helpers/case-management.js'

describe('RA-368: Push CM status changes to OJ', () => {
  let organisationId
  let registrationId
  let materialType

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

  function landingUrl(year) {
    return `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
  }

  // Drives a fresh, run-unique reaccreditation application (org 50003 -
  // Delta Green Ltd, Plastic) to Submitted. query-resubmit.e2e.js owns the
  // fixed year on this same org/reg/material combination, so every call here
  // takes its own year (same seed-on-miss reasoning as
  // withdraw-application.e2e.js) to land its own disposable draft instead of
  // colliding with that spec's application.
  async function reachSubmittedApplication(year) {
    await OperatorPage.navigateToReaccreditationPlastic()

    const landing = await browser.getUrl()
    ;[, organisationId, registrationId, materialType] = new URL(
      landing
    ).pathname
      .split('/')
      .filter(Boolean)
    await browser.url(landingUrl(year))

    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )
    const applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

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

    return applicationId
  }

  it('reflects duly-made, updated, awaiting decision then approved statuses pushed from case management', async () => {
    const year = String(3000 + (Date.now() % 1000))
    const applicationId = await reachSubmittedApplication(year)

    await pushStatusChanged(organisationId, applicationId, {
      toStateId: 'duly-made',
      toStateDisplayName: 'Duly made',
      actionId: 'duly-made',
      actionDisplayName: 'Duly made',
      occurredAt: new Date().toISOString()
    })
    await browser.url(landingUrl(year))
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('DULY MADE')
    )

    // RA-368: assessment-in-progress is CM's "payment received" action. CM
    // itself displays this state as "Updated" (label collision with its own
    // updated state), so OJ mirrors that rather than inventing a new tag -
    // this was the gap that originally left OJ pinned at DULY MADE.
    await pushStatusChanged(organisationId, applicationId, {
      toStateId: 'assessment-in-progress',
      toStateDisplayName: 'Assessment in progress',
      actionId: 'payment-received',
      actionDisplayName: 'Payment received',
      occurredAt: new Date(Date.now() + 1000).toISOString()
    })
    await browser.url(landingUrl(year))
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('UPDATED')
    )

    // RA-368: awaiting-decision is CM's "submit for decision" action, and
    // unlike assessment-in-progress it gets its own distinct OJ status
    // rather than reusing an existing one.
    await pushStatusChanged(organisationId, applicationId, {
      toStateId: 'awaiting-decision',
      toStateDisplayName: 'Awaiting decision',
      actionId: 'submit-for-decision',
      actionDisplayName: 'Submit for decision',
      occurredAt: new Date(Date.now() + 2000).toISOString()
    })
    await browser.url(landingUrl(year))
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('AWAITING DECISION')
    )

    // Occurring strictly after the prior pushes, per the plan's
    // OccurredAt-ordering rule (not state-precedence) - approved is a
    // terminal state, so this application isn't reused by any other case.
    await pushStatusChanged(organisationId, applicationId, {
      toStateId: 'approved',
      toStateDisplayName: 'Granted',
      actionId: 'approve',
      actionDisplayName: 'Approve',
      occurredAt: new Date(Date.now() + 3000).toISOString()
    })
    await browser.url(landingUrl(year))
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('APPROVED')
    )
  })

  // Rejected is its own terminal state reachable straight from Submitted, so
  // this needs a second application - the one above is already spent on
  // reaching Approved.
  it('reflects a rejected status pushed from case management', async () => {
    const year = String(3000 + ((Date.now() + 500) % 1000))
    const applicationId = await reachSubmittedApplication(year)

    await pushStatusChanged(organisationId, applicationId, {
      toStateId: 'rejected',
      toStateDisplayName: 'Refused',
      actionId: 'reject',
      actionDisplayName: 'Reject',
      occurredAt: new Date().toISOString()
    })
    await browser.url(landingUrl(year))
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('REJECTED')
    )
  })

  // RA-368: before this fix, an application pushed to awaiting-decision
  // stayed mapped to whatever status preceded it, so the withdraw guard's
  // AwaitingDecision arm was never exercised. Calling the withdraw endpoint
  // directly (bypassing withdraw-application.e2e.js's UI journey) proves the
  // backend guard itself - the authoritative check behind OJ's own withdraw
  // link - now accepts the request instead of wrongly returning 409.
  it('accepts a withdrawal of an application awaiting decision, pushed directly to the withdraw endpoint', async () => {
    const year = String(3000 + ((Date.now() + 1500) % 1000))
    const applicationId = await reachSubmittedApplication(year)

    await pushStatusChanged(organisationId, applicationId, {
      toStateId: 'awaiting-decision',
      toStateDisplayName: 'Awaiting decision',
      actionId: 'submit-for-decision',
      actionDisplayName: 'Submit for decision',
      occurredAt: new Date().toISOString()
    })

    const { statusCode } = await withdrawApplication(
      organisationId,
      applicationId,
      { reason: 'No longer required' }
    )
    expect(statusCode).toBe(200)

    await browser.url(landingUrl(year))
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('WITHDRAWN')
    )
  })
})
