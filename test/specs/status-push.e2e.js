import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import {
  issueAccreditationNumber,
  pushStatusChanged,
  withdrawApplication,
  patchSection
} from '../helpers/case-management.js'
import { skipDockerOnlyOnDeployedEnvironment } from '../helpers/docker-only.js'
import { disposableYear } from '../helpers/disposable-year.js'
import { submitApplicationForYear } from '../helpers/accreditation-journey.js'

describe('RA-368: Push CM status changes to OJ @docker-only', () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

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
    await LoginPage.openOperatorLogin()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  function landingUrl(year) {
    return `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
  }

  // A fresh, run-unique reaccreditation application (org 50003 - Delta Green
  // Ltd, Plastic) at Submitted: every call takes its own disposable year (same
  // seed-on-miss reasoning as withdraw-application.e2e.js) to land its own
  // draft instead of colliding with query-resubmit.e2e.js's application.
  async function reachSubmittedApplication(year) {
    await OperatorPage.navigateToReaccreditationPlastic()
    let applicationId
    ;({ organisationId, registrationId, materialType, applicationId } =
      await submitApplicationForYear(year))
    return applicationId
  }

  it('reflects duly-made (kept after a start), updated, awaiting decision then approved statuses pushed from case management', async () => {
    const year = disposableYear()
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

    // RA-527 follow-up: CM's "Assessment started" action (`start-assessment`)
    // now lands on its internal `assessment-started` state, which CM still
    // shows as "Duly made" and never pushes, so the operator keeps seeing
    // DULY MADE after a start. Should that state ever be pushed (a
    // misconfiguration or a replay), OJ maps it to DULY MADE too, never
    // UPDATED.
    await pushStatusChanged(organisationId, applicationId, {
      toStateId: 'assessment-started',
      toStateDisplayName: 'Duly made',
      actionId: 'start-assessment',
      actionDisplayName: 'Assessment started',
      occurredAt: new Date(Date.now() + 1000).toISOString()
    })
    await browser.url(landingUrl(year))
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('DULY MADE')
    )

    // RA-368 / RA-527 follow-up: CM reaches assessment-in-progress from a
    // started case only by a determination deadline change (`sla-extend`) or
    // Continue review after a query response. CM displays this state as
    // "Updated" (label collision with its own updated state), so OJ mirrors
    // that rather than inventing a new tag.
    await pushStatusChanged(organisationId, applicationId, {
      toStateId: 'assessment-in-progress',
      toStateDisplayName: 'Updated',
      actionId: 'sla-extend',
      actionDisplayName: 'Extend SLA',
      occurredAt: new Date(Date.now() + 2000).toISOString()
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
      occurredAt: new Date(Date.now() + 3000).toISOString()
    })
    await browser.url(landingUrl(year))
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('AWAITING DECISION')
    )

    // Case management issues the accreditation number before it approves
    // (RA-783): with dual-write on (docker/config/operator-be.env), an
    // approval of an application without one is refused.
    await issueAccreditationNumber(organisationId, applicationId)
    // Occurring strictly after the prior pushes, per the plan's
    // OccurredAt-ordering rule (not state-precedence) - approved is a
    // terminal state, so this application isn't reused by any other case.
    await pushStatusChanged(organisationId, applicationId, {
      toStateId: 'approved',
      toStateDisplayName: 'Granted',
      actionId: 'approve',
      actionDisplayName: 'Approve',
      occurredAt: new Date(Date.now() + 4000).toISOString()
    })
    await browser.url(landingUrl(year))
    // RA-415: CM renamed its "Approved" label to "Granted" - OJ's own status
    // tag now mirrors that instead of still showing "APPROVED".
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('GRANTED')
    )
    // RA-415: Approved joins Withdrawn as a terminal status the landing page
    // must not offer a Continue link for.
    await expect(
      await OperatorAccreditationPage.firstContinueLink.isExisting()
    ).toBe(false)
    // RA-423: once CM is terminal there is no further SLA to count down to,
    // so the due-date cell shows COMPLETED instead of a date/fallback.
    await expect(OperatorAccreditationPage.applicationDueDate).toHaveText(
      expect.stringContaining('COMPLETED')
    )

    // RA-415: Approved is now a terminal status server-side too - the
    // ordinary write endpoints must reject an edit, not just the withdraw
    // endpoint (proved separately below for Withdrawn/AwaitingDecision).
    const approvedPatch = await patchSection(
      organisationId,
      applicationId,
      'tonnage',
      {}
    )
    expect(approvedPatch.statusCode).toBe(409)
    expect(approvedPatch.text).toEqual(
      expect.stringContaining(
        'Application is Approved, Rejected or Withdrawn and can no longer be edited.'
      )
    )
  })

  // Rejected is its own terminal state reachable straight from Submitted, so
  // this needs a second application - the one above is already spent on
  // reaching Approved.
  it('reflects a rejected status pushed from case management', async () => {
    const year = disposableYear()
    const applicationId = await reachSubmittedApplication(year)

    await pushStatusChanged(organisationId, applicationId, {
      toStateId: 'rejected',
      toStateDisplayName: 'Refused',
      actionId: 'reject',
      actionDisplayName: 'Reject',
      occurredAt: new Date().toISOString()
    })
    await browser.url(landingUrl(year))
    // RA-423: OJ's own label for CM's rejected state must read REFUSED, not
    // REJECTED - CM already displays this outcome as "Refused".
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('REFUSED')
    )
    await expect(
      await OperatorAccreditationPage.firstContinueLink.isExisting()
    ).toBe(false)
    // RA-423: terminal status shows COMPLETED for the due date too.
    await expect(OperatorAccreditationPage.applicationDueDate).toHaveText(
      expect.stringContaining('COMPLETED')
    )

    // RA-415: Rejected is terminal too - same server-side guard as Approved.
    const rejectedPatch = await patchSection(
      organisationId,
      applicationId,
      'tonnage',
      {}
    )
    expect(rejectedPatch.statusCode).toBe(409)
    expect(rejectedPatch.text).toEqual(
      expect.stringContaining(
        'Application is Approved, Rejected or Withdrawn and can no longer be edited.'
      )
    )
  })

  // RA-368: before this fix, an application pushed to awaiting-decision
  // stayed mapped to whatever status preceded it, so the withdraw guard's
  // AwaitingDecision arm was never exercised. Calling the withdraw endpoint
  // directly (bypassing withdraw-application.e2e.js's UI journey) proves the
  // backend guard itself - the authoritative check behind OJ's own withdraw
  // link - now accepts the request instead of wrongly returning 409.
  it('accepts a withdrawal of an application awaiting decision, pushed directly to the withdraw endpoint', async () => {
    const year = disposableYear()
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
    // RA-423: Withdrawn is terminal too, reached here via the withdraw
    // endpoint rather than a CM push - due date still shows COMPLETED.
    await expect(OperatorAccreditationPage.applicationDueDate).toHaveText(
      expect.stringContaining('COMPLETED')
    )
  })
})
