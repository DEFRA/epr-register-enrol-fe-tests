import { browser, expect } from '@wdio/globals'
import AccreditationRequestsPage from 'page-objects/accreditation-requests.page'
import AddOrsConditionsOfExportPage from 'page-objects/add-ors-conditions-of-export.page'
import AddOrsRecyclingOperationPage from 'page-objects/add-ors-recycling-operation.page'
import AddToAccreditationPage from 'page-objects/add-to-accreditation.page'
import ChangeRequestDetailPage from 'page-objects/change-request-detail.page'
import ChangeRequestsPage from 'page-objects/change-requests.page'
import CmChangeValidFromPage from 'page-objects/cm-change-valid-from.page'
import CmWorkItemPage from 'page-objects/cm-work-item.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'
import { ukToday } from 'page-objects/cm-decision.page'

import {
  WORK_ITEM_STATES,
  approveWorkItem,
  confirmApplicantContact,
  dulyMakeWorkItem,
  refuseWorkItem,
  signInToCaseManagement
} from '../../helpers/case-management-journey.js'
import { getAccreditationChanges } from '../../helpers/case-management.js'
import { changeValidFromDate } from '../../helpers/monorepo-case-management.js'
import {
  MONOREPO_RUN_FLAG,
  changeRequestWorkItemIdsFor,
  clearChangeRequests,
  skipUnlessMonorepoRun,
  unaccreditOverseasSite
} from '../../helpers/monorepo.js'
import { signInAsOperator } from '../../helpers/monorepo-journey.js'
import { reportDetails, reportStep } from '../../helpers/report-step.js'
import { requireStage } from '../../helpers/require-stage.js'
import { readSeededYear } from '../../helpers/seeded-year.js'
import { waitForPath } from '../../helpers/wait-for-url.js'
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
// RA-495: an add-ORS change request decided in case management, end to end.
// Case management pushes each status change to the operator backend's change
// request status route, and confirming applicant contact applies the
// decision there before case management records it:
//
//   1 operator    adds Lyon to org 50019's accreditation and submits
//   2 regulator   duly makes Lyon's work item: the operator's request shows
//                 DULY MADE, and Lyon stays locked (no "Add to accreditation")
//   3 regulator   refuses it, and confirms the applicant has been contacted:
//                 the case closes as Refused, the request shows REFUSED, Lyon
//                 stays registered and can be requested again
//   4 operator    requests Lyon again and submits
//   5 regulator   duly makes and approves it, entering a valid from date
//                 other than the submission date: Lyon stays locked until the
//                 regulator confirms the applicant has been contacted, which
//                 grants it
//   5b regulator  corrects the valid from date, with a reason, while the
//                 approval awaits contact (RA-800): the link goes once the
//                 applicant has been contacted
//   6 operator    the request shows GRANTED, valid from the corrected date
//                 (AC6, RA-800), and Lyon is tagged Approved
//
// The tests share the requests and run in order; each skips when the one
// before it did not get as far as it needs. Granting Lyon selects it on the
// seeded accreditation application, so the hooks clear org 50019's change
// requests (and the work items they raised) and put Lyon back to registered.
// The monorepo stack runs without dual-write, so that is the legacy
// application only.

const SITE = ORS.lyon

// AC6: the site is accredited from the date the regulator enters on approval.
// RA-795: it must fall within the accreditation year, which the regulator may
// date before the submission date. So these are fixed days of that year (the
// seeded year, read in the first test), never today, so neither can be mixed
// up with the submission date. RA-800: the first is entered on approval and
// then corrected to the second, which is what the operator must see.
let EFFECTIVE_DATE
let CORRECTED_DATE

function chooseValidFromDates(year) {
  const today = ukToday()
  const first = `${year}-06-15`
  EFFECTIVE_DATE = first === today ? `${year}-06-16` : first
  CORRECTED_DATE = `${year}-03-02` === today ? `${year}-03-03` : `${year}-03-02`
}

// A yyyy-MM-dd date as a Date on the runner's calendar, for the date inputs.
function localDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// As the operator's request page shows it (date-fns 'd MMM yyyy').
function shownAsOperatorDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')
  return `${day} ${months[month - 1]} ${year}`
}

// Case management pushes a status change in the background once it has
// recorded it, so the operator side catches up shortly afterwards.
const PUSH_TIMEOUT = 30000

describe('RA-495: an add-ORS change request decided in case management @monorepo', () => {
  const progress = {}

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

  // The current item for the site, as the operator backend holds it.
  async function currentItem() {
    const { requests, sites } = await getAccreditationChanges(
      ORGANISATION_ID,
      progress.applicationId
    )
    const request = requests.find((r) =>
      r.sites.some((s) => s.itemId === progress.itemId)
    )
    return {
      request,
      item: request.sites.find((s) => s.itemId === progress.itemId),
      site: sites.find((s) => s.siteId === SITE.siteId)
    }
  }

  // Waits for case management's push to reach the operator backend.
  async function waitForItemStatus(status) {
    let last
    await browser.waitUntil(
      async () => {
        last = await currentItem()
        return last.item.status === status
      },
      {
        timeout: PUSH_TIMEOUT,
        interval: 500,
        timeoutMsg: `Lyon's change request item never reached ${status}`
      }
    )
    reportDetails(`Operator backend: item ${status}`, last.item)
    return last
  }

  // The item's status tag on the change requests list and on its own page.
  async function expectOperatorStatus(text) {
    await browser.url(`${MANAGE_PATH}/change-requests`)
    await expect(ChangeRequestsPage.status(progress.itemId)).toHaveText(text)
    await ChangeRequestsPage.clickReliably(
      ChangeRequestsPage.viewLink(progress.itemId)
    )
    await waitForPath(`/change-requests/${progress.itemId}`)
    await expect(ChangeRequestDetailPage.statusTag).toHaveText(text)
  }

  async function expectSiteLocked() {
    await browser.url(OVERSEAS_SITES_PATH)
    await expect(ManageOverseasSitesPage.orsStatusTag(SITE.siteId)).toHaveText(
      'Registered'
    )
    await expect(
      ManageOverseasSitesPage.addToAccreditationButton(SITE.siteId)
    ).not.toBeExisting()
  }

  // Adds Lyon to a new change request and submits it, then records the item
  // and the case management work item raised for it.
  async function requestSite() {
    await browser.url(OVERSEAS_SITES_PATH)
    await ManageOverseasSitesPage.addToAccreditation(SITE.siteId)
    await waitForPath(`/add/${SITE.siteId}`)
    await AddToAccreditationPage.continue()
    await waitForPath('/requests')
    await AccreditationRequestsPage.continue()
    await waitForPath('/declaration')
    await SubmitApplicationPage.submitApplication()
    await waitForPath('/payment')

    const { requests } = await getAccreditationChanges(
      ORGANISATION_ID,
      progress.applicationId
    )
    // Newest first: the request just submitted.
    const request = requests.find((r) => r.status === 'Submitted')
    progress.itemId = request.sites[0].itemId
    // Only items still being decided, so a refused one is never picked.
    progress.workItemId = (
      await changeRequestWorkItemIdsFor({ organisationId: ORGANISATION_ID })
    )[SITE.siteId]
    reportDetails('Submitted', progress)
    expect(progress.workItemId).toBeTruthy()
  }

  async function openWorkItem() {
    await CmWorkItemPage.open(progress.workItemId)
    await CmWorkItemPage.waitUntilLoaded()
  }

  before(function () {
    skipUnlessMonorepoRun(this)
  })

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
    chooseValidFromDates(year)

    await reportStep(`Operator: add ORS ${SITE.orsId} and submit`, () =>
      requestSite()
    )
    progress.submitted = true
  })

  it('Regulator: duly makes it, which the operator sees, and Lyon stays locked', async function () {
    requireStage(this, progress, 'submitted')
    await signInToCaseManagement()

    await reportStep('Regulator: duly make the work item', async () => {
      await openWorkItem()
      await expect(CmWorkItemPage.stateTag).toHaveText(
        WORK_ITEM_STATES.notStarted
      )
      await dulyMakeWorkItem()
      await expect(CmWorkItemPage.stateTag).toHaveText(
        WORK_ITEM_STATES.dulyMade
      )
    })

    await waitForItemStatus('DulyMade')
    await expectOperatorStatus('DULY MADE')
    await expectSiteLocked()
    progress.dulyMade = true
  })

  it('Regulator: refuses it; Lyon stays locked until the applicant is contacted', async function () {
    requireStage(this, progress, 'dulyMade')

    await reportStep('Regulator: refuse the application', async () => {
      await openWorkItem()
      await refuseWorkItem({ note: 'RA-495 e2e: the site is not suitable.' })
      await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.refused)
      await expect(CmWorkItemPage.pendingContactBanner).toBeDisplayed()
    })

    // The determination alone is not pushed: the operator still sees the
    // request being assessed.
    const { item } = await currentItem()
    expect(item.status).toBe('DulyMade')
    await expectSiteLocked()
    progress.refusalPending = true
  })

  it('Regulator: confirms contact, closing the case; the operator sees REFUSED and can request Lyon again', async function () {
    requireStage(this, progress, 'refusalPending')

    await reportStep(
      'Regulator: confirm the applicant was contacted',
      async () => {
        await openWorkItem()
        await confirmApplicantContact()
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.refused
        )
        await expect(CmWorkItemPage.outcomePanel).toBeDisplayed()
        await expect(
          CmWorkItemPage.confirmApplicantContactLink
        ).not.toBeExisting()
        await expect(CmWorkItemPage.pendingContactBanner).not.toBeExisting()
      }
    )

    // Applied before case management recorded it, so already there.
    const { item, site } = await currentItem()
    expect(item.status).toBe('Rejected')
    expect(site.accreditationStatus).toBe('Registered')
    expect(site.pendingRequestId).toBeNull()
    await expectOperatorStatus('REFUSED')

    await browser.url(OVERSEAS_SITES_PATH)
    await expect(
      ManageOverseasSitesPage.addToAccreditationButton(SITE.siteId)
    ).toBeExisting()
    progress.refused = true
  })

  it('Operator: requests Lyon again and submits it', async function () {
    requireStage(this, progress, 'refused')

    await reportStep(`Operator: add ORS ${SITE.orsId} again and submit`, () =>
      requestSite()
    )
    progress.resubmitted = true
  })

  it('Regulator: duly makes and approves it; Lyon stays locked until the applicant is contacted', async function () {
    requireStage(this, progress, 'resubmitted')

    await reportStep('Regulator: duly make and approve', async () => {
      await openWorkItem()
      await dulyMakeWorkItem()
      await expect(CmWorkItemPage.stateTag).toHaveText(
        WORK_ITEM_STATES.dulyMade
      )
      await waitForItemStatus('DulyMade')

      await openWorkItem()
      await approveWorkItem({
        note: 'RA-495 e2e: the site is suitable.',
        effectiveDate: EFFECTIVE_DATE
      })
      await expect(CmWorkItemPage.stateTag).toHaveText(
        WORK_ITEM_STATES.approved
      )
      await expect(CmWorkItemPage.pendingContactBanner).toBeDisplayed()
    })

    const { item } = await currentItem()
    expect(item.status).toBe('DulyMade')
    await expectSiteLocked()
    progress.approvalPending = true
  })

  it('Regulator: corrects the valid from date while the approval awaits contact', async function () {
    requireStage(this, progress, 'approvalPending')

    await reportStep(
      'Regulator: change the valid from date, with a reason',
      async () => {
        await openWorkItem()
        await expect(CmChangeValidFromPage.link).toBeDisplayed()
        await changeValidFromDate({
          validFrom: localDate(CORRECTED_DATE),
          reason: 'RA-800 e2e: the valid from date was entered in error.'
        })
        await expect(CmWorkItemPage.flashBanner).toHaveText(
          expect.stringContaining('Updated')
        )
        // Nothing but the date changed: still awaiting applicant contact.
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.approved
        )
        // The Updated banner stands in for the pending-contact banner on the
        // page shown after a save, so open the work item again to check it.
        await openWorkItem()
        await expect(CmWorkItemPage.pendingContactBanner).toBeDisplayed()
        await expect(CmWorkItemPage.confirmApplicantContactLink).toBeDisplayed()
      }
    )

    // A correction is not pushed: the operator side is still being assessed.
    const { item } = await currentItem()
    expect(item.status).toBe('DulyMade')
    await expectSiteLocked()
    progress.corrected = true
  })

  it('Regulator: confirms contact, granting it; the operator sees GRANTED, valid from the corrected date, and Lyon is accredited', async function () {
    requireStage(this, progress, 'corrected')

    await reportStep(
      'Regulator: confirm the applicant was contacted',
      async () => {
        await openWorkItem()
        await confirmApplicantContact()
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.granted
        )
        await expect(CmWorkItemPage.outcomePanel).toBeDisplayed()
        await expect(
          CmWorkItemPage.confirmApplicantContactLink
        ).not.toBeExisting()
        // The date can no longer be changed once it has been pushed.
        await expect(CmChangeValidFromPage.link).not.toBeExisting()
      }
    )

    const { item, site } = await currentItem()
    expect(item.status).toBe('Approved')
    expect(CORRECTED_DATE).not.toBe(EFFECTIVE_DATE)
    expect(new Date(item.validFrom).toISOString()).toBe(
      `${CORRECTED_DATE}T00:00:00.000Z`
    )
    expect(site.accreditationStatus).toBe('Accredited')
    expect(site.pendingRequestId).toBeNull()

    await expectOperatorStatus('GRANTED')
    await expect(ChangeRequestDetailPage.requestValidFrom).toHaveText(
      shownAsOperatorDate(CORRECTED_DATE)
    )

    await browser.url(OVERSEAS_SITES_PATH)
    await expect(ManageOverseasSitesPage.orsStatusTag(SITE.siteId)).toHaveText(
      'Approved'
    )
  })
})

// RA-495 (3bb.29): granting a site also writes the answers the operator
// supplied on the request, as the operator's own add-to-accreditation journey
// writes them onto the site:
//
//   1 operator    adds Izmir, supplying its missing recycling operation and
//                 conditions of export answer, and submits
//   2 regulator   duly makes, approves and confirms contact, granting it
//   3 operator    Izmir is accredited and holds the supplied answers, which
//                 are now locked as its own
//
// Izmir is seeded without them (test/fixtures/in-year-change-org.js), so the
// hooks put it back to registered and clear them again.

const IZMIR = ORS.izmir
const IZMIR_UNANSWERED = ['operationCodes', 'conditionsOfExport']

describe("RA-495: a granted add-ORS request writes the operator's supplied answers @monorepo", () => {
  const progress = {}

  async function resetOrganisation() {
    const cleared = await clearChangeRequests({
      organisationId: ORGANISATION_ID
    })
    const unaccredited = await unaccreditOverseasSite({
      organisationId: ORGANISATION_ID,
      siteId: IZMIR.siteId,
      unanswered: IZMIR_UNANSWERED
    })
    reportDetails(`Reset organisation ${ORGANISATION_ID}`, {
      ...cleared,
      ...unaccredited
    })
  }

  async function currentItem() {
    const { requests, sites } = await getAccreditationChanges(
      ORGANISATION_ID,
      progress.applicationId
    )
    const request = requests.find((r) =>
      r.sites.some((s) => s.itemId === progress.itemId)
    )
    return {
      item: request.sites.find((s) => s.itemId === progress.itemId),
      site: sites.find((s) => s.siteId === IZMIR.siteId)
    }
  }

  async function waitForItemStatus(status) {
    await browser.waitUntil(
      async () => (await currentItem()).item.status === status,
      {
        timeout: PUSH_TIMEOUT,
        interval: 500,
        timeoutMsg: `Izmir's change request item never reached ${status}`
      }
    )
  }

  async function openWorkItem() {
    await CmWorkItemPage.open(progress.workItemId)
    await CmWorkItemPage.waitUntilLoaded()
  }

  before(function () {
    skipUnlessMonorepoRun(this)
  })

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

  it('Operator: adds Izmir with its missing information and submits the request', async () => {
    const year = await readSeededYear({
      managePath: MANAGE_PATH,
      organisationName: ORGANISATION_NAME,
      material: MATERIAL
    })
    progress.applicationId = accreditationApplicationId(year)

    await reportStep(
      `Operator: add ORS ${IZMIR.orsId}, with its missing information, and submit`,
      async () => {
        await browser.url(OVERSEAS_SITES_PATH)
        await ManageOverseasSitesPage.addToAccreditation(IZMIR.siteId)
        await waitForPath(`/add/${IZMIR.siteId}`)

        await AddToAccreditationPage.openRowAction('recycling-operation')
        await waitForPath(`/add/${IZMIR.siteId}/recycling-operation`)
        progress.operationCode =
          await AddOrsRecyclingOperationPage.selectPrimaryOperationCode()
        await AddOrsRecyclingOperationPage.continue()
        await waitForPath(`/add/${IZMIR.siteId}`)

        await AddToAccreditationPage.openRowAction('conditions-of-export')
        await waitForPath(`/add/${IZMIR.siteId}/conditions-of-export`)
        await AddOrsConditionsOfExportPage.selectNo()
        await AddOrsConditionsOfExportPage.continue()
        await waitForPath(`/add/${IZMIR.siteId}`)

        await AddToAccreditationPage.continue()
        await waitForPath('/requests')
        await AccreditationRequestsPage.continue()
        await waitForPath('/declaration')
        await SubmitApplicationPage.submitApplication()
        await waitForPath('/payment')
      }
    )

    const { requests } = await getAccreditationChanges(
      ORGANISATION_ID,
      progress.applicationId
    )
    const request = requests.find((r) => r.status === 'Submitted')
    progress.itemId = request.sites[0].itemId
    progress.workItemId = (
      await changeRequestWorkItemIdsFor({ organisationId: ORGANISATION_ID })
    )[IZMIR.siteId]
    reportDetails('Submitted', progress)
    expect(progress.operationCode).toBeTruthy()
    expect(progress.workItemId).toBeTruthy()
    progress.submitted = true
  })

  it('Regulator: duly makes, approves and confirms contact, granting it', async function () {
    requireStage(this, progress, 'submitted')
    await signInToCaseManagement()

    await reportStep(
      'Regulator: duly make, approve and confirm contact',
      async () => {
        await openWorkItem()
        await dulyMakeWorkItem()
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.dulyMade
        )
        await waitForItemStatus('DulyMade')

        await openWorkItem()
        await approveWorkItem({ note: 'RA-495 e2e: the site is suitable.' })
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.approved
        )

        await openWorkItem()
        await confirmApplicantContact()
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.granted
        )
      }
    )
    progress.granted = true
  })

  it('Operator: Izmir is accredited with the answers supplied on the request', async function () {
    requireStage(this, progress, 'granted')

    const { item, site } = await currentItem()
    reportDetails('Operator backend: Izmir', site)
    expect(item.status).toBe('Approved')
    expect(site.accreditationStatus).toBe('Accredited')
    expect(site.site.operationCodes).toEqual([progress.operationCode])
    expect(site.site.conditionsOfExport).toBe(false)
    // The site now holds them, so a later request could not supply them again.
    expect(site.lockedFields).toEqual(expect.arrayContaining(IZMIR_UNANSWERED))

    await browser.url(OVERSEAS_SITES_PATH)
    await expect(ManageOverseasSitesPage.orsStatusTag(IZMIR.siteId)).toHaveText(
      'Approved'
    )
  })
})
