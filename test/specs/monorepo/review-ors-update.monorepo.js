import { browser, expect } from '@wdio/globals'
import AccreditationRequestsPage from 'page-objects/accreditation-requests.page'
import AddToAccreditationPage from 'page-objects/add-to-accreditation.page'
import ChangeRequestDetailPage from 'page-objects/change-request-detail.page'
import ChangeRequestsPage from 'page-objects/change-requests.page'
import CmDecisionPage from 'page-objects/cm-decision.page'
import CmDulyMakePage from 'page-objects/cm-duly-make.page'
import CmWorkItemPage from 'page-objects/cm-work-item.page'
import CmWorkItemsPage from 'page-objects/cm-work-items.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'
import UpdateOverseasSitePage from 'page-objects/update-overseas-site.page'

import {
  WORK_ITEM_STATES,
  approveWorkItem,
  confirmApplicantContact,
  dulyMakeWorkItem,
  refuseWorkItem,
  signInToCaseManagement
} from '../../helpers/case-management-journey.js'
import { getAccreditationChanges } from '../../helpers/case-management.js'
import {
  ADD_OVERSEAS_SITE_TYPE_ID as ADD,
  MONOREPO_RUN_FLAG,
  UPDATE_OVERSEAS_SITE_TYPE_ID as UPDATE,
  clearChangeRequests,
  orsWorkItemsFor,
  resetOverseasSites,
  skipUnlessMonorepoRun
} from '../../helpers/monorepo.js'
import { signInAsOperator } from '../../helpers/monorepo-journey.js'
import { reportDetails, reportStep } from '../../helpers/report-step.js'
import { requireStage } from '../../helpers/require-stage.js'
import { readSeededYear } from '../../helpers/seeded-year.js'
import { waitForPath } from '../../helpers/wait-for-url.js'
import {
  INTERIM,
  MANAGE_PATH,
  MATERIAL,
  ORGANISATION_ID,
  ORGANISATION_NAME,
  ORS,
  OVERSEAS_SITES_PATH,
  accreditationApplicationId,
  seededAccreditedSites
} from '../../fixtures/in-year-update-org.js'

// Runs only against the DEFRA/epr-register-enrol monorepo's local stack:
// npm run test:monorepo (wdio.monorepo.conf.js). Never in CI.
//
// RA-782 / RA-767: an ORS update reviewed and decided in case management,
// end to end, on org 50025 (A, B and E accredited, A with two interim sites;
// C and D registered):
//
//   1 operator    changes A's name and one of its interim sites, and adds
//                 registered C in the same request, and submits
//   2 regulator   sees A's update and C's add as two cards sharing one SUB
//                 reference with "(2 requests)" (RA-767); opens A's update:
//                 its name row is marked changed, the interim site change
//                 shows, and Related change requests lists both
//   3 regulator   assigns it to themselves, duly makes it (no payment date to
//                 enter), approves it (no valid from date) and confirms
//                 contact: Granted
//   4 operator    the request reads GRANTED, and A carries its new name and
//                 interim site on its details page and on Manage ORS
//   5 operator    changes B's town and submits; nothing to pay
//   6 regulator   duly makes and refuses it, and confirms contact: Refused
//   7 operator    the request reads REFUSED, B is unchanged and can be
//                 changed again
//
// Approving changes A on the accreditation for good, so the hooks clear
// 50025's change requests (and the work items and submissions they raised)
// and put A and B back as the dev seed leaves them, so
// update-accredited-ors.monorepo.js and this spec can run again. The tests
// share the requests and run in order: each skips when the one before it did
// not get as far as it needs.

const NEW_NAME = 'Gdansk Recycling Centre'
const NEW_INTERIM_NAME = 'Gdynia Port Hub'
// Case management compares an interim site's details but not its name (see
// the interim step below), so its contact changes too.
const NEW_INTERIM_CONTACT = 'Marta Kowalska'
const NEW_TOWN = 'Vila Nova de Gaia'

const SUBMISSION_REFERENCE = /^SUB-\d{4}-\d{4,}$/

// Case management pushes a status change in the background once it has
// recorded it, so the operator side catches up shortly afterwards.
const PUSH_TIMEOUT = 30000

describe('RA-782: an ORS update reviewed, approved and refused in case management @monorepo', () => {
  const progress = {}
  let applicationId

  async function resetOrganisation() {
    const cleared = await clearChangeRequests({
      organisationId: ORGANISATION_ID
    })
    const year = await readSeededYearOnce()
    const reset = await resetOverseasSites({
      organisationId: ORGANISATION_ID,
      sites: seededAccreditedSites(year)
    })
    reportDetails(`Reset organisation ${ORGANISATION_ID}`, {
      ...cleared,
      ...reset
    })
  }

  let seededYear
  async function readSeededYearOnce() {
    seededYear ??= await readSeededYear({
      managePath: MANAGE_PATH,
      organisationName: ORGANISATION_NAME,
      material: MATERIAL
    })
    return seededYear
  }

  async function openDetails(site) {
    await browser.url(OVERSEAS_SITES_PATH)
    await ManageOverseasSitesPage.changeSite(site.siteId)
    await waitForPath(`/update/${site.siteId}`)
  }

  async function openWorkItem(workItemId) {
    await CmWorkItemPage.open(workItemId)
    await CmWorkItemPage.waitUntilLoaded()
  }

  // The operator backend's item for the site, in its newest request.
  async function currentItem(site) {
    const { requests } = await getAccreditationChanges(
      ORGANISATION_ID,
      applicationId
    )
    for (const request of requests) {
      const item = request.sites.find((s) => s.siteId === site.siteId)
      if (item) {
        return item
      }
    }
    return undefined
  }

  async function waitForItemStatus(site, status) {
    let last
    await browser.waitUntil(
      async () => {
        last = await currentItem(site)
        return last?.status === status
      },
      {
        timeout: PUSH_TIMEOUT,
        interval: 500,
        timeoutMsg: `ORS ${site.orsId}'s change request item never reached ${status}`
      }
    )
    reportDetails(`Operator backend: ORS ${site.orsId} ${status}`, last)
    return last
  }

  // The item's status tag on the change requests list and on its own page.
  async function expectOperatorStatus(itemId, text) {
    await browser.url(`${MANAGE_PATH}/change-requests`)
    await expect(ChangeRequestsPage.status(itemId)).toHaveText(text)
    await ChangeRequestsPage.clickReliably(ChangeRequestsPage.viewLink(itemId))
    await waitForPath(`/change-requests/${itemId}`)
    await expect(ChangeRequestDetailPage.statusTag).toHaveText(text)
  }

  async function workItemFor(site) {
    const workItems = await orsWorkItemsFor({ organisationId: ORGANISATION_ID })
    return workItems.find(
      (w) => Number(w.siteId) === site.siteId && w.stateId === 'submitted'
    )
  }

  before(function () {
    skipUnlessMonorepoRun(this)
  })

  before(async () => {
    await browser.deleteCookies()
    await signInAsOperator()
    await resetOrganisation()
    applicationId = accreditationApplicationId(await readSeededYearOnce())
  })

  after(async () => {
    if (process.env[MONOREPO_RUN_FLAG] === 'true') {
      await resetOrganisation()
    }
  })

  it("Operator: changes A's name and an interim site, adds C, and submits", async () => {
    const gdynia = `interim-${INTERIM.gdynia.siteId}`

    await reportStep(`Operator: change ORS ${ORS.a.orsId}`, async () => {
      await openDetails(ORS.a)
      await UpdateOverseasSitePage.openRowAction('site-name')
      await UpdateOverseasSitePage.fill({ siteName: NEW_NAME })
      await UpdateOverseasSitePage.continue()
      await waitForPath(`/update/${ORS.a.siteId}`)

      await UpdateOverseasSitePage.changeInterim(gdynia)
      await UpdateOverseasSitePage.fill({
        siteName: NEW_INTERIM_NAME,
        contactName: NEW_INTERIM_CONTACT
      })
      await UpdateOverseasSitePage.continue()
      await waitForPath(`/update/${ORS.a.siteId}`)
      await expect(UpdateOverseasSitePage.interimState(gdynia)).toHaveText(
        'Changed'
      )
    })

    await reportStep(`Operator: add ORS ${ORS.c.orsId}`, async () => {
      await browser.url(OVERSEAS_SITES_PATH)
      await ManageOverseasSitesPage.addToAccreditation(ORS.c.siteId)
      await waitForPath(`/add/${ORS.c.siteId}`)
      await AddToAccreditationPage.continue()
      await waitForPath('/requests')
      await expect(
        AccreditationRequestsPage.requestRows
      ).toBeElementsArrayOfSize(2)
    })

    await reportStep('Operator: submit the request', async () => {
      await AccreditationRequestsPage.continue()
      await waitForPath('/declaration')
      await SubmitApplicationPage.submitApplication()
      // C is charged for, so the payment page; reached only once case
      // management has accepted both groups.
      await waitForPath('/payment')
    })

    const { requests } = await getAccreditationChanges(
      ORGANISATION_ID,
      applicationId
    )
    expect(requests).toHaveLength(1)
    const [request] = requests
    progress.items = Object.fromEntries(request.sites.map((s) => [s.siteId, s]))
    reportDetails('Submitted', request.sites)
    expect(request.sites).toHaveLength(2)
    progress.submitted = true
  })

  it('Case management: one SUB reference for the update and the add (RA-767)', async function () {
    requireStage(this, progress, 'submitted')
    const workItems = await orsWorkItemsFor({ organisationId: ORGANISATION_ID })
    reportDetails('Work items', workItems)
    expect(workItems).toHaveLength(2)

    const bySite = Object.fromEntries(
      workItems.map((w) => [Number(w.siteId), w])
    )
    const a = bySite[ORS.a.siteId]
    const c = bySite[ORS.c.siteId]
    expect(a.typeId).toBe(UPDATE)
    expect(c.typeId).toBe(ADD)
    expect(a.submissionReference).toMatch(SUBMISSION_REFERENCE)
    expect(c.submissionReference).toBe(a.submissionReference)
    expect(a.submissionSize).toBe(2)
    expect(c.submissionSize).toBe(2)
    expect(a.applicationReference).not.toBe(c.applicationReference)

    progress.a = a
    progress.c = c
    progress.raised = true
  })

  it('Regulator: lists both under one SUB reference and opens the update', async function () {
    requireStage(this, progress, 'raised')
    await signInToCaseManagement()

    const listed = await reportStep(
      'Regulator: filter the applications by organisation and In-year change',
      async () => {
        await CmWorkItemsPage.open()
        await CmWorkItemsPage.filterApplications(ORGANISATION_NAME, {
          applicationType: 'in-year-change'
        })
        return CmWorkItemsPage.workItems()
      }
    )
    reportDetails('Listed', listed)
    expect(listed).toHaveLength(2)
    const submission = `${progress.a.submissionReference} (2 requests)`
    const aCard = listed.find((w) => w.workItemId === progress.a.id)
    const cCard = listed.find((w) => w.workItemId === progress.c.id)
    expect(aCard).toEqual(
      expect.objectContaining({
        reference: progress.a.applicationReference,
        state: WORK_ITEM_STATES.notStarted,
        submissionReference: submission,
        site: `${ORS.a.siteName} (${ORS.a.orsId})`,
        requestType: 'Request type: Update ORS Accreditation'
      })
    )
    expect(cCard).toEqual(
      expect.objectContaining({
        reference: progress.c.applicationReference,
        submissionReference: submission,
        requestType: 'Request type: New ORS accreditation'
      })
    )

    await reportStep(`Regulator: open ${aCard.reference}`, async () => {
      await CmWorkItemsPage.openWorkItem(aCard.workItemId)
      await waitForPath(`/work-items/${aCard.workItemId}`)
      await CmWorkItemPage.waitUntilLoaded()
    })

    await reportStep('Regulator: the header and tabs', async () => {
      await expect(CmWorkItemPage.reference).toHaveText(
        progress.a.applicationReference
      )
      await expect(CmWorkItemPage.headerTitle).toHaveText(
        `${ORS.a.siteName} (${ORS.a.orsId})`
      )
      expect(await CmWorkItemPage.tabNames()).toEqual([
        'Application summary',
        'Accreditation summary',
        'Related change requests (2)',
        'Application history'
      ])
    })

    await reportStep(
      'Regulator: the summary marks the changed name and the interim site change',
      async () => {
        await expect(CmWorkItemPage.updateOrsIntro).toHaveText(
          expect.stringContaining(`ORS ${ORS.a.orsId}`)
        )
        await expect(CmWorkItemPage.updateOrsRow('site-name')).toHaveAttribute(
          'data-changed',
          'true'
        )
        await expect(CmWorkItemPage.updateOrsChangedTag('site-name')).toExist()
        await expect(CmWorkItemPage.updateOrsCurrent('site-name')).toHaveText(
          ORS.a.siteName
        )
        await expect(CmWorkItemPage.updateOrsRequested('site-name')).toHaveText(
          NEW_NAME
        )
        // Only what the operator changed is marked.
        await expect(
          CmWorkItemPage.updateOrsRow('contact-name')
        ).toHaveAttribute('data-changed', 'false')
        await expect(
          CmWorkItemPage.updateOrsChangedTag('contact-name')
        ).not.toExist()

        const interimSites = await CmWorkItemPage.updateOrsInterimSites()
        reportDetails('Interim sites', interimSites)
        expect(interimSites).toEqual([
          {
            change: 'changed',
            title: `Interim site 1: ${NEW_INTERIM_NAME}`,
            tag: 'Changed'
          },
          {
            change: 'unchanged',
            title: `Interim site 2: ${INTERIM.szczecin.siteName}`,
            tag: 'No changes'
          }
        ])
        // The first interim site's table: its contact is marked changed.
        // Its new name is only its title: the table has no name row, so a
        // rename alone reads "No changes".
        await expect(
          CmWorkItemPage.updateOrsInterimRow('contact-name')
        ).toHaveAttribute('data-changed', 'true')
      }
    )

    await reportStep(
      'Regulator: Related change requests lists the update and the add',
      async () => {
        await CmWorkItemPage.clickReliably(CmWorkItemPage.relatedRequestsTab)
        await waitForPath(`/work-items/${aCard.workItemId}/related-requests`)
        const related = await CmWorkItemPage.relatedRequests()
        reportDetails('Related change requests', related)
        expect(related.map((r) => r.reference).sort()).toEqual(
          [
            progress.a.applicationReference,
            progress.c.applicationReference
          ].sort()
        )
      }
    )
    progress.reviewed = true
  })

  it('Regulator: assigns it, duly makes it with no payment date, approves it with no valid from date, and confirms contact', async function () {
    requireStage(this, progress, 'reviewed')
    const workItemId = progress.a.id

    await reportStep('Regulator: assign it to yourself', async () => {
      await openWorkItem(workItemId)
      await CmWorkItemPage.assignToYourself()
      await expect(CmWorkItemPage.assignmentCurrent).toHaveText(
        'Assigned to you'
      )
    })

    await reportStep(
      'Regulator: duly make it, with no payment date to enter',
      async () => {
        await openWorkItem(workItemId)
        await CmWorkItemPage.startDulyMaking()
        await expect(browser).toHaveUrl(expect.stringContaining('/duly-make'))
        await CmDulyMakePage.submitButton.waitForDisplayed({ timeout: 30000 })
        await expect(CmDulyMakePage.paymentDateGroup).not.toExist()
        await expect(CmDulyMakePage.chargeAmount).toHaveText('-')
        await CmDulyMakePage.completeDulyMaking()
        await CmWorkItemPage.waitUntilLoaded()
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.dulyMade
        )
      }
    )
    await waitForItemStatus(ORS.a, 'DulyMade')

    await reportStep(
      'Regulator: approve it, with no valid from date to enter',
      async () => {
        await openWorkItem(workItemId)
        await CmWorkItemPage.startDetermination()
        await expect(browser).toHaveUrl(expect.stringContaining('/decision'))
        await CmDecisionPage.approvedRadio.waitForExist({ timeout: 30000 })
        await expect(CmDecisionPage.effectiveDateGroup).not.toExist()
        await openWorkItem(workItemId)
        await approveWorkItem({ note: 'RA-782 e2e: the changes are fine.' })
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.approved
        )
        await expect(CmWorkItemPage.pendingContactBanner).toBeDisplayed()
      }
    )

    // The determination alone is not pushed, so A is unchanged until the
    // applicant has been contacted.
    expect((await currentItem(ORS.a)).status).toBe('DulyMade')

    await reportStep(
      'Regulator: confirm the applicant was contacted',
      async () => {
        await openWorkItem(workItemId)
        await confirmApplicantContact()
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.granted
        )
        await expect(CmWorkItemPage.outcomePanel).toBeDisplayed()
      }
    )
    progress.granted = true
  })

  it('Operator: the request reads GRANTED, and A has its new name and interim site', async function () {
    requireStage(this, progress, 'granted')
    await signInAsOperator()

    const item = await currentItem(ORS.a)
    expect(item.status).toBe('Approved')
    await expectOperatorStatus(item.itemId, 'GRANTED')

    await reportStep("Operator: A's details page", async () => {
      await openDetails(ORS.a)
      await expect(UpdateOverseasSitePage.statusTag).toHaveText('Approved')
      await expect(UpdateOverseasSitePage.rowValue('site-name')).toHaveText(
        NEW_NAME
      )
      await expect(
        UpdateOverseasSitePage.interimLine(`interim-${INTERIM.gdynia.siteId}`)
      ).toHaveText(expect.stringContaining(NEW_INTERIM_NAME))
      // No longer pending: it can be changed again.
      await expect(UpdateOverseasSitePage.rowAction('site-name')).toExist()
    })

    await reportStep('Operator: Manage ORS', async () => {
      await browser.url(OVERSEAS_SITES_PATH)
      await ManageOverseasSitesPage.openTab('accredited')
      await expect(
        ManageOverseasSitesPage.siteName('accredited', ORS.a.siteId)
      ).toHaveText(expect.stringContaining(NEW_NAME))
      await expect(
        ManageOverseasSitesPage.changeSiteLink(ORS.a.siteId)
      ).toExist()
    })
    progress.approvedSeen = true
  })

  it("Operator: changes B's town and submits it, with nothing to pay", async function () {
    requireStage(this, progress, 'approvedSeen')

    await reportStep(`Operator: change ORS ${ORS.b.orsId}`, async () => {
      await openDetails(ORS.b)
      await UpdateOverseasSitePage.openRowAction('location')
      await UpdateOverseasSitePage.fill({ townOrCity: NEW_TOWN })
      await UpdateOverseasSitePage.continue()
      await waitForPath(`/update/${ORS.b.siteId}`)
      await UpdateOverseasSitePage.saveAndContinue()
      await waitForPath('/requests')
      await expect(AccreditationRequestsPage.chargeInset).not.toExist()
      await AccreditationRequestsPage.continue()
      await waitForPath('/declaration')
      await SubmitApplicationPage.submitApplication()
      await waitForPath('/submitted')
    })

    progress.b = await browser.waitUntil(() => workItemFor(ORS.b), {
      timeout: PUSH_TIMEOUT,
      timeoutMsg: 'Case management raised no work item for B'
    })
    reportDetails('B work item', progress.b)
    expect(progress.b.typeId).toBe(UPDATE)
    progress.bSubmitted = true
  })

  it('Regulator: duly makes and refuses it, and confirms contact', async function () {
    requireStage(this, progress, 'bSubmitted')
    await signInToCaseManagement()
    const workItemId = progress.b.id

    await reportStep('Regulator: duly make it', async () => {
      await openWorkItem(workItemId)
      await dulyMakeWorkItem({ paymentDate: null })
      await expect(CmWorkItemPage.stateTag).toHaveText(
        WORK_ITEM_STATES.dulyMade
      )
    })
    await waitForItemStatus(ORS.b, 'DulyMade')

    await reportStep('Regulator: refuse it and confirm contact', async () => {
      await openWorkItem(workItemId)
      await refuseWorkItem({ note: 'RA-782 e2e: the new town is wrong.' })
      await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.refused)

      await openWorkItem(workItemId)
      await confirmApplicantContact()
      await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.refused)
      await expect(CmWorkItemPage.outcomePanel).toBeDisplayed()
    })
    progress.refused = true
  })

  it('Operator: the request reads REFUSED, and B is unchanged and can be changed again', async function () {
    requireStage(this, progress, 'refused')
    await signInAsOperator()

    const item = await currentItem(ORS.b)
    expect(item.status).toBe('Rejected')
    await expectOperatorStatus(item.itemId, 'REFUSED')

    await openDetails(ORS.b)
    await expect(UpdateOverseasSitePage.statusTag).toHaveText('Approved')
    await expect(UpdateOverseasSitePage.rowValue('location')).not.toHaveText(
      expect.stringContaining(NEW_TOWN)
    )
    await expect(UpdateOverseasSitePage.rowAction('location')).toExist()

    await browser.url(OVERSEAS_SITES_PATH)
    await ManageOverseasSitesPage.openTab('accredited')
    await expect(
      ManageOverseasSitesPage.siteName('accredited', ORS.b.siteId)
    ).toHaveText(expect.stringContaining(ORS.b.siteName))
    await expect(ManageOverseasSitesPage.changeSiteLink(ORS.b.siteId)).toExist()
  })
})
