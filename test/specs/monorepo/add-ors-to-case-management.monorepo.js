import { browser, expect } from '@wdio/globals'
import AccreditationRequestsPage from 'page-objects/accreditation-requests.page'
import AddOrsConditionsOfExportPage from 'page-objects/add-ors-conditions-of-export.page'
import AddOrsRecyclingOperationPage from 'page-objects/add-ors-recycling-operation.page'
import AddToAccreditationPage from 'page-objects/add-to-accreditation.page'
import ChangeRequestDetailPage from 'page-objects/change-request-detail.page'
import ChangeRequestsPage from 'page-objects/change-requests.page'
import CmWorkItemsPage from 'page-objects/cm-work-items.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'

import {
  WORK_ITEM_STATES,
  signInToCaseManagement
} from '../../helpers/case-management-journey.js'
import { getAccreditationChanges } from '../../helpers/case-management.js'
import {
  addOverseasSiteWorkItemsFor,
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
// RA-739: an in-year change request reaches case management. The monorepo's
// operator backend has AccreditationChanges__SubmitToCaseManagement on, so
// submitting sends the request to the real case management backend, which
// splits it into one application per site:
//
//   1 operator    adds two registered ORSs to org 50019's current
//                 accreditation and submits the request
//   2 regulator   sees each site as its own "New ORS accreditation" card,
//                 with its own IYC-ORS reference and the shared SUB
//                 reference with "(2 requests)", under the "In-year change"
//                 application type
//   3 operator    sees each site's own reference on its change request
//
// Org 50019 is seeded by the operator backend's DevExporterAccreditationSeedService
// (test/fixtures/in-year-change-org.js). Its Lyon ORS is complete; Izmir lacks
// a recycling operation and the conditions of export, and is in the OECD so
// needs no BES evidence. The run first deletes 50019's change requests and the
// case management work items and submissions they raised, so it can be run
// again and again. The tests share the one request and run in order: each
// skips when the one before it did not get as far as it needs.

const SITES = [ORS.lyon, ORS.izmir]

const IN_YEAR_CHANGE_REFERENCE = /^IYC-ORS-\d{4}-\d{5}$/
const SUBMISSION_REFERENCE = /^SUB-\d{4}-\d{4,}$/

describe('RA-739: an add-ORS change request reaches case management @monorepo', () => {
  // What the run has got to: the submitted request's items by site id, then
  // the case management work items raised for them.
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

  /** Adds a registered ORS to the request and returns to its summary list. */
  async function addSite(site) {
    await browser.url(OVERSEAS_SITES_PATH)
    await ManageOverseasSitesPage.openTab('registered')
    await ManageOverseasSitesPage.addToAccreditation(site.siteId)
    await waitForPath(`/add/${site.siteId}`)
  }

  it('Operator: adds two registered ORSs to the accreditation and submits the request', async () => {
    const year = await readSeededYear({
      managePath: MANAGE_PATH,
      organisationName: ORGANISATION_NAME,
      material: MATERIAL
    })
    const applicationId = accreditationApplicationId(year)

    await reportStep(`Operator: add ORS ${ORS.lyon.orsId}`, async () => {
      await addSite(ORS.lyon)
      await AddToAccreditationPage.continue()
      await waitForPath('/requests')
    })

    await reportStep(
      `Operator: add ORS ${ORS.izmir.orsId}, with its missing information`,
      async () => {
        await addSite(ORS.izmir)
        await AddToAccreditationPage.openRowAction('recycling-operation')
        await waitForPath(`/add/${ORS.izmir.siteId}/recycling-operation`)
        await AddOrsRecyclingOperationPage.selectPrimaryOperationCode()
        await AddOrsRecyclingOperationPage.continue()
        await waitForPath(`/add/${ORS.izmir.siteId}`)

        await AddToAccreditationPage.openRowAction('conditions-of-export')
        await waitForPath(`/add/${ORS.izmir.siteId}/conditions-of-export`)
        await AddOrsConditionsOfExportPage.selectNo()
        await AddOrsConditionsOfExportPage.continue()
        await waitForPath(`/add/${ORS.izmir.siteId}`)

        await AddToAccreditationPage.continue()
        await waitForPath('/requests')
        await expect(
          AccreditationRequestsPage.requestRows
        ).toBeElementsArrayOfSize(2)
      }
    )

    await reportStep('Operator: submit the request', async () => {
      await AccreditationRequestsPage.continue()
      await waitForPath('/declaration')
      await SubmitApplicationPage.submitApplication()
      // Only reached once case management has accepted the submission: a
      // refusal reopens the request and shows the submission error instead.
      await waitForPath('/payment')
    })

    const { requests } = await getAccreditationChanges(
      ORGANISATION_ID,
      applicationId
    )
    const [request] = requests
    expect(request.status).toBe('Submitted')
    expect(request.sites).toHaveLength(SITES.length)

    // Each site holds its own case management reference.
    progress.items = {}
    for (const item of request.sites) {
      expect(item.caseManagementReference).toMatch(IN_YEAR_CHANGE_REFERENCE)
      progress.items[item.siteId] = {
        itemId: item.itemId,
        siteName: item.siteName,
        orsId: item.orsId,
        reference: item.caseManagementReference
      }
    }
    const references = Object.values(progress.items).map((i) => i.reference)
    expect(new Set(references).size).toBe(SITES.length)
    progress.submitted = true
    reportDetails('Submitted', progress.items)
  })

  it('Case management: raised one work item per site, sharing a submission reference', async function () {
    requireStage(this, 'submitted')

    const workItems = await addOverseasSiteWorkItemsFor({
      organisationId: ORGANISATION_ID
    })
    reportDetails('Work items', workItems)
    expect(workItems).toHaveLength(SITES.length)

    const [{ submissionReference }] = workItems
    expect(submissionReference).toMatch(SUBMISSION_REFERENCE)
    for (const workItem of workItems) {
      const item = progress.items[workItem.siteId]
      expect(workItem).toEqual(
        expect.objectContaining({
          stateId: 'submitted',
          orsId: item.orsId,
          applicationReference: item.reference,
          submissionReference,
          submissionSize: SITES.length
        })
      )
    }
    progress.submissionReference = submissionReference
    progress.raised = true
  })

  it('Regulator: lists each site as its own New ORS accreditation under the In-year change filter', async function () {
    requireStage(this, 'raised')
    await signInToCaseManagement()

    const listed = await reportStep(
      'Regulator: filter the applications by organisation and In-year change',
      async () => {
        await CmWorkItemsPage.open()
        await CmWorkItemsPage.filterByOrganisation(ORGANISATION_NAME, {
          applicationType: 'in-year-change'
        })
        await expect(
          CmWorkItemsPage.applicationTypeOption('in-year-change')
        ).toBeSelected()
        return CmWorkItemsPage.workItems()
      }
    )
    reportDetails('Listed', listed)

    // Only the in-year change applications, one per site.
    expect(listed).toHaveLength(SITES.length)
    for (const item of Object.values(progress.items)) {
      const card = listed.find(({ reference }) => reference === item.reference)
      expect(card).toEqual(
        expect.objectContaining({
          state: WORK_ITEM_STATES.notStarted,
          submissionReference: `${progress.submissionReference} (${SITES.length} requests)`,
          site: `${item.siteName} (${item.orsId})`,
          requestType: 'Request type: New ORS accreditation'
        })
      )
    }
    progress.listed = true
  })

  it("Operator: each site's change request shows its own case management reference", async function () {
    requireStage(this, 'listed')
    await signInAsOperator()

    for (const item of Object.values(progress.items)) {
      await reportStep(
        `Operator: ORS ${item.orsId} shows ${item.reference}`,
        async () => {
          await browser.url(`${MANAGE_PATH}/change-requests`)
          await ChangeRequestsPage.viewLink(item.itemId).waitForDisplayed()
          await ChangeRequestsPage.clickReliably(
            ChangeRequestsPage.viewLink(item.itemId)
          )
          await waitForPath(`/change-requests/${item.itemId}`)
          await expect(ChangeRequestDetailPage.requestReference).toHaveText(
            item.reference
          )
        }
      )
    }
  })
})
