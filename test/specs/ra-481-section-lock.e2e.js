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
  getApplication,
  raiseQuery,
  patchSection
} from '../helpers/case-management.js'

// RA-481: submitted accreditation applications lock every section read-only
// except the one the regulator has queried. This spec proves both halves of
// that rule end to end (not just at the unit level covered by the backend's
// IsSectionEditable tests and the frontend's resolveQueriedSectionAccess
// tests) — a real GET renders read-only rather than erroring or redirecting
// away, CYA pages suppress their Change links, and a direct write is
// rejected server-side without changing stored data. This is deliberately
// separate from query-resubmit.e2e.js (RA-311): that spec exercises the
// query/resubmit *journey*; this one exercises the plain "just Submitted,
// nothing queried yet" locked state that journey never visits, plus the
// queried-section-stays-editable flip on the same section across both
// states.
//
// Owns its own dedicated org (50016, "Section Lock Test Recycling Ltd") per
// the org-50005/50015 Seed-race precedent documented on
// OperatorPage.navigateToSectionLockTestOrg() — this spec submits an
// application and then repeatedly re-visits its sections directly by URL
// across two `it()` blocks, which is exactly the shape of reuse that race
// corrupts under concurrent wdio workers. The two `it()` blocks below run in
// file order and deliberately share that one org/application sequentially
// (mirrors exporter-accreditation.e2e.js's single dedicated org 50015) rather
// than each seeding their own — the second test's premise (this section used
// to be locked, then got queried) only makes sense as a continuation of the
// first.
describe('RA-481: locked accreditation sections stay read-only except the queried one', () => {
  let organisationId
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

  async function reachSubmittedApplication() {
    await OperatorPage.navigateToSectionLockTestOrg()

    const landing = await browser.getUrl()
    ;[, organisationId] = new URL(landing).pathname.split('/').filter(Boolean)

    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )
    applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    const application = await getApplication(organisationId, applicationId)
    if (application.applicationStatus === 'Submitted') {
      return
    }

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
      await BusinessPlanPage.fillPercentages([15, 15, 15, 15, 15, 15, 10])
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
  }

  it('renders a non-queried section read-only once the application is Submitted, and rejects a direct write server-side', async () => {
    await reachSubmittedApplication()

    const submittedApplication = await getApplication(
      organisationId,
      applicationId
    )
    expect(submittedApplication.applicationStatus).toBe('Submitted')
    expect(submittedApplication.businessPlan.sectionStatus).not.toBe('Queried')
    const businessPlanBefore = submittedApplication.businessPlan

    // The classic task list itself is read-only, with no way back into the
    // wizard.
    await TaskListPage.open(applicationId)
    await expect($('[data-testid="submitted-text"]')).toBeDisplayed()
    await expect(await $('[data-testid="continue-button"]').isExisting()).toBe(
      false
    )

    // A direct GET on a locked, non-queried section still renders in place —
    // RA-481's whole point is that this is a 200 read-only view, not a 500 or
    // a redirect-away — with the Submitted-specific copy (not the
    // queried-application copy query-resubmit.e2e.js already covers), no
    // save/continue actions, and its inputs disabled rather than editable.
    await BusinessPlanPage.open(applicationId)
    await expect(browser).toHaveUrl(
      expect.stringContaining(`/accreditation/business-plan/${applicationId}`)
    )
    await expect($('[data-testid="read-only-notice"]')).toBeDisplayed()
    await expect($('[data-testid="read-only-notice"]')).toHaveText(
      expect.stringContaining('This application has already been submitted')
    )
    await expect($('[data-testid="read-only-notice"]')).not.toHaveText(
      expect.stringContaining("not part of the regulator's query")
    )
    await expect(await $('[data-testid="continue-button"]').isExisting()).toBe(
      false
    )
    await expect(
      await $('[data-testid="save-come-back-button"]').isExisting()
    ).toBe(false)
    const inputs = await BusinessPlanPage.percentageInputs
    expect(inputs.length).toBeGreaterThan(0)
    for (const input of inputs) {
      await expect(input).toBeDisabled()
    }

    // Its CYA page suppresses every Change link and the confirm/save form —
    // the read-only affordance RA-481 added for CYA pages specifically.
    await browser.url(`/accreditation/business-plan-cya/${applicationId}`)
    await expect($('[data-testid="read-only-notice"]')).toBeDisplayed()
    await expect(await $('[data-testid^="change-percent-"]').isExisting()).toBe(
      false
    )
    await expect(await $('[data-testid^="change-detail-"]').isExisting()).toBe(
      false
    )
    await expect(await $('[data-testid="confirm-button"]').isExisting()).toBe(
      false
    )
    await expect(
      await $('[data-testid="save-come-back-button"]').isExisting()
    ).toBe(false)

    // AC: the backend gate — not just the frontend's read-only rendering —
    // is what actually stops a write. Send a real change and prove it never
    // lands, not just that some 4xx came back. (newInfrastructureDetail must
    // ride along with the percent — the request validator requires detail
    // text whenever a percent field is positive, and would otherwise reject
    // this with 422 before the RA-481 gate is ever reached.)
    const patchResult = await patchSection(
      organisationId,
      applicationId,
      'business-plan',
      {
        newInfrastructurePercent: 99,
        newInfrastructureDetail: 'Attempted unauthorised change'
      }
    )
    expect(patchResult.statusCode).toBe(409)
    expect(patchResult.text).toEqual(
      expect.stringContaining('section is not editable')
    )

    const afterPatchApplication = await getApplication(
      organisationId,
      applicationId
    )
    expect(afterPatchApplication.businessPlan).toEqual(businessPlanBefore)
  })

  it('keeps the queried section fully editable while every other locked section stays read-only', async () => {
    // Continues the same org/application from the test above: still
    // Submitted, business-plan still not queried.
    const queryNote = 'Please review the business plan spending breakdown.'
    await raiseQuery(organisationId, applicationId, {
      queryNote,
      sectionKeys: ['business-plan']
    })

    // The queried section itself now renders fully editable — no read-only
    // notice, its normal save/continue actions are back, and a save actually
    // persists (proving this isn't just an unlocked-looking husk).
    await BusinessPlanPage.open(applicationId)
    await expect(await $('[data-testid="read-only-notice"]').isExisting()).toBe(
      false
    )
    await expect($('[data-testid="continue-button"]')).toBeDisplayed()
    const inputs = await BusinessPlanPage.percentageInputs
    for (const input of inputs) {
      await expect(input).not.toBeDisabled()
    }
    await BusinessPlanPage.fillPercentages([20, 20, 20, 15, 10, 10, 5])
    await BusinessPlanPage.saveAndContinue()

    let heading = await $('h1').getText()
    if (heading === "Add more details about how you'll spend the PRN income") {
      await BusinessPlanDetailPage.fillDescriptions()
      await BusinessPlanDetailPage.saveAndContinue()
      heading = await $('h1').getText()
    }
    if (heading === 'Check your answers before continuing') {
      await BusinessPlanCheckAnswersPage.confirmAndContinue()
    }

    // Give the save a moment to land server-side before reading it back via
    // the API — the save-and-continue click above only guarantees the
    // browser has navigated away from the CYA page, not that the PATCH has
    // been processed.
    await browser.waitUntil(
      async () => !(await browser.getUrl()).includes('business-plan-cya'),
      { timeout: 10000, timeoutMsg: 'Did not leave the business-plan CYA page' }
    )

    const savedApplication = await getApplication(organisationId, applicationId)
    expect(savedApplication.businessPlan.newInfrastructurePercent).toBe(20)

    // Meanwhile a different, still-locked section (PRN tonnage — not the one
    // queried) stays exactly as read-only as it was before the query was
    // raised: same GET-renders-in-place behaviour, same suppressed CYA
    // Change links, now with the queried-application copy since the
    // application itself is Queried.
    await PrnTonnagePage.open(applicationId)
    await expect(browser).toHaveUrl(
      expect.stringContaining(`/accreditation/tonnage/${applicationId}`)
    )
    await expect($('[data-testid="read-only-notice"]')).toBeDisplayed()
    await expect($('[data-testid="read-only-notice"]')).toHaveText(
      expect.stringContaining("not part of the regulator's query")
    )
    await expect(await $('[data-testid="continue-button"]').isExisting()).toBe(
      false
    )

    await browser.url(`/accreditation/tonnage-cya/${applicationId}`)
    await expect($('[data-testid="read-only-notice"]')).toBeDisplayed()
    await expect(
      await $('[data-testid="change-tonnage-link"]').isExisting()
    ).toBe(false)
    await expect(
      await $('[data-testid="change-authority-link"]').isExisting()
    ).toBe(false)
    await expect(await $('[data-testid="confirm-button"]').isExisting()).toBe(
      false
    )

    // And the backend gate still refuses a direct write to that non-queried
    // section, exactly as it did before any query existed.
    const tonnageBefore = savedApplication.prns
    const lockedPatch = await patchSection(
      organisationId,
      applicationId,
      'tonnage',
      {}
    )
    expect(lockedPatch.statusCode).toBe(409)
    expect(lockedPatch.text).toEqual(
      expect.stringContaining('section is not editable')
    )
    const afterApplication = await getApplication(organisationId, applicationId)
    expect(afterApplication.prns).toEqual(tonnageBefore)
  })
})
