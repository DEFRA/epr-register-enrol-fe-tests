import { browser, expect } from '@wdio/globals'
import AccreditationRequestsPage from 'page-objects/accreditation-requests.page'
import AddToAccreditationPage from 'page-objects/add-to-accreditation.page'
import ChangeRequestDetailPage from 'page-objects/change-request-detail.page'
import ChangeRequestsPage from 'page-objects/change-requests.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'

import {
  getAccreditationChanges,
  pushChangeRequestStatus
} from '../../helpers/case-management.js'
import {
  MONOREPO_RUN_FLAG,
  changeRequestWorkItemIdsFor,
  clearChangeRequests,
  skipUnlessMonorepoRun,
  unaccreditOverseasSite
} from '../../helpers/monorepo.js'
import { signInAsOperator } from '../../helpers/monorepo-journey.js'
import { reportDetails, reportStep } from '../../helpers/report-step.js'
import { readSeededYear } from '../../helpers/seeded-year.js'
import { waitForUrl } from '../../helpers/wait-for-url.js'
import {
  MANAGE_PATH,
  MATERIAL,
  ORGANISATION_ID,
  ORGANISATION_NAME,
  ORS,
  OVERSEAS_SITES_PATH,
  accreditationApplicationId
} from '../../fixtures/in-year-change-org.js'

// Runs only against the DEFRA/epr-register-enrol monorepo's local stack:
// npm run test:monorepo (wdio.monorepo.conf.js). Never in CI.
//
// RA-495: case management pushes each add-ORS work item's status changes to
// the operator backend's change request status route. Until case management
// sends them itself (RA-495 task 008), this spec stands in for it, pushing to
// the route directly, as status-push.e2e.js does for applications:
//
//   1 operator    adds Lyon to org 50019's accreditation and submits, so case
//                 management raises its work item
//   2 push        duly-made: the operator's change request shows DULY MADE,
//                 and Lyon stays locked (no "Add to accreditation")
//   3 push        updated: UPDATED; a push older than that one is ignored
//   4 push        rejected: REFUSED, and a later "duly-made" is refused (409)
//   5 operator    can add Lyon to a new change request again, and submits it
//   6 push        duly-made then approved (task 007): GRANTED, valid from the
//                 request's submission date, and Lyon is on the Accredited tab
//
// Tests share the requests and run in order; each skips when the one before
// it did not get as far as it needs. Granting Lyon selects it on the seeded
// accreditation application, so the hooks put it back to registered only.

const SITE = ORS.lyon

describe('RA-495: case management status pushes reach an add-ORS change request @monorepo', () => {
  const progress = {}

  function requireStage(context, stage) {
    if (!progress[stage]) {
      reportDetails('Skipped', { reason: `not ${stage}` })
      context.skip()
    }
  }

  async function waitForPath(suffix, { timeout = 30000 } = {}) {
    await waitForUrl(
      (url) => new URL(url).pathname.endsWith(suffix),
      `Did not reach ${suffix}`,
      { timeout }
    )
  }

  async function push(toStateId, occurredAt = new Date()) {
    const result = await pushChangeRequestStatus(progress.workItemId, {
      toStateId,
      toStateDisplayName: toStateId,
      actionId: `ra-495-${toStateId}`,
      actionDisplayName: toStateId,
      occurredAt: occurredAt.toISOString()
    })
    reportDetails(`Pushed ${toStateId}`, result)
    return result
  }

  // The item's status tag on the change requests list and on its own page.
  async function expectStatus(text) {
    await browser.url(`${MANAGE_PATH}/change-requests`)
    await expect(ChangeRequestsPage.status(progress.itemId)).toHaveText(text)
    await ChangeRequestsPage.clickReliably(
      ChangeRequestsPage.viewLink(progress.itemId)
    )
    await waitForPath(`/change-requests/${progress.itemId}`)
    await expect(ChangeRequestDetailPage.statusTag).toHaveText(text)
  }

  before(function () {
    skipUnlessMonorepoRun(this)
  })

  async function resetOrganisation() {
    const cleared = await clearChangeRequests({
      organisationId: ORGANISATION_ID
    })
    const unaccredited = await unaccreditOverseasSite({
      organisationId: ORGANISATION_ID,
      siteId: SITE.siteId
    })
    reportDetails(`Reset organisation ${ORGANISATION_ID}`, {
      ...cleared,
      ...unaccredited
    })
  }

  // The submitted add-ORS request for the site (newest first) and its item.
  async function submittedItem() {
    const { requests } = await getAccreditationChanges(
      ORGANISATION_ID,
      progress.applicationId
    )
    const request = requests.find((r) => r.status === 'Submitted')
    return { request, item: request.sites[0] }
  }

  before(async () => {
    await resetOrganisation()

    await browser.deleteCookies()
    await signInAsOperator()
  })

  after(async () => {
    if (process.env[MONOREPO_RUN_FLAG] === 'true') {
      await resetOrganisation()
    }
  })

  it('Operator: adds Lyon to the accreditation and submits the request', async () => {
    const year = await readSeededYear({
      managePath: MANAGE_PATH,
      organisationName: ORGANISATION_NAME,
      material: MATERIAL
    })
    progress.applicationId = accreditationApplicationId(year)

    await reportStep(`Operator: add ORS ${SITE.orsId} and submit`, async () => {
      await browser.url(OVERSEAS_SITES_PATH)
      await ManageOverseasSitesPage.addToAccreditation(SITE.siteId)
      await waitForPath(`/add/${SITE.siteId}`)
      await AddToAccreditationPage.continue()
      await waitForPath('/requests')
      await AccreditationRequestsPage.continue()
      await waitForPath('/declaration')
      await SubmitApplicationPage.submitApplication()
      await waitForPath('/payment')
    })

    const { requests } = await getAccreditationChanges(
      ORGANISATION_ID,
      progress.applicationId
    )
    const [item] = requests[0].sites
    progress.itemId = item.itemId
    progress.workItemId = (
      await changeRequestWorkItemIdsFor({ organisationId: ORGANISATION_ID })
    )[SITE.siteId]
    reportDetails('Submitted', progress)
    expect(progress.workItemId).toBeTruthy()
    progress.submitted = true
  })

  it('Case management: duly made shows DULY MADE, and the site stays locked', async function () {
    requireStage(this, 'submitted')

    expect((await push('duly-made')).statusCode).toBe(200)
    await expectStatus('DULY MADE')

    await browser.url(OVERSEAS_SITES_PATH)
    await ManageOverseasSitesPage.openTab('registered')
    await expect(
      ManageOverseasSitesPage.addToAccreditationButton(SITE.siteId)
    ).not.toBeExisting()
    progress.dulyMade = true
  })

  it('Case management: updated shows UPDATED, and an older push is ignored', async function () {
    requireStage(this, 'dulyMade')

    const updatedAt = new Date()
    expect((await push('updated', updatedAt)).statusCode).toBe(200)
    const stale = await push('duly-made', new Date(updatedAt.getTime() - 1000))
    expect(stale.statusCode).toBe(200)
    expect(stale.item.status).toBe('Updated')

    await expectStatus('UPDATED')
    progress.updated = true
  })

  it('Case management: rejected shows REFUSED, and the decision is final', async function () {
    requireStage(this, 'updated')

    expect((await push('rejected')).statusCode).toBe(200)
    expect((await push('rejected')).statusCode).toBe(200)
    expect((await push('duly-made')).statusCode).toBe(409)

    await expectStatus('REFUSED')
    progress.refused = true
  })

  it('Operator: can request the refused site again, and submits it', async function () {
    requireStage(this, 'refused')

    await browser.url(OVERSEAS_SITES_PATH)
    await ManageOverseasSitesPage.addToAccreditation(SITE.siteId)
    await waitForPath(`/add/${SITE.siteId}`)
    await AddToAccreditationPage.continue()
    await waitForPath('/requests')
    await AccreditationRequestsPage.continue()
    await waitForPath('/declaration')
    await SubmitApplicationPage.submitApplication()
    await waitForPath('/payment')

    const { request, item } = await submittedItem()
    progress.itemId = item.itemId
    progress.submittedAt = request.submittedAt
    // Only the new item: the refused one is no longer being decided.
    progress.workItemId = (
      await changeRequestWorkItemIdsFor({ organisationId: ORGANISATION_ID })
    )[SITE.siteId]
    reportDetails('Submitted again', progress)
    expect(progress.workItemId).toBeTruthy()
    progress.resubmitted = true
  })

  it('Case management: approved shows GRANTED from the submission date, and the site is accredited', async function () {
    requireStage(this, 'resubmitted')

    expect((await push('duly-made')).statusCode).toBe(200)
    const granted = await push('approved')
    expect(granted.statusCode).toBe(200)
    expect(granted.item.status).toBe('Approved')
    expect(new Date(granted.item.validFrom).toISOString()).toBe(
      new Date(progress.submittedAt).toISOString()
    )
    // Final: a repeat is accepted with no change, anything else is refused.
    expect((await push('approved')).statusCode).toBe(200)
    expect((await push('rejected')).statusCode).toBe(409)

    await expectStatus('GRANTED')
    await expect(ChangeRequestDetailPage.requestValidFrom).not.toHaveText(
      'Not applicable'
    )

    await browser.url(OVERSEAS_SITES_PATH)
    await ManageOverseasSitesPage.openTab('accredited')
    await expect(
      ManageOverseasSitesPage.siteRow('accredited', SITE.siteId)
    ).toBeExisting()
    await expect(
      ManageOverseasSitesPage.siteRow('registered', SITE.siteId)
    ).not.toBeExisting()

    const { sites } = await getAccreditationChanges(
      ORGANISATION_ID,
      progress.applicationId
    )
    const site = sites.find((s) => s.siteId === SITE.siteId)
    expect(site.accreditationStatus).toBe('Accredited')
    expect(site.pendingRequestId).toBeNull()
  })
})
