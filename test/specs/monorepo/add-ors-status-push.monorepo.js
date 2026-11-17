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
  changeRequestWorkItemIdsFor,
  clearChangeRequests,
  skipUnlessMonorepoRun
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
//   5 operator    can add Lyon to a new change request again
//
// Tests share the one request and run in order; each skips when the one
// before it did not get as far as it needs.

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

  before(async () => {
    const cleared = await clearChangeRequests({
      organisationId: ORGANISATION_ID
    })
    reportDetails(`Cleared organisation ${ORGANISATION_ID}`, cleared)

    await browser.deleteCookies()
    await signInAsOperator()
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

  it('Operator: can request the refused site again', async function () {
    requireStage(this, 'refused')

    await browser.url(OVERSEAS_SITES_PATH)
    await ManageOverseasSitesPage.addToAccreditation(SITE.siteId)
    await waitForPath(`/add/${SITE.siteId}`)
  })
})
